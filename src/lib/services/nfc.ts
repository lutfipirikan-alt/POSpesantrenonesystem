/* ===== NFC Hardware Abstraction Layer =====
   Logika bisnis TIDAK terikat pada merek reader tertentu.
   - MockNfcReader : simulator untuk development/testing (tanpa hardware)
   - WebUsbNfcReader : kerangka implementasi reader fisik via WebUSB/WebHID
     (membutuhkan device ACS ACR122U-compatible + flag browser; belum dapat
     diverifikasi tanpa hardware — gunakan Mock Mode untuk pengujian)
*/

import { db } from '../store';

export interface NfcReader {
  readonly kind: string;
  readonly connected: boolean;
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

/** Simulator: developer mengetik UID atau memilih santri lalu "menempelkan" kartu. */
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

/** Kerangka reader fisik via WebUSB. Belum diverifikasi tanpa hardware —
 *  jangan menganggap NFC hardware berfungsi sebelum device benar-benar diuji. */
export class WebUsbNfcReader extends BaseReader {
  kind = 'WEBUSB';
  async connect(): Promise<void> {
    const nav = navigator as Navigator & { usb?: unknown };
    if (!nav.usb) {
      this.fail(new Error('WebUSB tidak tersedia di browser ini. Gunakan Mock Mode.'));
      return;
    }
    // Produksi: navigator.usb.requestDevice({ filters: [{ vendorId: 0x072f }] })
    // lalu parse frame CCID untuk mendapatkan UID kartu.
    this.fail(new Error('Implementasi device driver diperlukan (CCID/PCSC). Sementara gunakan Mock Mode.'));
  }
}

export const nfcReader = new MockNfcReader();

/** Cari kartu ACTIVE dari UID — validasi server-side. */
export function resolveCard(uid: string) {
  const card = db.cards.find((c) => c.uid === uid.toUpperCase().trim());
  if (!card) return { error: 'Kartu tidak terdaftar. Hubungi admin untuk registrasi.' as string };
  if (card.status === 'BLOCKED') return { error: `Kartu DIBLOKIR (${card.reason ?? 'tanpa alasan'}). Transaksi ditolak.` };
  if (card.status === 'LOST') return { error: 'Kartu dilaporkan HILANG dan tidak berlaku.' };
  if (card.status === 'REPLACED' || card.status === 'INACTIVE') return { error: 'Kartu sudah tidak aktif (diganti/nonaktif).' };
  const santri = db.santri.find((s) => s.id === card.santriId);
  if (!santri) return { error: 'Data santri pemilik kartu tidak ditemukan.' };
  if (santri.status !== 'aktif') return { error: `Santri berstatus "${santri.status}" — transaksi ditolak.` };
  return { card, santri };
}
