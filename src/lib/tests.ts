/* ===== Test suite otomatis — dijalankan terhadap service layer sungguhan.
   Mencakup: ledger, idempotency, saldo kurang, kartu diblokir, refund,
   transaksi konkuren, duplicate NFC scan, dan validasi harga server-side. */

import { db, mutate } from './store';
import { InsufficientBalanceError, ledgerBalance, postLedger } from './services/wallet';
import { checkout, refundSale } from './services/pos';
import { blockCard, issueCard } from './services/ops';
import { MockNfcReader, resolveCard } from './services/nfc';

export interface TestResult {
  name: string;
  group: string;
  pass: boolean;
  detail: string;
  ms: number;
}

const ACTOR = { id: 'U-03', username: 'bendahara', password: '', name: 'Ustdz. Rahmawati', role: 'BENDAHARA' as const, active: true };
const KASIR = { id: 'U-04', username: 'kasir', password: '', name: 'Bima Saputra', role: 'KASIR' as const, outletId: 'OUT-01', active: true };

function snapshot(): string {
  return JSON.stringify(db);
}
function restore(snap: string): void {
  const parsed = JSON.parse(snap) as typeof db;
  mutate((d) => {
    (Object.keys(d) as Array<keyof typeof db>).forEach((k) => delete d[k]);
    Object.assign(d, parsed);
  });
}

