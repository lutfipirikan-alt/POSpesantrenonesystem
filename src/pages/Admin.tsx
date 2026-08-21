/* ===== Modul 18–20 + sistem: Laporan, Audit Log, Pengguna, Notifikasi, Uji Sistem, Pengaturan ===== */

import { useMemo, useState } from 'react';
import type { Role, User } from '../lib/types';
import { db, outletById, resetDemo, santriById, useDB } from '../lib/store';
import { balanceOf } from '../lib/services/wallet';
import { saveUser } from '../lib/services/ops';
import { grossProfit, dailySeries, salesInRange, topProducts, topUpTotal, totalCirculatingBalance } from '../lib/services/reports';
import { can, ROLE_LABEL } from '../lib/services/auth';
import { runAllTests, type TestResult } from '../lib/tests';
import { cx, downloadFile, fmtDT, num, rp, timeAgo, toCSV } from '../lib/util';
import { Avatar, Badge, Btn, Card, Empty, Field, inputCls, Modal, SearchBox, Spinner, Stat, statusTone, Tabs, THead, TRow, TD, Toggle, TWrap, useToast } from '../components/ui';
import { PageHead, SantriChip, useHashRoute } from '../components/layout';
import { IcCheck, IcDownload, IcFlask, IcInfo, IcReceipt, IcRefresh, IcShield, IcTag, IcUsers, IcWallet, IcX } from '../components/icons';

/* ================= LAPORAN ================= */

