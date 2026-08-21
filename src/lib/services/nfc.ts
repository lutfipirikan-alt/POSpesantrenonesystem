/* ===== NFC Hardware Abstraction Layer =====
   Logika bisnis TIDAK terikat pada satu reader/merek tertentu.

   Implementasi:
   1. MockNfcReader      — simulator untuk development/testing (tanpa hardware)
   2. WebNfcReader       — Web NFC API (Chrome Android, WAJIB HTTPS).
                           Membaca UID kartu NTAG + kartu yang sudah ditulis
                           identitas santri (NDEF). MIFARE Classic terkunci
                           tidak dapat dibaca browser.
   3. NativeNfcReader    — plugin Capacitor "NfcReader" (Kotlin, lihat
                           native/android/NfcReaderPlugin.kt). Membaca UID
                           SEMUA kartu 13,56 MHz termasuk MIFARE Classic.
   4. WebUsbNfcReader    — kerangka reader USB fisik (ACS ACR122U dsb.)
                           untuk komputer kasir; butuh driver CCID — belum
                           diverifikasi tanpa perangkat.

   nfcHub menggabungkan semua reader aktif dan menyiarkan event UID ke
   seluruh halaman (POS, top up, absensi, pemasangan kartu).
*/

import { db } from '../store';

export interface NfcReader {
  readonly kind: string;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readCard(): Promise<string | null>;
  onCardDetected(cb: (uid: string) => void): () => void;
  onError(cb: (err: Error) => void): () => void;
}

export interface NfcEvent {
  id: number;
  at: string;
  kind: 'detected' | 'duplicate' | 'error' | 'info';
  message: string;
}

type Listener = (uid: string) => void;
type ErrListener = (e: Error) => void;

let evtSeq = 0;

/* Domain penanda identitas santri yang ditulis ke kartu NTAG (NDEF URL).
   Kartu = identitas; saldo tetap di server. */
export const CARD_URL_BASE = 'https://pesantren.one/s/';

class BaseReader implements NfcReader {
  kind = 'base';
  connected = false;
  private cardListeners = new Set<Listener>();
  private errListeners = new Set<ErrListener>();
  private lastUid = '';
  private lastAt = 0;
  events: NfcEvent[] = [];
  onEvent?: () => void;

  log(kind: NfcEvent['kind'], message: string) {
    this.events = [{ id: ++evtSeq, at: new Date().toISOString(), kind, message }, ...this.events].slice(0, 12);
    this.onEvent?.();
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.log('info', 'Reader terhubung — siap membaca kartu');
  }
  async disconnect(): Promise<void> {
    this.connected = false;
    this.log('info', 'Reader dilepas');
  }
  async readCard(): Promise<string | null> {
    return null;
  }
  onCardDetected(cb: Listener): () => void {
    this.cardListeners.add(cb);
    return () => this.cardListeners.delete(cb);
  }
  onError(cb: ErrListener): () => void {
    this.errListeners.add(cb);
    return () => this.errListeners.delete(cb);
  }

  /** Inti debounce: bacaan UID berulang saat kartu masih menempel
      hanya diproses sekali per jendela cooldown (anti transaksi ganda). */
  protected emit(uid: string): void {
    const now = Date.now();
    const cooldown = db.settings.nfcCooldownMs;
    if (uid === this.lastUid && now - this.lastAt < cooldown) {
      this.log('duplicate', `UID ${uid} diabaikan (duplikat < ${cooldown}ms)`);
      return;
    }
    this.lastUid = uid;
    this.lastAt = now;
    this.log('detected', `Kartu terbaca: ${uid}`);
    this.cardListeners.forEach((cb) => cb(uid));
  }
  protected fail(e: Error): void {
    this.log('error', e.message);
    this.errListeners.forEach((cb) => cb(e));
  }
}

/* ---------- 1. Simulator ---------- */
export class MockNfcReader extends BaseReader {
  kind = 'MOCK';
  pendingUid: string | null = null;

  async readCard(): Promise<string | null> {
    const uid = this.pendingUid;
    this.pendingUid = null;
    return uid;
  }

  simulateTap(uid: string): void {
    if (!this.connected) {
      this.fail(new Error('Reader belum terhubung'));
      return;
    }
    this.emit(uid.toUpperCase().trim());
  }

