/* ===== Store: persistensi (localStorage) + reaktivitas + helper relasional ===== */

import { useSyncExternalStore } from 'react';
import type { DB, NfcCard, Santri, User } from './types';
import { buildSeed, SEED_VERSION } from './seed';

const KEY = 'pesantren-one-system-db';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === SEED_VERSION) return parsed;
    }
  } catch {
    /* rusak → reseed */
  }
  const fresh = buildSeed();
  try {
    localStorage.setItem(KEY, JSON.stringify(fresh));
  } catch { /* storage penuh — tetap jalan in-memory */ }
  return fresh;
}

export const db: DB = load();
let version = 0;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch { /* abaikan */ }
}

export function mutate(fn: (d: DB) => void): void {
  fn(db);
  version += 1;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDB(): number {
  return useSyncExternalStore(subscribe, () => version);
}

export function resetDemo(): void {
  const fresh = buildSeed();
  mutate((d) => {
    Object.keys(d).forEach((k) => delete (d as unknown as Record<string, unknown>)[k]);
    Object.assign(d, fresh);
  });
}

/* ---------- helper relasional ---------- */

export const santriById = (id?: string): Santri | undefined => db.santri.find((s) => s.id === id);
export const userById = (id?: string): User | undefined => db.users.find((u) => u.id === id);
export const kelasById = (id?: string) => db.kelas.find((k) => k.id === id);
export const kamarById = (id?: string) => db.kamar.find((k) => k.id === id);
export const outletById = (id?: string) => db.outlets.find((o) => o.id === id);
export const productById = (id?: string) => db.products.find((p) => p.id === id);
export const cardById = (id?: string) => db.cards.find((c) => c.id === id);

export function activeCardOf(santriId: string): NfcCard | undefined {
  return db.cards.find((c) => c.santriId === santriId && c.status === 'ACTIVE');
}

export function balanceOf(santriId: string): number {
  // sumber kebenaran: baris ledger terakhir
  const txs = db.walletTxs.filter((t) => t.santriId === santriId);
  if (txs.length === 0) return 0;
  const last = txs.reduce((a, b) => (new Date(b.createdAt) >= new Date(a.createdAt) ? b : a));
  return last.balanceAfter;
}

export function currentUser(): User | null {
  return db.users.find((u) => u.id === db.sessionUserId) ?? null;
}

export function waliChildren(waliId: string): Santri[] {
  const ids = db.waliSantri.filter((w) => w.waliId === waliId).map((w) => w.santriId);
  return db.santri.filter((s) => ids.includes(s.id));
}

export function violationPoints(santriId: string): number {
  return db.violations.filter((v) => v.santriId === santriId && v.status !== 'SELESAI').reduce((a, v) => a + v.points, 0);
}
