/* ===== Layanan laporan & agregasi ===== */

import type { DB, Sale } from '../types';
import { db } from '../store';

export function salesInRange(fromMs: number, toMs: number, outletId?: string, cashierId?: string): Sale[] {
  return db.sales.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= fromMs && t <= toMs && (!outletId || s.outletId === outletId) && (!cashierId || s.cashierId === cashierId);
  });
}

export function dailySeries(days: number, outletId?: string): Array<{ label: string; omzet: number; tx: number }> {
  const out: Array<{ label: string; omzet: number; tx: number }> = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const start = d.getTime() - i * 86400_000;
    const end = start + 86400_000;
    const rows = salesInRange(start, end, outletId);
    const dd = new Date(start);
    out.push({
      label: `${dd.getDate()}/${dd.getMonth() + 1}`,
      omzet: rows.reduce((a, s) => a + s.total, 0),
      tx: rows.length,
    });
  }
  return out;
}

export function omzetByOutlet(fromMs: number, toMs: number): Array<{ outletId: string; name: string; omzet: number; tx: number }> {
  return db.outlets
    .map((o) => {
      const rows = salesInRange(fromMs, toMs, o.id);
      return { outletId: o.id, name: o.name, omzet: rows.reduce((a, s) => a + s.total, 0), tx: rows.length };
    })
    .sort((a, b) => b.omzet - a.omzet);
}

export function topProducts(fromMs: number, toMs: number, limit = 8): Array<{ name: string; qty: number; omzet: number }> {
  const sales = salesInRange(fromMs, toMs);
  const ids = new Set(sales.map((s) => s.id));
  const map = new Map<string, { name: string; qty: number; omzet: number }>();
  for (const it of db.saleItems) {
    if (!ids.has(it.saleId)) continue;
    const cur = map.get(it.productId) ?? { name: it.name, qty: 0, omzet: 0 };
    cur.qty += it.qty;
    cur.omzet += it.total;
    map.set(it.productId, cur);
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function grossProfit(sales: Sale[]): number {
  const ids = new Set(sales.map((s) => s.id));
  let profit = 0;
  for (const it of db.saleItems) if (ids.has(it.saleId)) profit += (it.price - it.cost) * it.qty;
  return profit;
}

export function topUpTotal(fromMs: number, toMs: number): number {
  return db.walletTxs
    .filter((t) => t.type === 'TOP_UP' && t.amount > 0)
    .filter((t) => {
      const ms = new Date(t.createdAt).getTime();
      return ms >= fromMs && ms <= toMs;
    })
    .reduce((a, t) => a + t.amount, 0);
}

export function totalCirculatingBalance(): number {
  return db.wallets.reduce((a, w) => a + w.balance, 0);
}

export function santriSpending(d: DB, santriId: string, fromMs: number, toMs: number): number {
  return d.walletTxs
    .filter((t) => t.santriId === santriId && t.amount < 0)
    .filter((t) => {
      const ms = new Date(t.createdAt).getTime();
      return ms >= fromMs && ms <= toMs;
    })
    .reduce((a, t) => a + Math.abs(t.amount), 0);
}

export function monthRange(): [number, number] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return [start, Date.now()];
}

export function dayRange(offset = 0): [number, number] {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const start = d.getTime() + offset * 86400_000;
  return [start, start + 86400_000];
}
