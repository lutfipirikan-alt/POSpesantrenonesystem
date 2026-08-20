/* ===== Wallet Ledger Service =====
   Prinsip: saldo TIDAK pernah diubah langsung. Setiap perubahan saldo
   adalah satu baris ledger (double-entry sederhana: before/after).
   - Lock per santri mensimulasikan row-locking PostgreSQL (SELECT ... FOR UPDATE)
   - Idempotency key menjamin satu transaksi hanya diproses sekali
   - Validasi saldo dilakukan di "server" (service), bukan dari data frontend
*/

import type { TxType, User, WalletTx } from '../types';
import { balanceOf, db, mutate } from '../store';
import { rp, todayISO, uid, uuid } from '../util';
import { audit } from './audit';
import { notify } from './notify';

export class InsufficientBalanceError extends Error {
  constructor(balance: number, needed: number) {
    super(`Saldo tidak mencukupi. Saldo ${rp(balance)}, dibutuhkan ${rp(needed)}.`);
    this.name = 'InsufficientBalanceError';
  }
}

/* Lock per santri — antrean serial agar transaksi konkuren tidak merusak saldo */
const locks = new Map<string, Promise<void>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    key,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

/** Hitung ulang saldo murni dari ledger (sumber kebenaran). */
export function recomputeBalance(santriId: string): number {
  return ledgerBalance(santriId);
}

export function ledgerBalance(santriId: string): number {
  const txs = db.walletTxs.filter((t) => t.santriId === santriId);
  if (!txs.length) return 0;
  txs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return txs[txs.length - 1]!.balanceAfter;
}

export interface PostLedgerParams {
  santriId: string;
  type: TxType;
  amount: number; // bertanda
  refType: WalletTx['refType'];
  refId: string;
  description: string;
  actor: User | null;
  idemKey?: string;
  silent?: boolean;
}

export async function postLedger(p: PostLedgerParams): Promise<WalletTx> {
  return withLock(p.santriId, async () => {
    // 1) Idempotency — proses maksimal sekali per key
    if (p.idemKey) {
      const existing = db.walletTxs.find((t) => t.idemKey === p.idemKey);
      if (existing) return existing;
    }
    // 2) Validasi saldo di server (bukan dari frontend)
    const before = ledgerBalance(p.santriId);
    if (p.amount === 0) throw new Error('Nominal transaksi tidak boleh nol.');
    if (p.amount < 0 && before + p.amount < 0) {
      throw new InsufficientBalanceError(before, Math.abs(p.amount));
    }
    const after = before + p.amount;
    const tx: WalletTx = {
      id: uid('WTX'),
      santriId: p.santriId,
      type: p.type,
      amount: p.amount,
      balanceBefore: before,
      balanceAfter: after,
      refType: p.refType,
      refId: p.refId,
      description: p.description,
      createdBy: p.actor?.id ?? 'SYSTEM',
      createdAt: todayISO(),
      idemKey: p.idemKey ?? uuid(),
    };
    mutate((d) => {
      d.walletTxs.push(tx);
      const w = d.wallets.find((x) => x.santriId === p.santriId);
      if (w) {
        w.balance = after;
        w.updatedAt = tx.createdAt;
      } else {
        d.wallets.push({ santriId: p.santriId, balance: after, updatedAt: tx.createdAt });
      }
    });
    audit(p.actor, tx.amount >= 0 ? 'WALLET_CREDIT' : 'WALLET_DEBIT', 'wallet_transactions', tx.id,
      `${p.type} ${rp(p.amount)} — ${p.description} (${balanceLabel(before)} → ${balanceLabel(after)})`);
    return tx;
  });
}

function balanceLabel(n: number): string {
  return rp(n);
}

/* ---------- operasi publik ---------- */

export async function topUp(p: {
  santriId: string;
  amount: number;
  method: 'CASH' | 'TRANSFER';
  note?: string;
  actor: User;
  idemKey?: string;
}): Promise<WalletTx> {
  if (p.amount < 1000) throw new Error('Nominal top up minimal Rp1.000.');
  const refId = uid('TPU');
  const santri = db.santri.find((s) => s.id === p.santriId);
  const tx = await postLedger({
    santriId: p.santriId,
    type: 'TOP_UP',
    amount: p.amount,
    refType: 'TOPUP',
    refId,
    description: `Top up ${p.method === 'CASH' ? 'tunai' : 'transfer bank'}${p.note ? ` — ${p.note}` : ''}`,
    actor: p.actor,
    idemKey: p.idemKey ?? uuid(),
  });
  if (santri && !p.note?.includes('awal tahun')) {
    notify({
      santri,
      title: 'Saldo bertambah',
      body: `Top up ${rp(p.amount)} berhasil. Saldo ${santri.nickname} sekarang ${rp(tx.balanceAfter)}.`,
      refType: 'TOPUP',
      refId,
    });
  }
  return tx;
}

export async function adjustment(p: {
  santriId: string;
  amount: number;
  reason: string;
  actor: User;
}): Promise<WalletTx> {
  if (!p.reason.trim()) throw new Error('Alasan penyesuaian wajib diisi (audit).');
  return postLedger({
    santriId: p.santriId,
    type: 'ADJUSTMENT',
    amount: p.amount,
    refType: 'MANUAL',
    refId: uid('ADJ'),
    description: `Koreksi saldo: ${p.reason}`,
    actor: p.actor,
  });
}

export async function refundToWallet(p: {
  santriId: string;
  amount: number;
  refId: string;
  description: string;
  actor: User;
  idemKey?: string;
}): Promise<WalletTx> {
  return postLedger({
    santriId: p.santriId,
    type: 'REFUND',
    amount: Math.abs(p.amount),
    refType: 'SALE',
    refId: p.refId,
    description: p.description,
    actor: p.actor,
    idemKey: p.idemKey ?? uuid(),
  });
}

export { balanceOf };
