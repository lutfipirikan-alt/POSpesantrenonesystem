/* ===== Modul 6: POS Koperasi/Kantin =====
   Alur kasir: SCAN NFC → PILIH BARANG → BAYAR → SELESAI
   Harga dari katalog server · saldo divalidasi server · idempotency per checkout. */

import { useMemo, useState } from 'react';
import type { Sale, SaleItem, SaleMethod, User } from '../lib/types';
import { balanceOf, db, outletById, useDB } from '../lib/store';
import { checkout, refundSale } from '../lib/services/pos';
import { resolveCard } from '../lib/services/nfc';
import { cx, fmtTime, rp, uuid } from '../lib/util';
import { Avatar, Badge, Btn, Card, Empty, Modal, SearchBox, Spinner, useToast, useNfcScan } from '../components/ui';
import { IcAlert, IcCard, IcCart, IcMinus, IcPlus, IcPrinter, IcScan, IcTrash, IcX } from '../components/icons';
import { SantriChip } from '../components/layout';

interface Line {
  productId: string;
  qty: number;
}

export default function PosPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const outletId = user.outletId ?? 'OUT-01';
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [santriId, setSantriId] = useState<string | null>(null);
  const [method, setMethod] = useState<SaleMethod>('SALDO_NFC');
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState<{ sale: Sale; items: SaleItem[]; balanceAfter?: number } | null>(null);
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [insufficient, setInsufficient] = useState<{ balance: number; total: number } | null>(null);

  const products = useMemo(
    () =>
      db.products
        .filter((p) => p.outletId === outletId && !p.deletedAt && p.status === 'aktif')
        .filter((p) => !cat || p.categoryId === cat)
        .filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()) || p.sku.toLowerCase().includes(q.trim().toLowerCase())),
    [outletId, cat, q]
  );
  const cats = db.categories.filter((c) => products.some((p) => p.categoryId === c.id) || !cat);

  const santri = santriId ? db.santri.find((s) => s.id === santriId) : undefined;
  const saldo = santri ? balanceOf(santri.id) : 0;
  const total = cart.reduce((a, l) => a + (db.products.find((p) => p.id === l.productId)?.price ?? 0) * l.qty, 0);
  const itemCount = cart.reduce((a, l) => a + l.qty, 0);

  useNfcScan((uid) => {
    const res = resolveCard(uid);
    if ('error' in res) return;
    setSantriId(res.santri.id);
    setScanning(false);
    setInsufficient(null);
  });

  const add = (productId: string) => {
    setCart((c) => {
      const ex = c.find((l) => l.productId === productId);
      if (ex) return c.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { productId, qty: 1 }];
    });
    setInsufficient(null);
  };
  const setQty = (productId: string, qty: number) =>
    setCart((c) => (qty <= 0 ? c.filter((l) => l.productId !== productId) : c.map((l) => (l.productId === productId ? { ...l, qty } : l))));

  const pay = async () => {
    if (!cart.length || processing) return;
    setProcessing(true);
    setInsufficient(null);
    try {
      const res = await checkout({
        outletId,
        santriId: method === 'SALDO_NFC' ? santriId : null,
        method,
        items: cart,
        actor: user,
        idemKey: uuid(),
      });
      setReceipt(res);
      setCart([]);
      if (method === 'SALDO_NFC') setSantriId(null);
      toast.push('ok', `Transaksi ${res.sale.number} berhasil`, `${res.items.length} item · ${rp(res.sale.total)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaksi gagal';
      if (msg.includes('tidak mencukupi') && santri) setInsufficient({ balance: saldo, total });
      toast.push('err', 'Transaksi ditolak', msg);
    } finally {
      setProcessing(false);
    }
  };

  const doRefund = async () => {
    if (!refundTarget) return;
    try {
      await refundSale(refundTarget.id, user, refundReason || 'Refund kasir');
      toast.push('ok', 'Refund berhasil', `${refundTarget.number} — stok & saldo dikembalikan.`);
      setRefundTarget(null);
    } catch (e) {
      toast.push('err', 'Refund ditolak', e instanceof Error ? e.message : '');
    }
  };

  const recent = [...db.sales].filter((s) => s.outletId === outletId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {/* ===== kiri: produk ===== */}
      <div className="space-y-3 xl:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder="Cari produk / SKU…" /></div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCat('')} className={cx('rounded-full border px-3 py-1 text-xs font-bold transition-all', !cat ? 'border-navy-800 bg-navy-800 text-white' : 'border-line bg-surface text-mute hover:text-ink')}>
              Semua
            </button>
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={cx('rounded-full border px-3 py-1 text-xs font-bold transition-all', cat === c.id ? 'border-navy-800 bg-navy-800 text-white' : 'border-line bg-surface text-mute hover:text-ink')}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const inCart = cart.find((l) => l.productId === p.id)?.qty ?? 0;
            const low = p.stock < 15 && p.stock < 500;
            return (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className={cx(
                  'group relative rounded-xl border bg-surface p-3 text-left shadow-[0_1px_2px_rgba(16,29,51,0.05)] transition-all hover:-translate-y-0.5 hover:border-navy-400 hover:shadow-md',
                  inCart ? 'border-gold-400 ring-2 ring-gold-100' : 'border-line'
                )}
              >
                {inCart > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-bold text-navy-950 shadow tnum">
                    {inCart}
                  </span>
                )}
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: p.color }}>
                  <IcCart size={16} />
                </span>
                <p className="mt-2 line-clamp-2 min-h-8 text-[12.5px] font-bold leading-tight">{p.name}</p>
                <p className="font-display mt-1 text-[15px] font-bold text-navy-800 tnum">{rp(p.price)}</p>
                <p className={cx('mt-0.5 text-[10.5px] font-semibold tnum', low ? 'text-warn' : 'text-mute')}>
                  {p.stock >= 500 ? 'Tersedia' : `Stok ${p.stock}`}
                </p>
              </button>
            );
          })}
        </div>
        {products.length === 0 && <Empty title="Tidak ada produk" desc="Tambahkan produk untuk outlet ini dari halaman Produk & Stok." />}
      </div>

      {/* ===== kanan: santri + keranjang ===== */}
      <div className="space-y-3 xl:col-span-2">
        <Card pad={false}>
          <div className={cx('relative overflow-hidden rounded-t-xl p-4', santri ? 'bg-navy-900' : 'bg-navy-950')}>
            <div className="motif absolute inset-0" />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-300">Santri</p>
              {!santri ? (
                <button
                  onClick={() => setScanning((s) => !s)}
                  className={cx('mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 transition-all', scanning ? 'border-gold-400 bg-navy-900' : 'border-navy-700 hover:border-navy-500')}
                >
                  <IcScan size={22} className={cx(scanning ? 'text-gold-300' : 'text-navy-400')} />
                  <span className="text-left">
                    <span className="block text-sm font-bold text-white">{scanning ? 'Menunggu tempelan kartu…' : 'Scan Kartu NFC'}</span>
                    <span className="block text-[11px] text-navy-300">Tempel kartu santri di NFC Simulator</span>
                  </span>
                </button>
              ) : (
                <div className="anim-pop mt-2 flex items-center gap-3">
                  <span className="pulse-ring rounded-full">
                    <Avatar name={santri.name} color={santri.color} size={54} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-[15px] font-bold text-white">{santri.name}</p>
                    <p className="text-[11px] text-navy-300 tnum">NIS: {santri.nis} · Kelas: {db.kelas.find((k) => k.id === santri.kelasId)?.name}</p>
                    <p className="font-display mt-1 text-2xl font-bold leading-none text-gold-300 tnum">{rp(saldo)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-navy-400">Saldo</p>
                  </div>
                  <button className="rounded-md p-1.5 text-navy-400 hover:bg-navy-800 hover:text-white" onClick={() => { setSantriId(null); setInsufficient(null); }} title="Lepas kartu">
                    <IcX size={15} />
                  </button>
                </div>
              )}
              {scanning && <span className="scan-beam" />}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-mute">Keranjang ({itemCount} item)</p>
              {cart.length > 0 && (
                <button className="text-[11px] font-bold text-danger hover:underline" onClick={() => setCart([])}>Kosongkan</button>
              )}
            </div>
            {cart.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line py-6 text-center text-xs text-mute">
                Klik produk di sebelah kiri untuk menambahkan
              </div>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-auto pr-1">
                {cart.map((l) => {
                  const p = db.products.find((x) => x.id === l.productId);
                  if (!p) return null;
                  return (
                    <div key={l.productId} className="anim-pop flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{p.name}</p>
                        <p className="text-[10.5px] text-mute tnum">{rp(p.price)} × {l.qty}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="rounded-md border border-line bg-surface p-1 hover:border-navy-300" onClick={() => setQty(l.productId, l.qty - 1)}><IcMinus size={11} /></button>
                        <span className="w-6 text-center text-xs font-bold tnum">{l.qty}</span>
                        <button className="rounded-md border border-line bg-surface p-1 hover:border-navy-300" onClick={() => setQty(l.productId, l.qty + 1)}><IcPlus size={11} /></button>
                        <button className="ml-1 rounded-md p-1 text-mute hover:bg-dangerbg hover:text-danger" onClick={() => setQty(l.productId, 0)}><IcTrash size={12} /></button>
                      </div>
                      <span className="w-16 text-right text-xs font-bold tnum">{rp(p.price * l.qty)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 space-y-1 border-t border-dashed border-line pt-3 text-[13px]">
              <div className="flex justify-between text-mute"><span>Subtotal</span><span className="tnum">{rp(total)}</span></div>
              <div className="flex items-center justify-between">
                <span className="font-display text-base font-bold">TOTAL</span>
                <span className="font-display text-2xl font-bold text-navy-800 tnum">{rp(total)}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-bg p-1">
              {(['SALDO_NFC', 'CASH'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={cx('rounded-md py-1.5 text-xs font-bold transition-all', method === m ? 'bg-navy-800 text-white shadow' : 'text-mute hover:text-ink')}>
                  {m === 'SALDO_NFC' ? 'SALDO NFC' : 'TUNAI'}
                </button>
              ))}
            </div>

            {insufficient && (
              <div className="anim-pop mt-3 flex items-start gap-2 rounded-lg border border-dangerln bg-dangerbg p-3 text-xs font-bold text-danger">
                <IcAlert size={16} className="mt-0.5 shrink-0" />
                <span>
                  Saldo tidak mencukupi. Saldo {rp(insufficient.balance)}, total {rp(insufficient.total)}. Tidak ada pemotongan parsial — silakan kurangi item atau top up dulu.
                </span>
              </div>
            )}

            <Btn
              variant={method === 'SALDO_NFC' ? 'gold' : 'ok'}
              size="lg"
              className="mt-3 w-full text-[15px]"
              disabled={!cart.length || processing || (method === 'SALDO_NFC' && !santri)}
              onClick={pay}
            >
              {processing ? <Spinner size={16} /> : <IcCard size={17} />}
              {method === 'SALDO_NFC' ? 'BAYAR DENGAN SALDO' : 'BAYAR TUNAI'}
            </Btn>
            {method === 'SALDO_NFC' && !santri && <p className="mt-1.5 text-center text-[11px] text-mute">Tempel kartu santri untuk mengaktifkan pembayaran saldo</p>}
          </div>
        </Card>

        <Card title={`Transaksi terakhir · ${outletById(outletId)?.name ?? ''}`} pad={false}>
          {recent.length === 0 ? <Empty title="Belum ada transaksi" /> : (
            <div className="divide-y divide-line/70">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold tnum">{s.number} {s.status === 'REFUNDED' && <Badge tone="warn">REFUND</Badge>}</p>
                    <p className="text-[10.5px] text-mute">
                      {fmtTime(s.createdAt)} · {s.santriId ? db.santri.find((x) => x.id === s.santriId)?.name : 'Tunai'} · {s.method === 'SALDO_NFC' ? 'Saldo' : 'Cash'}
                    </p>
                  </div>
                  <span className="text-xs font-bold tnum">{rp(s.total)}</span>
                  {s.status === 'SUCCESS' && s.method === 'SALDO_NFC' && (
                    <button className="text-[10.5px] font-bold text-danger hover:underline" onClick={() => { setRefundTarget(s); setRefundReason(''); }}>Refund</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* struk */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Bukti transaksi" w="max-w-sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => window.print()}><IcPrinter size={14} /> Cetak</Btn>
            <Btn variant="gold" onClick={() => setReceipt(null)}>Transaksi Baru</Btn>
          </>
        }>
        {receipt && (
          <div className="print-area rounded-lg border border-dashed border-navy-300 p-4 font-mono text-[12px]">
            <p className="text-center font-bold">{db.settings.pesantren.toUpperCase()}</p>
            <p className="text-center text-[10px]">{outletById(receipt.sale.outletId)?.name}</p>
            <div className="my-2 border-t border-dashed border-line" />
            <p className="flex justify-between"><span>No</span><b>{receipt.sale.number}</b></p>
            <p className="flex justify-between"><span>Kasir</span><b>{user.name}</b></p>
            {receipt.sale.santriId && <p className="flex justify-between"><span>Santri</span><b>{db.santri.find((s) => s.id === receipt.sale.santriId)?.name}</b></p>}
            <p className="flex justify-between"><span>Waktu</span><b>{fmtTime(receipt.sale.createdAt)}</b></p>
            <div className="my-2 border-t border-dashed border-line" />
            {receipt.items.map((i) => (
              <p key={i.id} className="flex justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">{i.qty}× {i.name}</span>
                <b className="tnum">{rp(i.total)}</b>
              </p>
            ))}
            <div className="my-2 border-t border-dashed border-line" />
            <p className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><b className="tnum">{rp(receipt.sale.total)}</b></p>
            <p className="flex justify-between"><span>Metode</span><b>{receipt.sale.method === 'SALDO_NFC' ? 'SALDO NFC' : 'TUNAI'}</b></p>
            {receipt.balanceAfter !== undefined && <p className="flex justify-between"><span>Saldo tersisa</span><b className="tnum">{rp(receipt.balanceAfter)}</b></p>}
            <div className="my-2 border-t border-dashed border-line" />
            <p className="text-center text-[10px] text-mute">Terima kasih · saldo tersimpan aman di server</p>
          </div>
        )}
      </Modal>

      {/* refund */}
      <Modal open={!!refundTarget} onClose={() => setRefundTarget(null)} title="Refund transaksi" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setRefundTarget(null)}>Batal</Btn>
            <Btn variant="danger" onClick={doRefund}>Proses Refund</Btn>
          </>
        }>
        {refundTarget && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-bg p-3 text-[13px]">
              <div className="flex items-center justify-between"><b className="tnum">{refundTarget.number}</b><b className="tnum">{rp(refundTarget.total)}</b></div>
              <div className="mt-1"><SantriChip id={refundTarget.santriId} size="sm" /></div>
            </div>
            <input className="w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-navy-400" placeholder="Alasan refund (wajib untuk audit)" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
            <p className="text-[11px] text-mute">Stok dikembalikan dan saldo santri dikredit via ledger REFUND. Double-refund dicegah oleh sistem.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
