/* ===== Modul 8 & 9: Produk, Stok, Multi-Outlet ===== */

import { useMemo, useState } from 'react';
import type { Product, User } from '../lib/types';
import { db, outletById, useDB } from '../lib/store';
import { saveProduct, stockMove } from '../lib/services/ops';
import { cx, downloadFile, fmtDT, num, rp, toCSV } from '../lib/util';
import { Badge, Btn, Card, Empty, Field, inputCls, Modal, SearchBox, Tabs, THead, TRow, TD, TWrap, useToast } from '../components/ui';
import { PageHead } from '../components/layout';
import { IcBox, IcDownload, IcEdit, IcLayers, IcPlus, IcTag } from '../components/icons';

const emptyP = { sku: '', barcode: '', name: '', categoryId: 'CAT-1', outletId: 'OUT-01', price: 5000, cost: 3000, stock: 0, status: 'aktif' as const };

export default function CatalogPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [tab, setTab] = useState('produk');
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('');
  const [fOutlet, setFOutlet] = useState('');
  const [edit, setEdit] = useState<Product | null | 'new'>(null);
  const [move, setMove] = useState<Product | null>(null);

  const list = useMemo(
    () =>
      db.products
        .filter((p) => !p.deletedAt)
        .filter((p) => (!fCat || p.categoryId === fCat) && (!fOutlet || p.outletId === fOutlet))
        .filter((p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || p.barcode.includes(q)),
    [q, fCat, fOutlet]
  );
  const lowCount = list.filter((p) => p.stock < 15 && p.stock < 500).length;

  return (
    <div className="space-y-4">
      <PageHead
        title="Produk & Inventori"
        desc={`${list.length} produk · ${lowCount} stok menipis · tiap outlet punya katalog sendiri`}
        actions={
          <>
            <Btn variant="outline" size="sm" onClick={() => {
              downloadFile('produk.csv', toCSV(list.map((p) => ({
                sku: p.sku, barcode: p.barcode, nama: p.name, kategori: db.categories.find((c) => c.id === p.categoryId)?.name ?? '',
                outlet: outletById(p.outletId)?.name ?? '', harga_jual: p.price, harga_modal: p.cost, stok: p.stock, status: p.status,
              }))));
              toast.push('ok', 'Produk di-export', `${list.length} baris CSV`);
            }}><IcDownload size={14} /> Export</Btn>
            <Btn size="sm" onClick={() => setEdit('new')}><IcPlus size={14} /> Produk Baru</Btn>
          </>
        }
      />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {db.outlets.map((o) => {
          const count = db.products.filter((p) => p.outletId === o.id && !p.deletedAt).length;
          return (
            <button key={o.id} onClick={() => { setFOutlet(o.id); setTab('produk'); }} className={cx('rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md', fOutlet === o.id ? 'border-gold-400 bg-gold-50' : 'border-line bg-surface')}>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mute"><IcLayers size={14} /> {o.code}</span>
              <span className="font-display mt-1 block text-[15px] font-bold">{o.name}</span>
              <span className="text-[11px] text-mute">{count} produk · {o.kind}</span>
            </button>
          );
        })}
      </div>

      <Tabs tabs={[{ key: 'produk', label: 'Katalog Produk' }, { key: 'mutasi', label: 'Riwayat Stok' }]} active={tab} onChange={setTab} />

      {tab === 'produk' && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="w-full sm:w-60"><SearchBox value={q} onChange={setQ} placeholder="Cari nama / SKU / barcode…" /></div>
            <select className={cx(inputCls, 'w-auto')} value={fCat} onChange={(e) => setFCat(e.target.value)}>
              <option value="">Semua kategori</option>
              {db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={cx(inputCls, 'w-auto')} value={fOutlet} onChange={(e) => setFOutlet(e.target.value)}>
              <option value="">Semua outlet</option>
              {db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <TWrap>
            <THead cols={['Produk', 'SKU / Barcode', 'Kategori', 'Outlet', 'Harga Jual', 'Modal', 'Stok', 'Status', 'Aksi']} />
            <tbody>
              {list.map((p) => (
                <TRow key={p.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: p.color }}><IcBox size={15} /></span>
                      <span className="font-bold">{p.name}</span>
                    </div>
                  </TD>
                  <TD className="text-[11.5px] text-mute tnum">{p.sku}<br />{p.barcode}</TD>
                  <TD><Badge tone="mute"><IcTag size={11} /> {db.categories.find((c) => c.id === p.categoryId)?.name}</Badge></TD>
                  <TD>{outletById(p.outletId)?.code}</TD>
                  <TD className="font-bold tnum">{rp(p.price)}</TD>
                  <TD className="tnum text-mute">{rp(p.cost)}</TD>
                  <TD>
                    {p.stock >= 500 ? <Badge tone="ok">∞ tersedia</Badge> : p.stock < 15 ? <Badge tone="warn">{p.stock} · menipis</Badge> : <span className="font-bold tnum">{p.stock}</span>}
                  </TD>
                  <TD><Badge tone={p.status === 'aktif' ? 'ok' : 'mute'}>{p.status}</Badge></TD>
                  <TD>
                    <div className="flex gap-1">
                      <Btn variant="outline" size="sm" onClick={() => setMove(p)}>Stok</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setEdit(p)}><IcEdit size={13} /></Btn>
                    </div>
                  </TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
          {list.length === 0 && <Empty title="Tidak ada produk" desc="Ubah filter atau tambah produk baru." />}
        </Card>
      )}

      {tab === 'mutasi' && (
        <Card pad={false} title="Riwayat mutasi stok" sub="Stok masuk, keluar, adjustment, penjualan, dan refund">
          <TWrap>
            <THead cols={['Waktu', 'Produk', 'Jenis', 'Qty', 'Stok Akhir', 'Catatan', 'Petugas']} />
            <tbody>
              {db.inventoryTxs.slice(0, 40).map((t) => {
                const p = db.products.find((x) => x.id === t.productId);
                return (
                  <TRow key={t.id}>
                    <TD className="tnum text-mute">{fmtDT(t.createdAt)}</TD>
                    <TD className="font-semibold">{p?.name ?? t.productId}</TD>
                    <TD><Badge tone={t.type === 'IN' || t.type === 'REFUND' ? 'ok' : t.type === 'ADJUST' ? 'warn' : 'info'}>{t.type}</Badge></TD>
                    <TD className={cx('font-bold tnum', t.qty >= 0 ? 'text-ok' : 'text-danger')}>{t.qty > 0 ? '+' : ''}{t.qty}</TD>
                    <TD className="tnum">{p && p.stock < 500 ? p.stock : '∞'}</TD>
                    <TD className="max-w-52 truncate text-mute">{t.note}</TD>
                    <TD className="text-mute">{db.users.find((u) => u.id === t.userId)?.name ?? '-'}</TD>
                  </TRow>
                );
              })}
            </tbody>
          </TWrap>
        </Card>
      )}

      {edit && <ProductForm initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} actor={user} />}
      {move && <StockModal product={move} onClose={() => setMove(null)} user={user} />}
    </div>
  );
}

function ProductForm({ initial, onClose, actor }: { initial: Product | null; onClose: () => void; actor: User }) {
  const toast = useToast();
  const [, setV] = useState(0);
  const [f, setF] = useState(() =>
    initial
      ? { sku: initial.sku, barcode: initial.barcode, name: initial.name, categoryId: initial.categoryId, outletId: initial.outletId, price: initial.price, cost: initial.cost, stock: initial.stock, status: initial.status }
      : emptyP
  );
  const set = (k: string, v: string | number) => {
    setF((x) => ({ ...x, [k]: v }));
    setV((v0) => v0 + 1);
  };
  return (
    <Modal open onClose={onClose} title={initial ? `Ubah produk — ${initial.name}` : 'Produk baru'} w="max-w-xl"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn onClick={() => {
            try {
              saveProduct({ ...f, id: initial?.id }, actor);
              toast.push('ok', initial ? 'Produk diperbarui' : 'Produk ditambahkan', f.name);
              onClose();
            } catch (e) {
              toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
            }
          }}>Simpan</Btn>
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nama produk" req><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field></div>
        <Field label="SKU"><input className={inputCls} value={f.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field label="Barcode"><input className={inputCls} value={f.barcode} onChange={(e) => set('barcode', e.target.value)} /></Field>
        <Field label="Kategori">
          <select className={inputCls} value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Outlet">
          <select className={inputCls} value={f.outletId} onChange={(e) => set('outletId', e.target.value)}>
            {db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Harga jual (Rp)" req><input type="number" className={inputCls} value={f.price} onChange={(e) => set('price', Number(e.target.value))} /></Field>
        <Field label="Harga modal (Rp)"><input type="number" className={inputCls} value={f.cost} onChange={(e) => set('cost', Number(e.target.value))} /></Field>
        <Field label="Stok awal"><input type="number" className={inputCls} value={f.stock} onChange={(e) => set('stock', Number(e.target.value))} /></Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="aktif">aktif</option><option value="nonaktif">nonaktif</option>
          </select>
        </Field>
      </div>
      <p className="mt-3 text-[11px] text-mute">Perubahan harga jual otomatis tercatat di audit log (PRICE_CHANGE).</p>
    </Modal>
  );
}

function StockModal({ product, onClose, user }: { product: Product; onClose: () => void; user: User }) {
  const toast = useToast();
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [qty, setQty] = useState(10);
  const [note, setNote] = useState('');
  const history = db.inventoryTxs.filter((t) => t.productId === product.id).slice(0, 8);
  return (
    <Modal open onClose={onClose} title={`Mutasi stok — ${product.name}`} w="max-w-md"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Tutup</Btn>
          <Btn onClick={() => {
            try {
              stockMove(product.id, type, qty, note, user);
              toast.push('ok', 'Stok diperbarui', `${type} ${qty} · tercatat di riwayat & audit`);
              setNote('');
            } catch (e) {
              toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
            }
          }}>Simpan Mutasi</Btn>
        </>
      }>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-line bg-bg p-3">
          <span className="text-xs font-bold">Stok saat ini</span>
          <span className="font-display text-lg font-bold tnum">{product.stock >= 500 ? '∞' : product.stock}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['IN', 'OUT', 'ADJUST'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={cx('rounded-lg border py-2 text-xs font-bold', type === t ? 'border-navy-800 bg-navy-800 text-white' : 'border-line text-mute')}>
              {t === 'IN' ? 'Stok Masuk' : t === 'OUT' ? 'Stok Keluar' : 'Adjustment'}
            </button>
          ))}
        </div>
        <Field label="Qty" req><input type="number" className={inputCls} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
        <Field label="Catatan"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth: kiriman supplier" /></Field>
        {history.length > 0 && (
          <div className="rounded-lg border border-line p-2 text-[11px]">
            <p className="mb-1 font-bold text-mute">Riwayat terbaru</p>
            {history.map((h) => (
              <div key={h.id} className="flex justify-between py-0.5">
                <span className="text-mute">{fmtDT(h.createdAt)}</span>
                <span className={cx('font-bold tnum', h.qty >= 0 ? 'text-ok' : 'text-danger')}>{h.type} {h.qty > 0 ? '+' : ''}{h.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