async function run(name: string, group: string, fn: () => Promise<string> | string): Promise<TestResult> {
  const snap = snapshot();
  const t0 = performance.now();
  try {
    const detail = await fn();
    return { name, group, pass: true, detail, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { name, group, pass: false, detail: e instanceof Error ? e.message : String(e), ms: Math.round(performance.now() - t0) };
  } finally {
    restore(snap);
  }
}

const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

export async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await run('Top up menambah saldo & mencatat ledger', 'Wallet', () => {
      const before = ledgerBalance('SAN-001');
      return postLedger({
        santriId: 'SAN-001', type: 'TOP_UP', amount: 50_000, refType: 'TOPUP', refId: 'T-1',
        description: 'Uji top up', actor: ACTOR, idemKey: 'test-topup-1',
      }).then((tx) => {
        const after = ledgerBalance('SAN-001');
        assert(after === before + 50_000, `Saldo ${after} != ${before} + 50000`);
        assert(tx.balanceBefore === before && tx.balanceAfter === after, 'before/after ledger salah');
        return `Ledger ${tx.id}: ${before} → ${after}`;
      });
    })
  );

  results.push(
    await run('Idempotency: key sama hanya diproses sekali', 'Wallet', async () => {
      const key = 'test-idem-77';
      const a = await postLedger({ santriId: 'SAN-002', type: 'TOP_UP', amount: 20_000, refType: 'TOPUP', refId: 'T-2', description: 'Uji idem', actor: ACTOR, idemKey: key });
      const b = await postLedger({ santriId: 'SAN-002', type: 'TOP_UP', amount: 20_000, refType: 'TOPUP', refId: 'T-2', description: 'Uji idem', actor: ACTOR, idemKey: key });
      const rows = db.walletTxs.filter((t) => t.idemKey === key);
      assert(rows.length === 1, `Ditemukan ${rows.length} baris ledger untuk key yang sama`);
      assert(a.id === b.id, 'Respons duplikat harus mengembalikan transaksi yang sama');
      return 'Duplikat dikembalikan dari transaksi pertama, tanpa ledger baru';
    })
  );

  results.push(
    await run('Saldo tidak mencukupi → ditolak total', 'Wallet', async () => {
      const before = ledgerBalance('SAN-004');
      let threw = false;
      try {
        await postLedger({ santriId: 'SAN-004', type: 'PURCHASE', amount: -(before + 5_000), refType: 'SALE', refId: 'T-3', description: 'Uji kurang', actor: KASIR, idemKey: 'test-insuf' });
      } catch (e) {
        threw = e instanceof InsufficientBalanceError;
      }
      assert(threw, 'Seharusnya melempar InsufficientBalanceError');
      assert(ledgerBalance('SAN-004') === before, 'Saldo berubah padahal transaksi gagal');
      assert(!db.walletTxs.some((t) => t.idemKey === 'test-insuf'), 'Ledger gagal tidak boleh tercatat');
      return 'Transaksi gagal, tidak ada pemotongan parsial, tidak ada ledger';
    })
  );

  results.push(
    await run('Transaksi konkuren: 10 top up paralel konsisten', 'Wallet', async () => {
      const before = ledgerBalance('SAN-005');
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          postLedger({ santriId: 'SAN-005', type: 'TOP_UP', amount: 1_000, refType: 'TOPUP', refId: `C-${i}`, description: `Konkuren ${i}`, actor: ACTOR, idemKey: `test-conc-${i}` })
        )
      );
      const after = ledgerBalance('SAN-005');
      assert(after === before + 10_000, `Saldo ${after} != ${before} + 10.000 (lock gagal)`);
      return `10 operasi paralel → saldo tepat +Rp10.000 (${before} → ${after})`;
    })
  );

  results.push(
    await run('Kartu diblokir tidak bisa transaksi', 'NFC', async () => {
      const card = db.cards.find((c) => c.santriId === 'SAN-002' && c.status === 'ACTIVE')!;
      blockCard(card.id, 'Uji blokir', { ...ACTOR, role: 'ADMIN' });
      const res = resolveCard(card.uid);
      assert('error' in res && !!res.error, 'Kartu diblokir harus ditolak');
      const santri = db.santri.find((s) => s.id === 'SAN-002')!;
      assert(santri.activeCardId === undefined, 'activeCardId harus dilepas');
      return `Ditolak: ${'error' in res ? res.error : ''}`;
    })
  );

  results.push(
    await run('UID duplikat pada kartu aktif ditolak', 'NFC', () => {
      const existing = db.cards.find((c) => c.status === 'ACTIVE')!;
      let threw = false;
      try {
        issueCard('SAN-004', existing.uid, { ...ACTOR, role: 'ADMIN' });
      } catch {
        threw = true;
      }
      assert(threw, 'UID yang sudah aktif seharusnya ditolak');
      return `UID ${existing.uid} tidak dapat dipakai dua kali`;
    })
  );

  results.push(
    await run('Duplicate NFC tap diabaikan (cooldown)', 'NFC', () => {
      const reader = new MockNfcReader();
      void reader.connect();
      let count = 0;
      reader.onCardDetected(() => count++);
      reader.simulateTap('04:A1:B2:C3:D4:E5:F6');
      reader.simulateTap('04:A1:B2:C3:D4:E5:F6');
      reader.simulateTap('04:A1:B2:C3:D4:E5:F6');
      assert(count === 1, `Terdeteksi ${count} kali, seharusnya 1`);
      return '3 tap cepat → hanya 1 event (anti transaksi ganda)';
    })
  );

  results.push(
    await run('Checkout memotong saldo & menulis ledger', 'POS', async () => {
      const before = ledgerBalance('SAN-001');
      const res = await checkout({
        outletId: 'OUT-01', santriId: 'SAN-001', method: 'SALDO_NFC',
        items: [{ productId: 'PRD-02', qty: 2 }], actor: KASIR, idemKey: 'test-pos-1',
      });
      assert(res.sale.total === 10_000, `Total ${res.sale.total} != 10.000 (harga server)`);
      assert(ledgerBalance('SAN-001') === before - 10_000, 'Saldo tidak terpotong tepat');
      return `${res.sale.number}: total ${res.sale.total}, saldo ${before} → ${before - 10_000}`;
    })
  );

  results.push(
    await run('Harga selalu dari katalog (server-side)', 'POS', async () => {
      const res = await checkout({
        outletId: 'OUT-01', santriId: 'SAN-001', method: 'SALDO_NFC',
        items: [{ productId: 'PRD-01', qty: 3 }], actor: KASIR, idemKey: 'test-pos-2',
      });
      const catalog = db.products.find((p) => p.id === 'PRD-01')!.price * 3;
      assert(res.sale.total === catalog, 'Total harus sama dengan harga katalog');
      return `Payload hanya berisi productId+qty; total diverifikasi = ${catalog}`;
    })
  );

  results.push(
    await run('Checkout saldo kurang → seluruhnya digagalkan', 'POS', async () => {
      const before = ledgerBalance('SAN-004');
      const beforeSales = db.sales.length;
      let msg = '';
      try {
        await checkout({
          outletId: 'OUT-01', santriId: 'SAN-004', method: 'SALDO_NFC',
          items: [{ productId: 'PRD-08', qty: 20 }], actor: KASIR, idemKey: 'test-pos-3',
        });
      } catch (e) {
        msg = e instanceof Error ? e.message : '';
      }
      assert(msg.includes('tidak mencukupi'), `Pesan salah: "${msg}"`);
      assert(db.sales.length === beforeSales, 'Sale gagal tidak boleh tercatat');
      assert(ledgerBalance('SAN-004') === before, 'Saldo berubah padahal gagal');
      return `"${msg}"`;
    })
  );

  results.push(
    await run('Refund mengembalikan saldo & stok, anti double-refund', 'POS', async () => {
      const before = ledgerBalance('SAN-002');
      const res = await checkout({
        outletId: 'OUT-01', santriId: 'SAN-002', method: 'SALDO_NFC',
        items: [{ productId: 'PRD-05', qty: 1 }], actor: KASIR, idemKey: 'test-pos-4',
      });
      const stockAfterBuy = db.products.find((p) => p.id === 'PRD-05')!.stock;
      await refundSale(res.sale.id, KASIR, 'Uji refund');
      assert(ledgerBalance('SAN-002') === before, 'Saldo harus kembali seperti semula');
      assert(db.products.find((p) => p.id === 'PRD-05')!.stock === stockAfterBuy + 1, 'Stok tidak kembali');
      let threw = false;
      try {
        await refundSale(res.sale.id, KASIR, 'Sekali lagi');
      } catch {
        threw = true;
      }
      assert(threw, 'Refund kedua seharusnya ditolak');
      return 'Saldo & stok pulih; refund kedua ditolak';
    })
  );

  return results;
}