export function LaporanPage() {
  useDB();
  const toast = useToast();
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'month'>('7d');
  const [fOutlet, setFOutlet] = useState('');
  const [fKasir, setFKasir] = useState('');

  const [from, to] = useMemo(() => {
    const now = Date.now();
    const d0 = new Date();
    d0.setHours(0, 0, 0, 0);
    if (range === 'today') return [d0.getTime(), now];
    if (range === '7d') return [d0.getTime() - 6 * 86400_000, now];
    if (range === '30d') return [d0.getTime() - 29 * 86400_000, now];
    return [new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), now];
  }, [range]);

  const sales = salesInRange(from, to, fOutlet || undefined, fKasir || undefined);
  const omzet = sales.filter((s) => s.status !== 'REFUNDED').reduce((a, s) => a + s.total, 0);
  const profit = grossProfit(sales.filter((s) => s.status !== 'REFUNDED'));
  const topup = topUpTotal(from, to);
  const days = range === '30d' ? 30 : range === 'month' ? new Date().getDate() : range === '7d' ? 7 : 1;
  const series = dailySeries(Math.min(days, 30), fOutlet || undefined);
  const top = topProducts(from, to, 8);

  const exportSales = () =>
    downloadFile('laporan-transaksi.csv', toCSV(sales.map((s) => ({
      nomor: s.number, waktu: s.createdAt, outlet: outletById(s.outletId)?.name ?? '', kasir: db.users.find((u) => u.id === s.cashierId)?.name ?? '',
      santri: s.santriId ? santriById(s.santriId)?.name ?? '' : 'Tunai', metode: s.method, total: s.total, status: s.status,
    }))));

  return (
    <div className="space-y-4">
      <PageHead title="Laporan" desc="Transaksi, omzet, laba kotor, top up, saldo, produk terlaris — export CSV siap olah" />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          tabs={[{ key: 'today', label: 'Hari ini' }, { key: '7d', label: '7 hari' }, { key: '30d', label: '30 hari' }, { key: 'month', label: 'Bulan ini' }]}
          active={range}
          onChange={(k) => setRange(k as typeof range)}
        />
        <select className={cx(inputCls, 'w-auto')} value={fOutlet} onChange={(e) => setFOutlet(e.target.value)}>
          <option value="">Semua outlet</option>
          {db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select className={cx(inputCls, 'w-auto')} value={fKasir} onChange={(e) => setFKasir(e.target.value)}>
          <option value="">Semua kasir</option>
          {db.users.filter((u) => u.role === 'KASIR').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Omzet" value={rp(omzet)} sub={`${sales.length} transaksi`} icon={<IcReceipt size={17} />} tone="gold" />
        <Stat label="Laba kotor" value={rp(profit)} sub="harga jual − modal" icon={<IcReceipt size={17} />} tone="ok" />
        <Stat label="Top up" value={rp(topup)} icon={<IcWallet size={17} />} tone="navy" />
        <Stat label="Saldo beredar" value={rp(totalCirculatingBalance())} icon={<IcWallet size={17} />} tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Omzet harian" pad={false} action={<Btn variant="outline" size="sm" onClick={() => { exportSales(); toast.push('ok', 'CSV transaksi diunduh'); }}><IcDownload size={13} /> Transaksi</Btn>}>
          <div className="flex h-44 items-end gap-1 px-4 pt-4">
            {series.map((s, i) => {
              const max = Math.max(...series.map((x) => x.omzet), 1);
              return (
                <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className="absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block tnum">{rp(s.omzet)}</div>
                  <div className="bar-grow w-full rounded-t bg-navy-700 transition-colors group-hover:bg-gold-400" style={{ height: `${Math.max(3, (s.omzet / max) * 100)}%`, animationDelay: `${i * 30}ms` }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 px-4 pb-3 pt-1.5">
            {series.map((s, i) => <span key={i} className="flex-1 text-center text-[9px] text-mute">{s.label}</span>)}
          </div>
        </Card>

        <Card title="Produk terlaris" pad={false} action={<Btn variant="outline" size="sm" onClick={() => {
          downloadFile('produk-terlaris.csv', toCSV(top.map((t) => ({ produk: t.name, qty: t.qty, omzet: t.omzet }))));
          toast.push('ok', 'CSV produk terlaris diunduh');
        }}><IcDownload size={13} /></Btn>}>
          <div className="divide-y divide-line/70">
            {top.map((t, i) => {
              const max = top[0]?.qty ?? 1;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <span className="font-display w-5 text-sm font-bold text-navy-300 tnum">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-xs"><span className="font-bold">{t.name}</span><span className="tnum text-mute">{t.qty}× · {rp(t.omzet)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-bg"><div className="h-full rounded-full bg-gold-400" style={{ width: `${(t.qty / max) * 100}%` }} /></div>
                  </div>
                </div>
              );
            })}
            {top.length === 0 && <Empty title="Belum ada penjualan pada periode ini" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Ringkasan saldo santri" pad={false} action={<Btn variant="outline" size="sm" onClick={() => {
          downloadFile('saldo-santri.csv', toCSV(db.santri.filter((s) => !s.deletedAt).map((s) => ({ nis: s.nis, nama: s.name, kelas: db.kelas.find((k) => k.id === s.kelasId)?.name ?? '', status: s.status, saldo: balanceOf(s.id) }))));
          toast.push('ok', 'CSV saldo diunduh');
        }}><IcDownload size={13} /></Btn>}>
          <div className="divide-y divide-line/70">
            {db.santri.filter((s) => !s.deletedAt).map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                <SantriChip id={s.id} size="sm" />
                <span className="ml-auto font-bold tnum">{rp(balanceOf(s.id))}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Pembayaran pesantren" pad={false} action={<Btn variant="outline" size="sm" onClick={() => {
          downloadFile('pembayaran.csv', toCSV(db.payments.map((p) => ({ waktu: p.createdAt, santri: santriById(p.santriId)?.name ?? '', invoice: db.invoices.find((i) => i.id === p.invoiceId)?.number ?? '', metode: p.method, nominal: p.amount }))));
          toast.push('ok', 'CSV pembayaran diunduh');
        }}><IcDownload size={13} /></Btn>}>
          <div className="divide-y divide-line/70">
            {db.payments.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-okbg text-ok"><IcTag size={14} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{santriById(p.santriId)?.name} · {db.invoices.find((i) => i.id === p.invoiceId)?.label}</p>
                  <p className="text-[10.5px] text-mute">{timeAgo(p.createdAt)} · {p.method}</p>
                </div>
                <span className="font-bold text-ok tnum">{rp(p.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= AUDIT ================= */

export function AuditPage() {
  useDB();
  const [q, setQ] = useState('');
  const [fEntity, setFEntity] = useState('');
  const entities = [...new Set(db.audits.map((a) => a.entity))];
  const rows = db.audits
    .filter((a) => (!fEntity || a.entity === fEntity))
    .filter((a) => !q.trim() || a.details.toLowerCase().includes(q.toLowerCase()) || a.userName.toLowerCase().includes(q.toLowerCase()) || a.action.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHead title="Audit Log" desc={`Append-only · ${db.audits.length} entri · tidak dapat dihapus dari aplikasi oleh role mana pun`} />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder="Cari aksi / user / detail…" /></div>
          <select className={cx(inputCls, 'w-auto')} value={fEntity} onChange={(e) => setFEntity(e.target.value)}>
            <option value="">Semua entitas</option>
            {entities.map((e) => <option key={e}>{e}</option>)}
          </select>
          <Btn variant="outline" size="sm" className="ml-auto" onClick={() => downloadFile('audit-log.csv', toCSV(rows.map((a) => ({ waktu: a.createdAt, user: a.userName, role: a.role, aksi: a.action, entitas: a.entity, detail: a.details }))))}>
            <IcDownload size={13} /> Export
          </Btn>
        </div>
        <TWrap>
          <THead cols={['Waktu', 'User', 'Role', 'Aksi', 'Detail']} />
          <tbody>
            {rows.slice(0, 80).map((a) => (
              <TRow key={a.id}>
                <TD className="whitespace-nowrap text-mute tnum">{fmtDT(a.createdAt)}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <Avatar name={a.userName} size={24} color="#5c6c86" />
                    <span className="font-semibold">{a.userName}</span>
                  </div>
                </TD>
                <TD><Badge tone="mute">{ROLE_LABEL[a.role as Role] ?? a.role}</Badge></TD>
                <TD><Badge tone={a.action.includes('DELETE') || a.action.includes('BLOCK') || a.action.includes('REFUND') ? 'danger' : a.action.includes('LOGIN') ? 'info' : 'navy'}>{a.action}</Badge></TD>
                <TD className="max-w-md truncate" >{a.details}</TD>
              </TRow>
            ))}
          </tbody>
        </TWrap>
        {rows.length === 0 && <Empty title="Tidak ada entri" />}
      </Card>
    </div>
  );
}

/* ================= USERS ================= */

export function UsersPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [edit, setEdit] = useState<User | null | 'new'>(null);

  const MODULES = ['dash', 'santri', 'kartu', 'pos', 'topup', 'wallet', 'tagihan', 'produk', 'laundry', 'perpustakaan', 'absensi', 'akademik', 'hafalan', 'pelanggaran', 'wali', 'laporan', 'audit', 'users'];

  return (
    <div className="space-y-4">
      <PageHead title="Pengguna & Role" desc="Role menentukan izin — diverifikasi ulang di setiap operasi server-side" actions={<Btn size="sm" onClick={() => setEdit('new')}>+ User Baru</Btn>} />

      <Card pad={false}>
        <TWrap>
          <THead cols={['User', 'Username', 'Role', 'Tautan', 'Login terakhir', 'Aktif']} />
          <tbody>
            {db.users.map((u) => (
              <TRow key={u.id} onClick={() => setEdit(u)}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size={30} color="#143a6c" />
                    <span className="font-bold">{u.name}</span>
                  </div>
                </TD>
                <TD className="font-mono text-xs">@{u.username}</TD>
                <TD><Badge tone="navy">{ROLE_LABEL[u.role]}</Badge></TD>
                <TD className="text-xs text-mute">
                  {u.outletId ? outletById(u.outletId)?.name : u.waliId ? `Wali: ${db.wali.find((w) => w.id === u.waliId)?.name}` : '—'}
                </TD>
                <TD className="text-xs text-mute">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'belum pernah'}</TD>
                <TD>
                  <span onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Toggle on={u.active} onChange={(v) => {
                      if (u.id === user.id && !v) {
                        toast.push('err', 'Tidak bisa menonaktifkan diri sendiri');
                        return;
                      }
                      u.active = v;
                      toast.push('ok', `${u.name} ${v ? 'diaktifkan' : 'dinonaktifkan'}`);
                    }} />
                  </span>
                </TD>
              </TRow>
            ))}
          </tbody>
        </TWrap>
      </Card>

      <Card title="Matriks permission" sub="Centang = role memiliki akses modul (ditegakkan di server)" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-surface px-3 py-2 text-left font-bold text-mute">Modul</th>
                {Object.keys(ROLE_LABEL).map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-bold text-mute">{ROLE_LABEL[r as Role].split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m} className="border-b border-line/60">
                  <td className="sticky left-0 bg-surface px-3 py-1.5 font-semibold capitalize">{m}</td>
                  {Object.keys(ROLE_LABEL).map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">
                      {can({ role: r as Role } as User, m) ? <IcCheck size={13} className="inline text-ok" /> : <span className="text-line">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {edit && <UserForm initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function UserForm({ initial, onClose }: { initial: User | null; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(() =>
    initial
      ? { username: initial.username, name: initial.name, role: initial.role, outletId: initial.outletId ?? '', waliId: initial.waliId ?? '' }
      : { username: '', name: '', role: 'KASIR' as Role, outletId: '', waliId: '' }
  );
  return (
    <Modal open onClose={onClose} title={initial ? `Ubah user — ${initial.name}` : 'User baru'} w="max-w-md"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn onClick={async () => {
            try {
              const actor = { id: 'U-01', username: 'superadmin', password: '', name: 'H. Zainal Arifin', role: 'SUPER_ADMIN' as const, active: true };
              saveUser({ ...f, id: initial?.id, outletId: f.outletId || undefined, waliId: f.waliId || undefined }, actor);
              toast.push('ok', 'User disimpan', `${f.name} (${ROLE_LABEL[f.role]})`);
              onClose();
            } catch (e) {
              toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
            }
          }}>Simpan</Btn>
        </>
      }>
      <div className="space-y-3">
        <Field label="Nama lengkap" req><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Username" req><input className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="Role" req>
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Outlet (untuk kasir/petugas)">
          <select className={inputCls} value={f.outletId} onChange={(e) => setF({ ...f, outletId: e.target.value })}>
            <option value="">—</option>
            {db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Data wali (untuk role WALI)">
          <select className={inputCls} value={f.waliId} onChange={(e) => setF({ ...f, waliId: e.target.value })}>
            <option value="">—</option>
            {db.wali.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <p className="text-[11px] text-mute">Password demo: demo123. Produksi memakai Supabase Auth — password tidak pernah disimpan plaintext.</p>
      </div>
    </Modal>
  );
}

/* ================= NOTIFIKASI ================= */

export function NotifPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const rows = db.notifs.filter((n) => !n.userId || n.userId === user.id || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN');
  const unread = rows.filter((n) => !n.read).length;
  return (
    <div className="space-y-4">
      <PageHead
        title="Notifikasi"
        desc="Channel in-app + WhatsApp (provider dapat diganti lewat NotificationChannel)"
        actions={unread > 0 ? <Btn variant="outline" size="sm" onClick={() => {
          rows.forEach((n) => (n.read = true));
          toast.push('ok', `${unread} notifikasi ditandai dibaca`);
        }}><IcCheck size={13} /> Tandai dibaca</Btn> : undefined}
      />
      <Card pad={false}>
        {rows.length === 0 ? <Empty title="Tidak ada notifikasi" /> : (
          <div className="divide-y divide-line/70">
            {rows.map((n) => (
              <div key={n.id} className={cx('flex items-start gap-3 px-4 py-3', !n.read && 'bg-navy-50/50')}>
                <span className={cx('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.channel === 'whatsapp' ? 'bg-okbg text-ok' : 'bg-infobg text-info')}>
                  {n.channel === 'whatsapp' ? <IcUsers size={15} /> : <IcInfo size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-bold">{n.title}</p>
                    <Badge tone={n.channel === 'whatsapp' ? 'ok' : 'info'}>{n.channel === 'whatsapp' ? 'WhatsApp' : 'In-App'}</Badge>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-danger blink" />}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-mute">{n.body}</p>
                  <p className="mt-1 text-[10.5px] text-mute/70">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= UJI SISTEM ================= */

export function TestsPage() {
  useDB();
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults(null);
    await new Promise((r) => setTimeout(r, 50));
    const res = await runAllTests();
    setResults(res);
    setRunning(false);
  };

  const pass = results?.filter((r) => r.pass).length ?? 0;
  const groups = [...new Set((results ?? []).map((r) => r.group))];

  return (
    <div className="space-y-4">
      <PageHead
        title="Uji Sistem"
        desc="Test suite otomatis terhadap service layer: ledger, idempotency, concurrency, duplicate scan, refund, kartu blokir"
        actions={<Btn variant={running ? 'outline' : 'gold'} size="sm" onClick={run} disabled={running}>{running ? <Spinner size={14} /> : <IcFlask size={14} />} {running ? 'Menjalankan…' : results ? 'Jalankan Ulang' : 'Jalankan Semua Uji'}</Btn>}
      />

      {results && (
        <div className={cx('flex items-center gap-4 rounded-xl border p-4', pass === results.length ? 'border-okln bg-okbg' : 'border-dangerln bg-dangerbg')}>
          <span className={cx('font-display text-3xl font-bold', pass === results.length ? 'text-ok' : 'text-danger')}>{pass}/{results.length}</span>
          <div>
            <p className="font-display text-sm font-bold">{pass === results.length ? 'Semua uji lolos' : 'Ada uji yang gagal'}</p>
            <p className="text-xs text-mute">Data demo dipulihkan otomatis setelah uji — tidak mengubah data aplikasi.</p>
          </div>
        </div>
      )}

      {!results && !running && (
        <Card>
          <Empty
            icon={<IcFlask size={22} />}
            title="Siap menguji integritas sistem"
            desc="11 skenario akan dijalankan: top up ledger, idempotency, saldo kurang, lock konkurensi, kartu blokir, UID duplikat, debounce NFC, checkout, harga server-side, checkout gagal atomik, dan refund anti-dobel."
            action={<Btn variant="gold" onClick={run}><IcFlask size={14} /> Mulai Uji</Btn>}
          />
        </Card>
      )}

      {groups.map((g) => (
        <Card key={g} title={`Grup: ${g}`} pad={false}>
          <div className="divide-y divide-line/70">
            {results!.filter((r) => r.group === g).map((r, i) => (
              <div key={i} className="anim-fade-up flex items-start gap-3 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white', r.pass ? 'bg-ok' : 'bg-danger')}>
                  {r.pass ? <IcCheck size={13} /> : <IcX size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">{r.name}</p>
                  <p className="mt-0.5 text-xs text-mute">{r.detail}</p>
                </div>
                <span className="text-[10.5px] font-bold text-mute tnum">{r.ms} ms</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ================= PENGATURAN ================= */

export function SettingsPage() {
  useDB();
  const toast = useToast();
  const [reset, setReset] = useState(false);
  const [cd, setCd] = useState(db.settings.nfcCooldownMs);

  return (
    <div className="space-y-4">
      <PageHead title="Pengaturan" desc="Identitas pesantren, outlet, dan parameter sistem" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Identitas pesantren">
          <div className="space-y-3">
            <Field label="Nama pesantren">
              <input className={inputCls} defaultValue={db.settings.pesantren} onBlur={(e) => { db.settings.pesantren = e.target.value; toast.push('ok', 'Tersimpan'); }} />
            </Field>
            <Field label="Alamat">
              <input className={inputCls} defaultValue={db.settings.address} onBlur={(e) => { db.settings.address = e.target.value; }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telepon"><input className={inputCls} defaultValue={db.settings.phone} onBlur={(e) => { db.settings.phone = e.target.value; }} /></Field>
              <Field label="Tahun ajaran"><input className={inputCls} defaultValue={db.settings.termYear} onBlur={(e) => { db.settings.termYear = e.target.value; }} /></Field>
            </div>
            <Field label="Provider WhatsApp (abstraksi — dapat diganti)" hint="Produksi: implementasi NotificationChannel untuk Wablas/Fonnte/Twilio dsb.">
              <input className={inputCls} defaultValue={db.settings.waProvider} onBlur={(e) => { db.settings.waProvider = e.target.value; }} />
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="NFC & keamanan">
            <Field label={`Cooldown anti-duplicate scan: ${cd} ms`} hint="Bacaan UID yang sama dalam jendela ini diabaikan — mencegah transaksi ganda saat kartu masih menempel.">
              <input type="range" min={500} max={6000} step={250} value={cd} className="w-full accent-[#dba63e]"
                onChange={(e) => setCd(Number(e.target.value))}
                onMouseUp={() => { db.settings.nfcCooldownMs = cd; toast.push('ok', `Cooldown NFC = ${cd} ms`); }}
                onTouchEnd={() => { db.settings.nfcCooldownMs = cd; }}
              />
            </Field>
            <ul className="mt-4 space-y-1.5 text-[12px] text-mute">
              {['Setiap transaksi memakai idempotency key unik', 'Saldo & harga divalidasi di service layer (server-side)', 'Lock per santri mensimulasikan SELECT … FOR UPDATE', 'Audit log append-only untuk seluruh operasi sensitif'].map((t) => (
                <li key={t} className="flex items-start gap-2"><IcCheck size={13} className="mt-0.5 shrink-0 text-ok" /> {t}</li>
              ))}
            </ul>
          </Card>

          <Card title="Outlet / unit" pad={false}>
            <div className="divide-y divide-line/70">
              {db.outlets.map((o) => {
                const staff = db.outletUsers.filter((ou) => ou.outletId === o.id).map((ou) => db.users.find((u) => u.id === ou.userId)?.name).filter(Boolean);
                return (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Badge tone="navy">{o.code}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{o.name}</p>
                      <p className="text-[10.5px] text-mute">{staff.join(', ') || 'belum ada petugas'} · {o.kind}</p>
                    </div>
                    <Badge tone={o.active ? 'ok' : 'mute'}>{o.active ? 'AKTIF' : 'NONAKTIF'}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Data demo" className="border-dangerln">
            <p className="text-xs text-mute">Kembalikan seluruh data ke kondisi seed awal (transaksi & perubahan Anda akan hilang).</p>
            <Btn variant="danger" size="sm" className="mt-2" onClick={() => setReset(true)}><IcRefresh size={13} /> Reset Data Demo</Btn>
          </Card>
        </div>
      </div>

      <Modal open={reset} onClose={() => setReset(false)} title="Reset data demo?" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setReset(false)}>Batal</Btn>
            <Btn variant="danger" onClick={() => { resetDemo(); setReset(false); toast.push('ok', 'Data demo dipulihkan', 'Seluruh data kembali ke seed awal.'); }}>Ya, Reset</Btn>
          </>
        }>
        <p className="text-sm text-mute">Semua perubahan (transaksi, kartu, nilai, dll.) akan dihapus dan digantikan seed awal. Lanjutkan?</p>
      </Modal>
    </div>
  );
}
