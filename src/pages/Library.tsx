/* ===== Modul 11: Perpustakaan — peminjaman via NFC, denda otomatis ===== */

import { useState } from 'react';
import type { User } from '../lib/types';
import { db, useDB } from '../lib/store';
import { createLoan, returnLoan } from '../lib/services/ops';
import { resolveCard } from '../lib/services/nfc';
import { cx, fmtDate, rp } from '../lib/util';
import { Badge, Btn, Card, Empty, Field, inputCls, Modal, SearchBox, Spinner, Tabs, THead, TRow, TD, TWrap, useToast, useNfcScan } from '../components/ui';
import { PageHead, SantriChip } from '../components/layout';
import { IcBook, IcCard, IcScan } from '../components/icons';

const FINE_PER_DAY = 500;

export default function LibraryPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [tab, setTab] = useState('buku');
  const [q, setQ] = useState('');
  const [loan, setLoan] = useState<{ bookId: string; santriId: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useNfcScan((uid) => {
    if (!loan) return;
    const res = resolveCard(uid);
    if ('error' in res) return;
    setLoan((l) => (l ? { ...l, santriId: res.santri.id } : l));
  });

  const books = db.books.filter((b) => !q.trim() || b.title.toLowerCase().includes(q.toLowerCase()) || b.author.toLowerCase().includes(q.toLowerCase()) || b.category.toLowerCase().includes(q.toLowerCase()));
  const activeLoans = db.loans.filter((l) => l.status === 'DIPINJAM');
  const overdue = activeLoans.filter((l) => new Date(l.dueDate).getTime() < Date.now());

  return (
    <div className="space-y-4">
      <PageHead title="Perpustakaan" desc={`Santri diidentifikasi via kartu NFC · denda keterlambatan ${rp(FINE_PER_DAY)}/hari dipotong otomatis dari saldo`} />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => setTab('buku')} className="rounded-xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-[11px] font-bold uppercase tracking-wide text-mute">Judul</span>
          <span className="font-display mt-1 block text-xl font-bold tnum">{db.books.length}</span>
        </button>
        <button onClick={() => setTab('pinjam')} className="rounded-xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-[11px] font-bold uppercase tracking-wide text-mute">Dipinjam</span>
          <span className="font-display mt-1 block text-xl font-bold text-info tnum">{activeLoans.length}</span>
        </button>
        <button onClick={() => setTab('pinjam')} className="rounded-xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-[11px] font-bold uppercase tracking-wide text-mute">Terlambat</span>
          <span className="font-display mt-1 block text-xl font-bold text-danger tnum">{overdue.length}</span>
        </button>
        <div className="rounded-xl border border-line bg-surface p-4">
          <span className="text-[11px] font-bold uppercase tracking-wide text-mute">Potensi denda</span>
          <span className="font-display mt-1 block text-xl font-bold text-warn tnum">
            {rp(overdue.reduce((a, l) => a + Math.max(0, Math.floor((Date.now() - new Date(l.dueDate).getTime()) / 86400_000)) * FINE_PER_DAY, 0))}
          </span>
        </div>
      </div>

      <Tabs tabs={[{ key: 'buku', label: 'Katalog Buku' }, { key: 'pinjam', label: `Peminjaman Aktif (${activeLoans.length})` }, { key: 'riwayat', label: 'Riwayat' }]} active={tab} onChange={setTab} />

      {tab === 'buku' && (
        <Card pad={false} action={<div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Cari judul / penulis / kategori" /></div>}>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {books.map((b) => (
              <div key={b.id} className="group flex flex-col rounded-xl border border-line bg-bg p-3.5 transition-all hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="font-display flex h-12 w-9 shrink-0 items-center justify-center rounded-[4px] text-sm font-bold text-white shadow-sm" style={{ background: b.color }}>
                    {b.title[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug">{b.title}</p>
                    <p className="truncate text-[11px] text-mute">{b.author}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <Badge tone="mute">{b.category}</Badge>
                  <span className={cx('text-[11px] font-bold tnum', b.available === 0 ? 'text-danger' : 'text-mute')}>{b.available}/{b.copies} tersedia</span>
                </div>
                <Btn size="sm" variant={b.available === 0 ? 'outline' : 'primary'} className="mt-2.5" disabled={b.available === 0} onClick={() => setLoan({ bookId: b.id, santriId: '' })}>
                  <IcBook size={13} /> Pinjamkan
                </Btn>
              </div>
            ))}
          </div>
          {books.length === 0 && <Empty title="Buku tidak ditemukan" />}
        </Card>
      )}

      {tab === 'pinjam' && (
        <Card pad={false}>
          {activeLoans.length === 0 ? <Empty title="Tidak ada peminjaman aktif" icon={<IcBook size={20} />} /> : (
            <TWrap>
              <THead cols={['Buku', 'Santri', 'Pinjam', 'Jatuh Tempo', 'Denda Berjalan', 'Aksi']} />
              <tbody>
                {activeLoans.map((l) => {
                  const late = Math.max(0, Math.floor((Date.now() - new Date(l.dueDate).getTime()) / 86400_000));
                  return (
                    <TRow key={l.id}>
                      <TD className="font-semibold">{db.books.find((b) => b.id === l.bookId)?.title}</TD>
                      <TD><SantriChip id={l.santriId} size="sm" /></TD>
                      <TD className="tnum">{fmtDate(l.loanDate)}</TD>
                      <TD className={cx('tnum', late > 0 && 'font-bold text-danger')}>{fmtDate(l.dueDate)} {late > 0 && `(+${late} hr)`}</TD>
                      <TD className={cx('font-bold tnum', late > 0 ? 'text-warn' : 'text-mute')}>{rp(late * FINE_PER_DAY)}</TD>
                      <TD>
                        <Btn size="sm" variant="ok" disabled={busy === l.id} onClick={async () => {
                          setBusy(l.id);
                          try {
                            const res = await returnLoan(l.id, user);
                            toast.push('ok', 'Buku dikembalikan', res.fine > 0 ? `Denda ${rp(res.fine)} ${res.finePaid ? 'dipotong dari saldo' : 'BELUM terbayar — saldo kurang'}` : 'Tepat waktu, tanpa denda.');
                          } catch (e) {
                            toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
                          } finally {
                            setBusy(null);
                          }
                        }}>{busy === l.id ? <Spinner size={13} /> : 'Kembalikan'}</Btn>
                      </TD>
                    </TRow>
                  );
                })}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'riwayat' && (
        <Card pad={false}>
          <TWrap>
            <THead cols={['Buku', 'Santri', 'Pinjam', 'Kembali', 'Denda', 'Status Denda']} />
            <tbody>
              {db.loans.filter((l) => l.status === 'KEMBALI').map((l) => (
                <TRow key={l.id}>
                  <TD className="font-semibold">{db.books.find((b) => b.id === l.bookId)?.title}</TD>
                  <TD><SantriChip id={l.santriId} size="sm" /></TD>
                  <TD className="tnum">{fmtDate(l.loanDate)}</TD>
                  <TD className="tnum">{l.returnDate ? fmtDate(l.returnDate) : '-'}</TD>
                  <TD className="font-bold tnum">{rp(l.fine)}</TD>
                  <TD>{l.fine === 0 ? <Badge tone="mute">-</Badge> : l.finePaid ? <Badge tone="ok">LUNAS (saldo)</Badge> : <Badge tone="danger">BELUM</Badge>}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
      )}

      <Modal open={!!loan} onClose={() => setLoan(null)} title="Peminjaman buku" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setLoan(null)}>Batal</Btn>
            <Btn disabled={!loan?.santriId} onClick={() => {
              if (!loan) return;
              try {
                createLoan(loan.bookId, loan.santriId, user);
                toast.push('ok', 'Buku dipinjamkan', `"${db.books.find((b) => b.id === loan.bookId)?.title}" — kembali maks. 7 hari.`);
                setLoan(null);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              }
            }}>Pinjamkan</Btn>
          </>
        }>
        {loan && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-bg p-3">
              <p className="text-sm font-bold">{db.books.find((b) => b.id === loan.bookId)?.title}</p>
              <p className="text-[11px] text-mute">{db.books.find((b) => b.id === loan.bookId)?.author} · tersedia {db.books.find((b) => b.id === loan.bookId)?.available}</p>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-dashed border-navy-200 bg-navy-950 p-3">
              {loan.santriId ? (
                <div className="anim-pop flex items-center gap-2">
                  <SantriChip id={loan.santriId} />
                  <span className="ml-auto text-[10.5px] text-ok">kartu terbaca ✓</span>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-xs text-navy-300"><IcScan size={16} className="text-gold-300" /> Tempel kartu santri…</p>
              )}
            </div>
            <Field label="Atau pilih manual">
              <select className={inputCls} value={loan.santriId} onChange={(e) => setLoan({ ...loan, santriId: e.target.value })}>
                <option value="">— santri —</option>
                {db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <p className="flex items-start gap-2 text-[11px] text-mute"><IcCard size={14} className="mt-0.5 shrink-0" /> Denda {rp(FINE_PER_DAY)}/hari keterlambatan dipotong otomatis dari saldo saat pengembalian.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
