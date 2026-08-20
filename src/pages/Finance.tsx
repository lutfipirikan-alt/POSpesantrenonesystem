/* ===== Modul 4 & 5 & 16: Ledger saldo, Top Up, Tagihan Pesantren ===== */

import { useMemo, useState } from 'react';
import type { Invoice, User } from '../lib/types';
import { db, kelasById, santriById, useDB } from '../lib/store';
import { adjustment, balanceOf, ledgerBalance, topUp } from '../lib/services/wallet';
import { resolveCard } from '../lib/services/nfc';
import { cancelInvoice, createInvoice, payInvoice } from '../lib/services/ops';
import { cx, downloadFile, fmtDate, fmtDT, fmtTime, rp, toCSV, uuid } from '../lib/util';
import {
  Avatar, Badge, Btn, Card, Empty, Field, inputCls, Modal, SearchBox, Spinner,
  Stat, statusTone, Tabs, THead, TRow, TD, TWrap, useToast, useNfcScan,
} from '../components/ui';
import { PageHead, SantriChip } from '../components/layout';
import { IcCard, IcDownload, IcInfo, IcPlus, IcPrinter, IcScan, IcTag, IcWallet } from '../components/icons';

const QUICK = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000];

/* ================= TOP UP ================= */

export function TopUpPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [santriId, setSantriId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(50_000);
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [note, setNote] = useState('');
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [receipt, setReceipt] = useState<{ santriName: string; amount: number; before: number; after: number; method: string; at: string; id: string } | null>(null);

  useNfcScan((uid) => {
    const res = resolveCard(uid);
    if ('error' in res) return;
    setSantriId(res.santri.id);
    setScanning(false);
  });

  const santri = santriById(santriId ?? undefined);
  const recent = db.walletTxs.filter((t) => t.type === 'TOP_UP').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  const doTopUp = async () => {
    if (!santri) return;
    setProcessing(true);
    const key = uuid();
    const before = ledgerBalance(santri.id);
    try {
      const tx = await topUp({ santriId: santri.id, amount, method, note, actor: user, idemKey: key });
      setReceipt({ santriName: santri.name, amount, before, after: tx.balanceAfter, method, at: tx.createdAt, id: tx.id });
      toast.push('ok', 'Top up berhasil', `${santri.name}: ${rp(before)} → ${rp(tx.balanceAfter)}`);
      setConfirm(false);
    } catch (e) {
      toast.push('err', 'Top up gagal', e instanceof Error ? e.message : '');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card title="1 · Identifikasi santri" sub="Tempel kartu di NFC Simulator, atau pilih manual">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-navy-200 bg-navy-950 p-4">
              {scanning && <span className="scan-beam" />}
              {!santri ? (
                <button className="text-center" onClick={() => setScanning(true)}>
                  <IcScan size={30} className="mx-auto text-gold-300" />
                  <p className="font-display mt-2 text-sm font-bold text-white">{scanning ? 'Menunggu tempelan kartu…' : 'Scan kartu NFC'}</p>
                  <p className="mt-0.5 text-[11px] text-navy-300">Klik lalu tempel kartu di simulator</p>
                </button>
              ) : (
                <div className="anim-pop flex w-full items-center gap-3 rounded-lg bg-navy-900 p-3 text-left">
                  <Avatar name={santri.name} color={santri.color} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-sm font-bold text-white">{santri.name}</p>
                    <p className="text-[11px] text-navy-300 tnum">NIS {santri.nis} · {kelasById(santri.kelasId)?.name}</p>
                    <p className="font-display mt-1 text-lg font-bold text-gold-300 tnum">{rp(balanceOf(santri.id))}</p>
                  </div>
                  <Btn variant="ghost" size="sm" className="text-navy-300 hover:text-white" onClick={() => setSantriId(null)}>Ganti</Btn>
                </div>
              )}
            </div>
            <div>
              <Field label="Atau pilih santri manual">
                <select className={inputCls} value={santriId ?? ''} onChange={(e) => setSantriId(e.target.value || null)}>
                  <option value="">— pilih santri —</option>
                  {db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {rp(balanceOf(s.id))}</option>
                  ))}
                </select>
              </Field>
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-infobg px-3 py-2 text-[11px] leading-relaxed text-info">
                <IcInfo size={14} className="mt-0.5 shrink-0" />
                Saldo dibaca dari ledger di server — tidak pernah dari kartu atau dari frontend.
              </p>
            </div>
          </div>
        </Card>

        <Card title="2 · Nominal & metode" sub="Bukti transaksi dapat dicetak setelah konfirmasi">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {QUICK.map((n) => (
              <button
                key={n}
                onClick={() => setAmount(n)}
                className={cx(
                  'rounded-lg border py-2.5 text-[13px] font-bold tnum transition-all',
                  amount === n ? 'border-gold-400 bg-gold-50 text-gold-700 shadow-sm' : 'border-line bg-surface text-mute hover:border-navy-300 hover:text-ink'
                )}
              >
                {rp(n)}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Nominal (Rp)" req>
              <input type="number" className={cx(inputCls, 'text-base font-bold tnum')} value={amount} min={1000} step={1000} onChange={(e) => setAmount(Number(e.target.value))} />
            </Field>
            <Field label="Metode">
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as 'CASH' | 'TRANSFER')}>
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer bank</option>
              </select>
            </Field>
            <Field label="Catatan (opsional)">
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth: dari wali" />
            </Field>
          </div>
          <Btn variant="gold" size="lg" className="mt-4 w-full" disabled={!santri || amount < 1000} onClick={() => setConfirm(true)}>
            <IcWallet size={16} /> Proses Top Up {santri && amount >= 1000 ? rp(amount) : ''}
          </Btn>
        </Card>
      </div>

      <Card title="Top up terbaru" pad={false}>
        {recent.length === 0 ? <Empty title="Belum ada top up" /> : (
          <div className="divide-y divide-line/70">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar name={santriById(t.santriId)?.name ?? '?'} color={santriById(t.santriId)?.color} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{santriById(t.santriId)?.name}</p>
                  <p className="text-[10.5px] text-mute tnum">{fmtDT(t.createdAt)}</p>
                </div>
                <span className="text-xs font-bold text-ok tnum">+{rp(t.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* konfirmasi */}
      <Modal open={confirm} onClose={() => !processing && setConfirm(false)} title="Konfirmasi top up" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirm(false)} disabled={processing}>Batal</Btn>
            <Btn variant="ok" onClick={doTopUp} disabled={processing}>{processing ? <Spinner size={14} /> : <IcCheck16 />} Konfirmasi</Btn>
          </>
        }>
        {santri && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-bg p-3">
              <Avatar name={santri.name} color={santri.color} size={40} />
              <div>
                <p className="text-sm font-bold">{santri.name}</p>
                <p className="text-[11px] text-mute tnum">NIS {santri.nis}</p>
              </div>
            </div>
            <dl className="divide-y divide-line/70 text-[13px]">
              <div className="flex justify-between py-2"><dt className="text-mute">Saldo awal</dt><dd className="font-bold tnum">{rp(balanceOf(santri.id))}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-mute">Top up ({method === 'CASH' ? 'tunai' : 'transfer'})</dt><dd className="font-bold text-ok tnum">+{rp(amount)}</dd></div>
              <div className="flex justify-between py-2"><dt className="font-bold">Saldo akhir</dt><dd className="font-display text-base font-bold text-navy-800 tnum">{rp(balanceOf(santri.id) + amount)}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      {/* struk */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Bukti top up" w="max-w-sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => window.print()}><IcPrinter size={14} /> Cetak</Btn>
            <Btn onClick={() => { setReceipt(null); setSantriId(null); }}>Selesai</Btn>
          </>
        }>
        {receipt && (
          <div className="print-area rounded-lg border border-dashed border-navy-300 bg-surface p-4 font-mono text-[12px]">
            <p className="text-center font-bold">{db.settings.pesantren.toUpperCase()}</p>
            <p className="text-center text-[10px]">BUKTI TOP UP SALDO SANTRI</p>
            <div className="my-2 border-t border-dashed border-line" />
            <div className="space-y-1">
              <p className="flex justify-between"><span>No. Ref</span><b>{receipt.id}</b></p>
              <p className="flex justify-between"><span>Santri</span><b>{receipt.santriName}</b></p>
              <p className="flex justify-between"><span>Metode</span><b>{receipt.method}</b></p>
              <p className="flex justify-between"><span>Waktu</span><b>{fmtDT(receipt.at)}</b></p>
              <p className="flex justify-between"><span>Saldo awal</span><b>{rp(receipt.before)}</b></p>
              <p className="flex justify-between text-ok"><span>Top up</span><b>+{rp(receipt.amount)}</b></p>
              <p className="flex justify-between text-[13px] font-bold"><span>SALDO AKHIR</span><b>{rp(receipt.after)}</b></p>
            </div>
            <div className="my-2 border-t border-dashed border-line" />
            <p className="text-center text-[10px] text-mute">Simpan bukti ini · {db.settings.phone}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
function IcCheck16() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M4.5 12.5l5 5L19.5 7" /></svg>
  );
}

/* ================= LEDGER ================= */

export function WalletPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('');
  const [fSantri, setFSantri] = useState('');
  const [adjust, setAdjust] = useState<string | null>(null);
  const [adjAmt, setAdjAmt] = useState(0);
  const [adjReason, setAdjReason] = useState('');

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return db.walletTxs
      .filter((t) => (!fType || t.type === fType) && (!fSantri || t.santriId === fSantri))
      .filter((t) => {
        if (!ql) return true;
        const s = santriById(t.santriId);
        return t.description.toLowerCase().includes(ql) || (s?.name.toLowerCase().includes(ql) ?? false);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [q, fType, fSantri]);

  const shown = rows.slice(0, 60);
  const types = ['TOP_UP', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'LAUNDRY', 'LIBRARY_FINE', 'OTHER'];

  return (
    <div className="space-y-4">
      <PageHead
        title="Ledger & Saldo"
        desc="Sumber kebenaran saldo — setiap mutasi tercatat dengan balance before/after dan idempotency key"
        actions={
          <Btn variant="outline" size="sm" onClick={() => {
            downloadFile(`ledger-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows.map((t) => ({
              waktu: t.createdAt, santri: santriById(t.santriId)?.name ?? t.santriId, jenis: t.type,
              nominal: t.amount, sebelum: t.balanceBefore, sesudah: t.balanceAfter, keterangan: t.description,
            }))));
            toast.push('ok', 'Ledger di-export', `${rows.length} baris CSV.`);
          }}><IcDownload size={14} /> Export CSV</Btn>
        }
      />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {db.santri.filter((s) => !s.deletedAt && s.status === 'aktif').slice(0, 4).map((s) => (
          <Stat key={s.id} label={s.name} value={rp(balanceOf(s.id))} sub={`NIS ${s.nis}`} icon={<IcWallet size={16} />} tone="navy" onClick={() => setFSantri(s.id)} />
        ))}
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="w-full sm:w-60"><SearchBox value={q} onChange={setQ} placeholder="Cari keterangan / santri…" /></div>
          <select className={cx(inputCls, 'w-auto')} value={fSantri} onChange={(e) => setFSantri(e.target.value)}>
            <option value="">Semua santri</option>
            {db.santri.filter((s) => !s.deletedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={cx(inputCls, 'w-auto')} value={fType} onChange={(e) => setFType(e.target.value)}>
            <option value="">Semua jenis</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <TWrap>
          <THead cols={['Waktu', 'Santri', 'Jenis', 'Keterangan', 'Sebelum', 'Sesudah', 'Nominal', '']} />
          <tbody>
            {shown.map((t) => (
              <TRow key={t.id}>
                <TD className="whitespace-nowrap text-mute tnum">{fmtDT(t.createdAt)}</TD>
                <TD><SantriChip id={t.santriId} size="sm" /></TD>
                <TD><Badge tone={t.amount >= 0 ? 'ok' : 'danger'}>{t.type}</Badge></TD>
                <TD className="max-w-56 truncate" >{t.description}</TD>
                <TD className="tnum text-mute">{rp(t.balanceBefore)}</TD>
                <TD className="font-bold tnum">{rp(t.balanceAfter)}</TD>
                <TD right className={cx('font-bold tnum', t.amount >= 0 ? 'text-ok' : 'text-danger')}>{t.amount >= 0 ? '+' : ''}{rp(t.amount)}</TD>
                <TD>
                  {(user.role === 'BENDAHARA' || user.role === 'SUPER_ADMIN') && (
                    <button className="text-[11px] font-bold text-info hover:underline" onClick={() => { setAdjust(t.santriId); setAdjAmt(0); setAdjReason(''); }}>Koreksi</button>
                  )}
                </TD>
              </TRow>
            ))}
          </tbody>
        </TWrap>
        {rows.length === 0 && <Empty title="Tidak ada transaksi" desc="Ubah filter atau lakukan top up terlebih dahulu." />}
        <div className="border-t border-line p-3 text-[11px] text-mute">Menampilkan {shown.length} dari {rows.length} baris · saldo dihitung ulang dari ledger, bukan dari cache frontend</div>
      </Card>

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title="Koreksi saldo (adjustment)" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAdjust(null)}>Batal</Btn>
            <Btn onClick={async () => {
              if (!adjust) return;
              try {
                await adjustment({ santriId: adjust, amount: adjAmt, reason: adjReason, actor: user });
                toast.push('ok', 'Koreksi tercatat', 'Adjustment masuk ledger & audit log.');
                setAdjust(null);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              }
            }}>Catat Koreksi</Btn>
          </>
        }>
        <div className="space-y-3">
          {adjust && <SantriChip id={adjust} />}
          <Field label="Nominal (+ menambah / − mengurangi)" req>
            <input type="number" className={inputCls} value={adjAmt} onChange={(e) => setAdjAmt(Number(e.target.value))} />
          </Field>
          <Field label="Alasan koreksi" req hint="Tercatat permanen di audit trail">
            <input className={inputCls} value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="cth: selisih setoran tunai 12 Agus" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ================= TAGIHAN ================= */

export function TagihanPage({ user, waliView }: { user: User; waliView?: string }) {
  useDB();
  const toast = useToast();
  const [tab, setTab] = useState('tagihan');
  const [fStatus, setFStatus] = useState('');
  const [pay, setPay] = useState<Invoice | null>(null);
  const [payAmt, setPayAmt] = useState(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [create, setCreate] = useState(false);
  const [nf, setNf] = useState({ santriId: 'SAN-001', type: 'SPP' as Invoice['type'], period: 'September 2026', dueDate: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10), amount: 350_000 });
  const [busy, setBusy] = useState(false);

  const scopeIds = waliView ? new Set([waliView]) : null;
  const invoices = db.invoices
    .filter((i) => (!scopeIds || scopeIds.has(i.santriId)) && (!fStatus || i.status === fStatus))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pays = db.payments.filter((p) => !scopeIds || scopeIds.has(p.santriId));

  const outstanding = invoices.filter((i) => i.status !== 'CANCELLED').reduce((a, i) => a + (i.amount - i.paidAmount), 0);
  const paidMonth = pays.filter((p) => new Date(p.createdAt).getMonth() === new Date().getMonth()).reduce((a, p) => a + p.amount, 0);

  const labelFor = (t: Invoice['type']) => ({ SPP: 'SPP', MAKAN: 'Uang Makan', ASRAMA: 'Asrama', PENDIDIKAN: 'Pendidikan', LAUNDRY: 'Laundry', KEGIATAN: 'Kegiatan', LAINNYA: 'Lainnya' }[t]);

  return (
    <div className="space-y-4">
      <PageHead
        title={waliView ? 'Tagihan Anak' : 'Tagihan Pesantren'}
        desc={waliView ? 'Riwayat tagihan & pembayaran' : 'SPP, asrama, uang makan, dan lainnya'}
        actions={!waliView && <Btn size="sm" onClick={() => setCreate(true)}><IcPlus size={14} /> Buat Tagihan</Btn>}
      />

      {!waliView && (
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Belum terbayar" value={rp(outstanding)} icon={<IcTag size={17} />} tone="danger" />
          <Stat label="Diterima bulan ini" value={rp(paidMonth)} icon={<IcWallet size={17} />} tone="ok" />
          <Stat label="Tagihan aktif" value={invoices.filter((i) => i.status !== 'CANCELLED').length} icon={<IcTag size={17} />} tone="navy" />
          <Stat label="Lunas" value={invoices.filter((i) => i.status === 'PAID').length} icon={<IcCard size={17} />} tone="ok" />
        </div>
      )}

      <Tabs tabs={[{ key: 'tagihan', label: 'Tagihan' }, { key: 'riwayat', label: 'Riwayat Pembayaran' }]} active={tab} onChange={setTab} />

      {tab === 'tagihan' && (
        <Card pad={false} action={
          <select className={cx(inputCls, 'w-auto')} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Semua status</option>
            {['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
          </select>
        }>
          {invoices.length === 0 ? <Empty title="Tidak ada tagihan" /> : (
            <TWrap>
              <THead cols={['No. Invoice', 'Santri', 'Tagihan', 'Periode', 'Jumlah', 'Dibayar', 'Jatuh Tempo', 'Status', !waliView ? 'Aksi' : '']} />
              <tbody>
                {invoices.map((i) => (
                  <TRow key={i.id}>
                    <TD className="font-bold tnum">{i.number}</TD>
                    <TD><SantriChip id={i.santriId} size="sm" /></TD>
                    <TD className="font-semibold">{i.label}</TD>
                    <TD className="text-mute">{i.period}</TD>
                    <TD className="font-bold tnum">{rp(i.amount)}</TD>
                    <TD className="tnum text-ok">{rp(i.paidAmount)}</TD>
                    <TD className={cx('tnum', i.status === 'UNPAID' && new Date(i.dueDate).getTime() < Date.now() && 'font-bold text-danger')}>{fmtDate(i.dueDate)}</TD>
                    <TD><Badge tone={statusTone(i.status)}>{i.status}</Badge></TD>
                    <TD>
                      {!waliView && i.status !== 'CANCELLED' && i.paidAmount < i.amount && (
                        <div className="flex gap-1">
                          <Btn variant="ok" size="sm" onClick={() => { setPay(i); setPayAmt(i.amount - i.paidAmount); }}>Bayar</Btn>
                          <Btn variant="ghost" size="sm" onClick={() => { cancelInvoice(i.id, user); toast.push('info', 'Tagihan dibatalkan'); }}>Batal</Btn>
                        </div>
                      )}
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'riwayat' && (
        <Card pad={false}>
          <TWrap>
            <THead cols={['Waktu', 'Invoice', 'Santri', 'Metode', 'Petugas', 'Nominal']} />
            <tbody>
              {pays.map((p) => (
                <TRow key={p.id}>
                  <TD className="tnum text-mute">{fmtDT(p.createdAt)}</TD>
                  <TD className="font-bold tnum">{db.invoices.find((i) => i.id === p.invoiceId)?.number ?? '-'}</TD>
                  <TD><SantriChip id={p.santriId} size="sm" /></TD>
                  <TD><Badge tone="info">{p.method}</Badge></TD>
                  <TD className="text-mute">{db.users.find((u) => u.id === p.userId)?.name ?? '-'}</TD>
                  <TD right className="font-bold text-ok tnum">{rp(p.amount)}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
          {pays.length === 0 && <Empty title="Belum ada pembayaran" />}
        </Card>
      )}

      {/* bayar */}
      <Modal open={!!pay} onClose={() => !busy && setPay(null)} title="Catat pembayaran" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPay(null)} disabled={busy}>Batal</Btn>
            <Btn variant="ok" disabled={busy || payAmt <= 0} onClick={async () => {
              if (!pay) return;
              setBusy(true);
              try {
                await payInvoice(pay.id, payAmt, payMethod, user, uuid());
                toast.push('ok', 'Pembayaran tercatat', `${pay.label} — ${rp(payAmt)} (${payMethod})`);
                setPay(null);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              } finally {
                setBusy(false);
              }
            }}>{busy ? <Spinner size={14} /> : 'Simpan Pembayaran'}</Btn>
          </>
        }>
        {pay && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-bg p-3 text-[13px]">
              <p className="font-bold">{pay.label}</p>
              <p className="text-mute tnum">{pay.number} · sisa {rp(pay.amount - pay.paidAmount)}</p>
            </div>
            <Field label="Nominal dibayar" req>
              <input type="number" className={inputCls} value={payAmt} max={pay.amount - pay.paidAmount} onChange={(e) => setPayAmt(Number(e.target.value))} />
            </Field>
            <Field label="Metode">
              <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value as 'CASH' | 'TRANSFER')}>
                <option value="CASH">Tunai</option><option value="TRANSFER">Transfer bank</option>
              </select>
            </Field>
            <p className="text-[11px] text-mute">Membayar sebagian akan menandai tagihan PARTIAL. Idempotency key mencegah pencatatan ganda.</p>
          </div>
        )}
      </Modal>

      {/* buat tagihan */}
      <Modal open={create} onClose={() => setCreate(false)} title="Buat tagihan baru" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCreate(false)}>Batal</Btn>
            <Btn onClick={() => {
              try {
                const inv = createInvoice({
                  santriId: nf.santriId, type: nf.type, label: `${labelFor(nf.type)} ${nf.period}`,
                  amount: nf.amount, dueDate: new Date(nf.dueDate).toISOString(), period: nf.period,
                }, user);
                toast.push('ok', 'Tagihan diterbitkan', `${inv.number} — wali santri dinotifikasi.`);
                setCreate(false);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              }
            }}>Terbitkan</Btn>
          </>
        }>
        <div className="space-y-3">
          <Field label="Santri" req>
            <select className={inputCls} value={nf.santriId} onChange={(e) => setNf({ ...nf, santriId: e.target.value })}>
              {db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis">
              <select className={inputCls} value={nf.type} onChange={(e) => setNf({ ...nf, type: e.target.value as Invoice['type'] })}>
                {(['SPP', 'MAKAN', 'ASRAMA', 'PENDIDIKAN', 'LAUNDRY', 'KEGIATAN', 'LAINNYA'] as const).map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Periode"><input className={inputCls} value={nf.period} onChange={(e) => setNf({ ...nf, period: e.target.value })} /></Field>
            <Field label="Nominal" req><input type="number" className={inputCls} value={nf.amount} onChange={(e) => setNf({ ...nf, amount: Number(e.target.value) })} /></Field>
            <Field label="Jatuh tempo"><input type="date" className={inputCls} value={nf.dueDate} onChange={(e) => setNf({ ...nf, dueDate: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