  simulateUnknown(): string {
    const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
    const uid = `04:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
    this.simulateTap(uid);
    return uid;
  }
}

/* ---------- 2. Web NFC (Chrome Android + HTTPS) ---------- */

interface NDEFReaderLike {
  scan(options?: Record<string, unknown>): Promise<void>;
  write(message: { records: Array<{ recordType: string; data: string }> }): Promise<void>;
  addEventListener(type: 'reading' | 'readingerror', cb: (e: unknown) => void): void;
}

export function webNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}
export function secureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

export class WebNfcReader extends BaseReader {
  kind = 'WEB_NFC';
  scanning = false;
  private ndef: NDEFReaderLike | null = null;

  async connect(): Promise<void> {
    if (!webNfcSupported()) throw new Error('Web NFC tidak tersedia. Gunakan Chrome di HP Android (butuh HTTPS).');
    const Ctor = (window as unknown as { NDEFReader: new () => NDEFReaderLike }).NDEFReader;
    this.ndef = new Ctor();
    this.ndef.addEventListener('reading', (e) => this.onReading(e));
    this.ndef.addEventListener('readingerror', () => this.fail(new Error('Kartu terbaca tapi gagal dibaca (kartu terkunci/klasik). Gunakan APK native untuk MIFARE.')));
    this.connected = true;
    this.log('info', 'Web NFC siap — tekan "Aktifkan Scanner HP"');
  }

  /** Wajib dipanggil dari gesture pengguna (tap tombol) — kebijakan browser. */
  async startScan(): Promise<void> {
    if (!this.ndef) await this.connect();
    if (!secureContext())
      throw new Error('Web NFC butuh HTTPS. Buka lewat alamat https:// (mis. Netlify) atau pakai APK native.');
    await this.ndef!.scan();
    this.scanning = true;
    this.log('info', 'Scanner NFC HP aktif — tempelkan kartu ke punggung HP');
  }

  private onReading(e: unknown): void {
    const ev = e as { serialNumber?: string; message?: { records?: Array<{ recordType: string; data: ArrayBuffer }> } };
    // 1) identitas santri yang ditulis di kartu (NDEF)
    for (const r of ev.message?.records ?? []) {
      try {
        const text = new TextDecoder().decode(r.data);
        const m = text.match(/\/s\/(SAN-[A-Za-z0-9-]+)/) || text.match(/pos1s:(SAN-[A-Za-z0-9-]+)/i) || text.match(/\b(SAN-[A-Za-z0-9-]{4,})\b/);
        if (m) {
          this.log('info', `Identitas NDEF terbaca: ${m[1]}`);
          this.emit(`SAN:${m[1]!.toUpperCase()}`);
          return;
        }
      } catch {
        /* lanjut */
      }
    }
    // 2) UID kartu NTAG (Chrome menyediakan serialNumber pada event reading)
    if (ev.serialNumber) {
      this.emit(ev.serialNumber.toUpperCase());
      return;
    }
    this.fail(new Error('Kartu kosong — tulis identitas santri dulu lewat "Tulis Kartu".'));
  }

  /** Menulis identitas santri ke kartu NTAG kosong (stiker NTAG213/215). */
  async writeSantriCard(santriId: string): Promise<void> {
    if (!this.ndef) await this.connect();
    if (!secureContext()) throw new Error('Menulis kartu butuh HTTPS.');
    await this.ndef!.write({ records: [{ recordType: 'url', data: `${CARD_URL_BASE}${santriId}` }] });
    this.log('info', `Kartu ditulis: ${santriId}`);
  }
}

/* ---------- 3. Native Android (Capacitor plugin) ---------- */

interface NfcPlugin {
  getStatus(): Promise<{ available: boolean; enabled: boolean }>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  writeCard(o: { text: string }): Promise<{ queued: boolean }>;
  addListener(ev: string, cb: (p: Record<string, unknown>) => void): Promise<{ remove: () => void }>;
}

export function isNativeAndroid(): boolean {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return !!cap && typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android';
}

export class NativeNfcReader extends BaseReader {
  kind = 'NATIVE';
  private plugin: NfcPlugin | null = null;
  private offs: Array<{ remove: () => void }> = [];

  async connect(): Promise<void> {
    const cap = (window as unknown as { Capacitor?: { registerPlugin?: (n: string) => NfcPlugin } }).Capacitor;
    if (!cap?.registerPlugin) throw new Error('Plugin native tidak tersedia (bukan APK).');
    this.plugin = cap.registerPlugin('NfcReader');
    this.offs.push(
      await this.plugin.addListener('cardDetected', (p) => this.emit(String(p.uid ?? ''))),
      await this.plugin.addListener('writeResult', (p) => {
        this.log(p.success ? 'info' : 'error', p.success ? `Kartu ${p.uid} berhasil ditulis` : `Gagal menulis kartu ${p.uid}`);
      })
    );
    const st = await this.plugin.getStatus();
    if (!st.available) throw new Error('Perangkat ini tidak memiliki chip NFC.');
    await this.plugin.startScan();
    this.connected = true;
    this.log('info', 'NFC native aktif — baca UID semua kartu (termasuk MIFARE Classic)');
  }

  async disconnect(): Promise<void> {
    await this.plugin?.stopScan();
    this.offs.forEach((o) => o.remove());
    this.connected = false;
  }

  writeSantriCard(santriId: string): Promise<unknown> {
    if (!this.plugin) return Promise.reject(new Error('Plugin belum terhubung'));
    return this.plugin.writeCard({ text: `${CARD_URL_BASE}${santriId}` });
  }
}

/* ---------- 4. Kerangka USB reader komputer kasir ---------- */
export class WebUsbNfcReader extends BaseReader {
  kind = 'WEBUSB';
  async connect(): Promise<void> {
    const nav = navigator as Navigator & { usb?: unknown };
    if (!nav.usb) {
      this.fail(new Error('WebUSB tidak tersedia di browser ini. Gunakan Mock Mode.'));
      return;
    }
    // Produksi: navigator.usb.requestDevice({ filters: [{ vendorId: 0x072f }] })
    // lalu parse frame CCID untuk UID kartu. Membutuhkan pengujian hardware.
    this.fail(new Error('Driver CCID/PCSC diperlukan. Sementara gunakan Mock Mode.'));
  }
}

/* ---------- Hub: gabungan semua reader ---------- */

export const nfcReader = new MockNfcReader();
export const webReader = new WebNfcReader();
export const nativeReader = new NativeNfcReader();

export type NfcMode = 'NATIVE' | 'WEB_NFC' | 'MOCK';

interface HubOptions {
  onCard: (uid: string) => void;
  onError: (e: Error) => void;
  onLog: () => void;
}

class NfcHub {
  mode: NfcMode = 'MOCK';
  private initialized = false;
  private cleanup: Array<() => void> = [];

  init(opts: HubOptions): () => void {
    if (this.initialized) return () => undefined;
    this.initialized = true;

    const wire = (r: BaseReader) => {
      r.onEvent = opts.onLog;
      this.cleanup.push(r.onCardDetected(opts.onCard), r.onError(opts.onError));
    };
    wire(nfcReader);
    void nfcReader.connect();

    if (isNativeAndroid()) {
      this.mode = 'NATIVE';
      wire(nativeReader);
      nativeReader.connect().catch((e: Error) => {
        nfcReader.log('error', `Native NFC: ${e.message}`);
        this.mode = 'MOCK';
      });
    } else if (webNfcSupported()) {
      this.mode = 'WEB_NFC';
      wire(webReader);
      webReader.connect().catch((e: Error) => nfcReader.log('error', e.message));
    }
    nfcReader.log('info', `Mode: ${this.modeLabel()}`);
    return () => this.dispose();
  }

  modeLabel(): string {
    if (this.mode === 'NATIVE') return 'NATIVE (APK Android)';
    if (this.mode === 'WEB_NFC') return 'WEB NFC (Chrome Android)';
    return 'SIMULATOR';
  }

  /** Semua log dari semua reader, terurut terbaru. */
  allEvents(): NfcEvent[] {
    return [...nativeReader.events, ...webReader.events, ...nfcReader.events].sort((a, b) => b.id - a.id).slice(0, 16);
  }

  async activateWebScan(): Promise<void> {
    await webReader.startScan();
  }

  async writeCard(santriId: string): Promise<void> {
    if (this.mode === 'NATIVE') await nativeReader.writeSantriCard(santriId);
    else await webReader.writeSantriCard(santriId);
  }

  dispose(): void {
    this.cleanup.forEach((c) => c());
    this.cleanup = [];
    this.initialized = false;
  }
}

export const nfcHub = new NfcHub();

/* ---------- Resolusi kartu (validasi server-side) ---------- */

export function resolveCard(uid: string) {
  const UID = uid.toUpperCase().trim();

  // Identitas langsung dari kartu NDEF yang ditulis sistem
  if (UID.startsWith('SAN:')) {
    const santriId = UID.slice(4);
    const santri = db.santri.find((s) => s.id === santriId);
    if (!santri) return { error: 'Identitas pada kartu tidak dikenal (santri tidak ditemukan).' as string };
    if (santri.status !== 'aktif') return { error: `Santri berstatus "${santri.status}" — transaksi ditolak.` };
    return { card: db.cards.find((c) => c.santriId === santriId && c.status === 'ACTIVE'), santri };
  }

  const card = db.cards.find((c) => c.uid === UID);
  if (!card) return { error: 'Kartu tidak terdaftar. Hubungi admin untuk registrasi.' as string };
  if (card.status === 'BLOCKED') return { error: `Kartu DIBLOKIR (${card.reason ?? 'tanpa alasan'}). Transaksi ditolak.` };
  if (card.status === 'LOST') return { error: 'Kartu dilaporkan HILANG dan tidak berlaku.' };
  if (card.status === 'REPLACED' || card.status === 'INACTIVE') return { error: 'Kartu sudah tidak aktif (diganti/nonaktif).' };
  const santri = db.santri.find((s) => s.id === card.santriId);
  if (!santri) return { error: 'Data santri pemilik kartu tidak ditemukan.' };
  if (santri.status !== 'aktif') return { error: `Santri berstatus "${santri.status}" — transaksi ditolak.` };
  return { card, santri };
}
