/* ===== Notification service — abstraction antar channel & provider.
   Provider WhatsApp TIDAK di-hardcode: ganti implementasi NotificationChannel
   (mis. Wablas, Fonnte, Twilio) tanpa mengubah logika bisnis. ===== */

import type { Notif, Santri } from '../types';
import { fmtDateFull, fmtTime, rp, todayISO, uid } from '../util';
import { db, mutate, waliChildren } from '../store';

export interface OutgoingMessage {
  to: string;
  title: string;
  body: string;
}

export interface NotificationChannel {
  readonly id: string;
  readonly label: string;
  send(msg: OutgoingMessage): Promise<void>;
}

/** Channel in-app — tersimpan di tabel notifications */
export class InAppChannel implements NotificationChannel {
  readonly id = 'inapp';
  readonly label = 'In-App';
  userId?: string;
  refType?: string;
  refId?: string;

  async send(msg: OutgoingMessage): Promise<void> {
    const n: Notif = {
      id: uid('NTF'), userId: this.userId, title: msg.title, body: msg.body,
      channel: 'inapp', read: false, refType: this.refType, refId: this.refId, createdAt: todayISO(),
    };
    mutate((d) => d.notifs.unshift(n));
  }
}

/** Channel WhatsApp — implementasi demo menyimpan ke outbox; di produksi
 *  class ini memanggil REST API provider yang dikonfigurasi via env var. */
export class WhatsAppChannel implements NotificationChannel {
  readonly id = 'whatsapp';
  readonly label = 'WhatsApp';
  provider: string;
  toPhone: string;
  refType?: string;
  refId?: string;

  constructor(provider: string, toPhone: string) {
    this.provider = provider;
    this.toPhone = toPhone;
  }

  async send(msg: OutgoingMessage): Promise<void> {
    // Demo: log ke outbox notifikasi. Produksi: POST {this.provider}/api/messages
    const n: Notif = {
      id: uid('NTF'), title: `[WA → ${this.toPhone}] ${msg.title}`, body: msg.body,
      channel: 'whatsapp', read: false, refType: this.refType, refId: this.refId, createdAt: todayISO(),
    };
    mutate((d) => d.notifs.unshift(n));
  }
}

export interface NotifyOptions {
  santri?: Santri;
  userId?: string;
  title: string;
  body: string;
  refType?: string;
  refId?: string;
}

/** Kirim ke wali santri (in-app + WA) dan/atau user internal. */
export function notify(opts: NotifyOptions): void {
  const targets: NotificationChannel[] = [];
  if (opts.userId) {
    const ch = new InAppChannel();
    ch.userId = opts.userId;
    ch.refType = opts.refType;
    ch.refId = opts.refId;
    targets.push(ch);
  }
  if (opts.santri) {
    const link = db.waliSantri.find((w) => w.santriId === opts.santri!.id);
    const wali = link ? db.wali.find((w) => w.id === link.waliId) : undefined;
    if (wali) {
      const inapp = new InAppChannel();
      inapp.userId = wali.userId;
      inapp.refType = opts.refType;
      inapp.refId = opts.refId;
      targets.push(inapp);
      targets.push(new WhatsAppChannel(db.settings.waProvider, wali.phone));
    }
  }
  void Promise.all(targets.map((c) => c.send({ to: '', title: opts.title, body: opts.body })));
}

/** Template pesan transaksi sesuai spesifikasi sistem. */
export function transactionMessage(params: {
  santriName: string;
  outletName: string;
  total: number;
  balanceAfter: number;
  when: string;
}): string {
  return [
    'Transaksi Santri',
    '',
    `Nama: ${params.santriName}`,
    `Outlet: ${params.outletName}`,
    `Total: ${rp(params.total)}`,
    `Saldo tersisa: ${rp(params.balanceAfter)}`,
    `Tanggal: ${fmtDateFull(params.when)}`,
    `Jam: ${fmtTime(params.when)}`,
  ].join('\n');
}

export function unreadCount(userId?: string): number {
  return db.notifs.filter((n) => !n.read && (!n.userId || n.userId === userId)).length;
}

export function notifForUser(userId?: string): Notif[] {
  return db.notifs.filter((n) => !n.userId || n.userId === userId);
}

export function childrenOfWaliUser(userId: string): Santri[] {
  const user = db.users.find((u) => u.id === userId);
  if (!user?.waliId) return [];
  return waliChildren(user.waliId);
}
