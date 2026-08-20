/* ===== POS Service — penjualan multi-outlet dengan pembayaran saldo NFC =====
   - Harga & total dihitung SERVER-side dari katalog; payload client hanya productId + qty
   - Saldo divalidasi ulang di service; pemotongan parsial TIDAK diperbolehkan
   - Idempotency key mencegah transaksi ganda (termasuk double-submit & double-tap)
   - Komit all-or-nothing: jika satu validasi gagal, tidak ada yang dicatat
*/

import type { Sale, SaleItem, SaleMethod, User } from '../types';
import { db, mutate } from '../store';
import { rp, todayISO, uid, uuid } from '../util';
import { audit } from './audit';
import { notify, transactionMessage } from './notify';
import { ledgerBalance, postLedger } from './wallet';

export interface CartLine {
  productId: string;
  qty: number;
}

export interface CheckoutResult {
  sale: Sale;
  items: SaleItem[];
  balanceAfter?: number;
}

function saleNumber(d: Date): string {
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = db.sales.length + 1;
  return `TRX-${ymd}-${String(seq).padStart(4, '0')}`;
}

export async function checkout(p: {
  outletId: string;
  santriId?: string | null;
  method: SaleMethod;
  items: CartLine[];
  actor: User;
  idemKey?: string;
}): Promise<CheckoutResult> {
  const idemKey = p.idemKey ?? uuid();

  // 1) Idempotency: transaksi dengan key sama tidak diproses dua kali
  const dup = db.sales.find((s) => s.idemKey === idemKey);
  if (dup) return { sale: dup, items: db.saleItems.filter((i) => i.saleId === dup.id) };

  if (!p.items.length) throw new Error('Keranjang kosong.');

  // 2) Baca harga dari katalog (server-side) — tidak percaya harga dari frontend
  const lines: Array<{ product: (typeof db.products)[number]; qty: number; total: number }> = [];
  let total = 0;
  for (const line of p.items) {
    const product = db.products.find((x) => x.id === line.productId && !x.deletedAt);
    if (!product) throw new Error('Produk tidak ditemukan di katalog.');
    if (product.status !== 'aktif') throw new Error(`Produk "${product.name}" tidak aktif.`);
    if (product.outletId !== p.outletId) throw new Error(`Produk "${product.name}" tidak dijual di outlet ini.`);
    const qty = Math.max(1, Math.floor(line.qty));
    if (product.stock < qty && product.stock < 500) throw new Error(`Stok "${product.name}" tidak cukup (tersisa ${product.stock}).`);
    const lineTotal = product.price * qty;
    total += lineTotal;
    lines.push({ product, qty, total: lineTotal });
  }

  // 3) Validasi saldo NFC di server; tidak ada pemotongan parsial
  let balanceAfter: number | undefined;
  if (p.method === 'SALDO_NFC') {
    if (!p.santriId) throw new Error('Silakan tempelkan kartu santri terlebih dahulu.');
    const balance = ledgerBalance(p.santriId);
    if (balance < total) {
      throw new Error(`Saldo tidak mencukupi. Saldo ${rp(balance)}, total belanja ${rp(total)}.`);
    }
    balanceAfter = balance - total;
  }

  // 4) Komit atomik: sale + items + stok + inventory (simulasi DB transaction)
  const now = new Date();
  const sale: Sale = {
    id: uid('SLE'),
    number: saleNumber(now),
    outletId: p.outletId,
    santriId: p.santriId ?? undefined,
    cashierId: p.actor.id,
    method: p.method,
    subtotal: total,
    total,
    status: 'SUCCESS',
    idemKey,
    createdAt: now.toISOString(),
  };
  const items: SaleItem[] = lines.map((l) => ({
    id: uid('ITM'),
    saleId: sale.id,
    productId: l.product.id,
    name: l.product.name,
    price: l.product.price,
    cost: l.product.cost,
    qty: l.qty,
    total: l.total,
  }));

  mutate((d) => {
    d.sales.push(sale);
    d.saleItems.push(...items);
    for (const l of lines) {
      const prod = d.products.find((x) => x.id === l.product.id)!;
      if (prod.stock < 500) {
        prod.stock -= l.qty;
        d.inventoryTxs.unshift({
          id: uid('INV'), productId: prod.id, type: 'SALE', qty: -l.qty,
          note: `Penjualan ${sale.number}`, userId: p.actor.id, createdAt: sale.createdAt,
        });
      }
    }
  });

  // 5) Potong saldo via ledger (hanya untuk SALDO_NFC)
  if (p.method === 'SALDO_NFC' && p.santriId) {
    await postLedger({
      santriId: p.santriId,
      type: 'PURCHASE',
      amount: -total,
      refType: 'SALE',
      refId: sale.id,
      description: `Transaksi ${sale.number}`,
      actor: p.actor,
      idemKey: `sale-${sale.id}`,
    });
    const santri = db.santri.find((s) => s.id === p.santriId);
    if (santri) {
      const outlet = db.outlets.find((o) => o.id === p.outletId);
      notify({
        santri,
        title: `Transaksi ${sale.number}`,
        body: transactionMessage({
          santriName: santri.name,
          outletName: outlet?.name ?? 'Outlet',
          total,
          balanceAfter: balanceAfter!,
          when: sale.createdAt,
        }),
        refType: 'SALE',
        refId: sale.id,
      });
    }
  }

  audit(p.actor, 'SALE', 'sales', sale.id,
    `${sale.number} — ${items.length} item, ${rp(total)}, metode ${p.method}${p.santriId ? ` (${db.santri.find((s) => s.id === p.santriId)?.name})` : ''}`);

  return { sale, items, balanceAfter };
}

/** Refund penjualan — stok dikembalikan + saldo dikredit via ledger. */
export async function refundSale(saleId: string, actor: User, reason: string): Promise<Sale> {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) throw new Error('Transaksi tidak ditemukan.');
  if (sale.status === 'REFUNDED') throw new Error('Transaksi ini sudah pernah di-refund.');

  const items = db.saleItems.filter((i) => i.saleId === saleId);
  mutate((d) => {
    const s = d.sales.find((x) => x.id === saleId)!;
    s.status = 'REFUNDED';
    s.refundedAt = todayISO();
    for (const it of items) {
      const prod = d.products.find((p) => p.id === it.productId);
      if (prod && prod.stock < 500) {
        prod.stock += it.qty;
        d.inventoryTxs.unshift({
          id: uid('INV'), productId: prod.id, type: 'REFUND', qty: it.qty,
          note: `Refund ${sale.number}`, userId: actor.id, createdAt: s.refundedAt,
        });
      }
    }
  });

  if (sale.method === 'SALDO_NFC' && sale.santriId) {
    await postLedger({
      santriId: sale.santriId,
      type: 'REFUND',
      amount: sale.total,
      refType: 'SALE',
      refId: sale.id,
      description: `Refund ${sale.number}${reason ? ` — ${reason}` : ''}`,
      actor,
      idemKey: `refund-${sale.id}`,
    });
  }
  audit(actor, 'REFUND', 'sales', sale.id, `Refund ${sale.number} (${rp(sale.total)}) — ${reason || 'tanpa alasan'}`);
  return db.sales.find((s) => s.id === saleId)!;
}

export function todaySales(outletId?: string): Sale[] {
  const today = new Date().toDateString();
  return db.sales.filter(
    (s) => new Date(s.createdAt).toDateString() === today && (!outletId || s.outletId === outletId)
  );
}
