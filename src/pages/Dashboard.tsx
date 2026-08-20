/* ===== Modul 1: Dashboard (konten berbeda per role) ===== */

import { useMemo } from 'react';
import type { User } from '../lib/types';
import { db, outletById, santriById, userById, useDB } from '../lib/store';
import { dailySeries, omzetByOutlet, topProducts, totalCirculatingBalance, topUpTotal, dayRange, monthRange, salesInRange } from '../lib/services/reports';
import { rp, num, fmtTime, timeAgo, fmtDate } from '../lib/util';
import { AreaChart, Bars, Donut } from '../components/charts';
import { Badge, Card, Empty, Stat, statusTone, THead, TRow, TD, TWrap } from '../components/ui';
import { SantriChip, useHashRoute } from '../components/layout';
import { IcAlert, IcBox, IcCal, IcCap, IcCard, IcCart, IcClipboard, IcMoonStar, IcReceipt, IcSantri, IcTag, IcUsers, IcWallet, IcWasher } from '../components/icons';

const todayStr = () => new Date().toDateString();

export default function Dashboard({ user }: { user: User }) {
  useDB();
  const [, nav] = useHashRoute();

  const [dStart, dEnd] = dayRange();
  const [mStart, mEnd] = monthRange();
  const salesToday = db.sales.filter((s) => new Date(s.createdAt).toDateString() === todayStr());
  const omzetToday = salesToday.reduce((a, s) => a + s.total, 0);
  const topupToday = topUpTotal(dStart, dEnd);
  const santriAktif = db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).length;
  const santriBaru = db.santri.filter((s) => new Date(s.createdAt).getTime() >= mStart).length;
  const laundryAktif = db.laundryOrders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
  const pelanggaran = db.violations.filter((v) => new Date(v.date).getTime() >= mStart).length;
  const absenToday = db.attendance.filter((a) => new Date(a.at).toDateString() === todayStr()).length;
  const unpaid = db.invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIAL');
  const unpaidTotal = unpaid.reduce((a, i) => a + (i.amount - i.paidAmount), 0);

  const series = useMemo(() => dailySeries(14), []);
  const byOutlet = useMemo(() => omzetByOutlet(mStart, mEnd), [mStart, mEnd]);
  const top = useMemo(() => topProducts(mStart, mEnd, 6), [mStart, mEnd]);
  const outletColors = ['#1f4b85', '#dba63e', '#17835a', '#2c6fb0', '#c24545'];

  if (user.role === 'GURU') {
    const subjects = db.subjects.filter((s) => s.teacherId === user.id);
    const kelasIds = [...new Set(subjects.map((s) => s.kelasId))];
    const recentMem = db.memRecords.filter((m) => m.teacherId === user.id).slice(0, 6);
    return (
      <div className="space-y-4">
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Mapel diampu" value={subjects.length} icon={<IcCap size={17} />} tone="navy" />
          <Stat label="Kelas" value={kelasIds.length} icon={<IcUsers size={17} />} tone="info" />
          <Stat label="Setoran hafalan" value={db.memRecords.filter((m) => m.teacherId === user.id).length} icon={<IcMoonStar size={17} />} tone="gold" />
          <Stat label="Sesi absensi hari ini" value={db.sessions.filter((s) => new Date(s.startsAt).toDateString() === todayStr()).length} icon={<IcClipboard size={17} />} tone="ok" onClick={() => nav('#/absensi')} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Mata pelajaran Anda" sub="Hanya kelas/mapel yang menjadi tanggung jawab Anda" pad={false}>
            {subjects.length === 0 ? (
              <Empty title="Belum ada mapel" desc="Admin belum menetapkan mata pelajaran untuk Anda." />
            ) : (
              <TWrap>
                <THead cols={['Kode', 'Mapel', 'Kelas', 'Aksi']} />
                <tbody>
                  {subjects.map((s) => (
                    <TRow key={s.id}>
                      <TD className="font-bold tnum">{s.code}</TD>
                      <TD>{s.name}</TD>
                      <TD>{db.kelas.find((k) => k.id === s.kelasId)?.name}</TD>
                      <TD>
                        <button className="text-xs font-bold text-info hover:underline" onClick={() => nav('#/akademik')}>
                          Input nilai →
                        </button>
                      </TD>
                    </TRow>
                  ))}
                </tbody>
              </TWrap>
            )}
          </Card>
          <Card title="Setoran hafalan terakhir" pad={false}>
            <TWrap>
              <THead cols={['Santri', 'Surah', 'Ayat', 'Kualitas']} />
              <tbody>
                {recentMem.map((m) => (
                  <TRow key={m.id}>
                    <TD><SantriChip id={m.santriId} size="sm" /></TD>
                    <TD className="font-semibold">{m.surah}</TD>
                    <TD className="tnum">{m.fromAyah}–{m.toAyah}</TD>
                    <TD><Badge tone={statusTone(m.quality)}>{m.quality}</Badge></TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          </Card>
        </div>
      </div>
    );
  }

  if (user.role === 'LAUNDRY') {
    const orders = db.laundryOrders;
    const q = (st: string) => orders.filter((o) => o.status === st).length;
    return (
      <div className="space-y-4">
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Diterima" value={q('RECEIVED')} icon={<IcWasher size={17} />} tone="info" onClick={() => nav('#/laundry')} />
          <Stat label="Dicuci / dikeringkan" value={q('WASHING') + q('DRYING')} icon={<IcWasher size={17} />} tone="warn" onClick={() => nav('#/laundry')} />
          <Stat label="Siap diambil" value={q('READY')} icon={<IcWasher size={17} />} tone="ok" onClick={() => nav('#/laundry')} />
          <Stat label="Belum dibayar" value={orders.filter((o) => !o.paidAt).length} icon={<IcWallet size={17} />} tone="danger" onClick={() => nav('#/laundry')} />
        </div>
        <Card title="Order aktif" pad={false}>
          <TWrap>
            <THead cols={['No', 'Santri', 'Berat', 'Total', 'Status', 'Pembayaran']} />
            <tbody>
              {orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').map((o) => (
                <TRow key={o.id} onClick={() => nav('#/laundry')}>
                  <TD className="font-bold tnum">{o.number}</TD>
                  <TD><SantriChip id={o.santriId} size="sm" /></TD>
                  <TD className="tnum">{o.weightKg} kg</TD>
                  <TD className="font-bold tnum">{rp(o.total)}</TD>
                  <TD><Badge tone={statusTone(o.status)}>{o.status}</Badge></TD>
                  <TD>{o.paidAt ? <Badge tone="ok">LUNAS</Badge> : <Badge tone="danger">BELUM</Badge>}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
      </div>
    );
  }

  if (user.role === 'PERPUS') {
    const active = db.loans.filter((l) => l.status === 'DIPINJAM');
    const overdue = active.filter((l) => new Date(l.dueDate).getTime() < Date.now());
    return (
      <div className="space-y-4">
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Judul buku" value={db.books.length} icon={<IcBox size={17} />} tone="navy" onClick={() => nav('#/perpustakaan')} />
          <Stat label="Sedang dipinjam" value={active.length} icon={<IcReceipt size={17} />} tone="info" onClick={() => nav('#/perpustakaan')} />
          <Stat label="Terlambat" value={overdue.length} icon={<IcAlert size={17} />} tone="danger" onClick={() => nav('#/perpustakaan')} />
          <Stat label="Total denda" value={rp(active.reduce((a, l) => a + l.fine, 0))} icon={<IcWallet size={17} />} tone="warn" />
        </div>
        <Card title="Peminjaman aktif" pad={false}>
          <TWrap>
            <THead cols={['Buku', 'Santri', 'Pinjam', 'Jatuh tempo', 'Status']} />
            <tbody>
              {active.map((l) => (
                <TRow key={l.id} onClick={() => nav('#/perpustakaan')}>
                  <TD className="font-semibold">{db.books.find((b) => b.id === l.bookId)?.title}</TD>
                  <TD><SantriChip id={l.santriId} size="sm" /></TD>
                  <TD className="tnum">{fmtDate(l.loanDate)}</TD>
                  <TD className="tnum">{fmtDate(l.dueDate)}</TD>
                  <TD>{new Date(l.dueDate).getTime() < Date.now() ? <Badge tone="danger">TERLAMBAT</Badge> : <Badge tone="info">DIPINJAM</Badge>}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
      </div>
    );
  }

  if (user.role === 'PENGURUS') {
    const sessions = db.sessions.filter((s) => !s.closedAt && new Date(s.endsAt).getTime() > Date.now());
    return (
      <div className="space-y-4">
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Absensi tercatat hari ini" value={absenToday} icon={<IcClipboard size={17} />} tone="ok" onClick={() => nav('#/absensi')} />
          <Stat label="Sesi aktif" value={sessions.length} icon={<IcCal size={17} />} tone="info" onClick={() => nav('#/absensi')} />
          <Stat label="Pelanggaran bulan ini" value={pelanggaran} icon={<IcAlert size={17} />} tone="danger" onClick={() => nav('#/pelanggaran')} />
          <Stat label="Santri aktif" value={santriAktif} icon={<IcSantri size={17} />} tone="navy" onClick={() => nav('#/santri')} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Sesi absensi berjalan" pad={false}>
            {sessions.length === 0 ? (
              <Empty title="Tidak ada sesi aktif" desc="Buka sesi absensi baru dari halaman Absensi." icon={<IcClipboard size={20} />} />
            ) : (
              <TWrap>
                <THead cols={['Sesi', 'Jenis', 'Unit', 'Berakhir', 'Hadir']} />
                <tbody>
                  {sessions.map((s) => (
                    <TRow key={s.id} onClick={() => nav('#/absensi')}>
                      <TD className="font-semibold">{s.name}</TD>
                      <TD><Badge tone="info">{s.type}</Badge></TD>
                      <TD>{s.unit}</TD>
                      <TD className="tnum">{fmtTime(s.endsAt)}</TD>
                      <TD className="font-bold tnum">{db.attendance.filter((a) => a.sessionId === s.id).length}</TD>
                    </TRow>
                  ))}
                </tbody>
              </TWrap>
            )}
          </Card>
          <Card title="Pelanggaran terbaru" pad={false}>
            <TWrap>
              <THead cols={['Santri', 'Jenis', 'Poin', 'Status']} />
              <tbody>
                {db.violations.slice(0, 6).map((v) => (
                  <TRow key={v.id} onClick={() => nav('#/pelanggaran')}>
                    <TD><SantriChip id={v.santriId} size="sm" /></TD>
                    <TD>{db.violationTypes.find((t) => t.id === v.typeId)?.name}</TD>
                    <TD className="font-bold text-danger tnum">+{v.points}</TD>
                    <TD><Badge tone={statusTone(v.status)}>{v.status}</Badge></TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          </Card>
        </div>
      </div>
    );
  }

  /* ---- kasir / bendahara / admin / super admin ---- */
  const isKasir = user.role === 'KASIR';
  const kasirOutlet = user.outletId;
  const lowStock = db.products.filter((p) => p.stock < 15 && p.stock < 500 && p.status === 'aktif');

  return (
    <div className="space-y-4">
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {!isKasir && <Stat label="Santri aktif" value={num(santriAktif)} sub={`${santriBaru} santri baru bulan ini`} icon={<IcSantri size={17} />} tone="navy" onClick={() => nav('#/santri')} />}
        <Stat label="Transaksi hari ini" value={num(salesToday.length)} sub={isKasir ? `Outlet: ${outletById(kasirOutlet)?.name ?? 'Semua'}` : 'Semua outlet'} icon={<IcCart size={17} />} tone="info" onClick={() => (isKasir ? nav('#/pos') : nav('#/laporan'))} />
        <Stat label="Omzet hari ini" value={rp(omzetToday)} sub="Koperasi + kantin" icon={<IcReceipt size={17} />} tone="gold" onClick={() => nav(isKasir ? '#/pos' : '#/laporan')} />
        <Stat label="Saldo seluruh santri" value={rp(totalCirculatingBalance())} sub={`${db.wallets.length} wallet aktif`} icon={<IcWallet size={17} />} tone="ok" onClick={() => nav('#/wallet')} />
        {!isKasir && <Stat label="Top up hari ini" value={rp(topupToday)} icon={<IcWallet size={17} />} tone="ok" onClick={() => nav('#/topup')} />}
        {!isKasir && <Stat label="Piutang tagihan" value={rp(unpaidTotal)} sub={`${unpaid.length} tagihan belum lunas`} icon={<IcTag size={17} />} tone="danger" onClick={() => nav('#/tagihan')} />}
        {!isKasir && <Stat label="Order laundry aktif" value={num(laundryAktif)} icon={<IcWasher size={17} />} tone="warn" onClick={() => nav('#/laundry')} />}
        {!isKasir && <Stat label="Absensi hari ini" value={num(absenToday)} sub={`${pelanggaran} pelanggaran bulan ini`} icon={<IcClipboard size={17} />} tone="info" onClick={() => nav('#/absensi')} />}
        {isKasir && <Stat label="Stok menipis" value={num(lowStock.length)} sub="Perlu restock" icon={<IcBox size={17} />} tone="warn" onClick={() => nav('#/produk')} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Grafik omzet 14 hari" sub="Seluruh outlet · hover untuk detail">
          <AreaChart data={series.map((s) => s.omzet)} labels={series.map((s) => s.label)} />
        </Card>
        <div className="space-y-4">
          <Card title="Omzet per outlet" sub="Bulan berjalan">
            <Donut slices={byOutlet.filter((o) => o.omzet > 0).map((o, i) => ({ label: o.name, value: o.omzet, color: outletColors[i % outletColors.length]! }))} />
          </Card>
          <Card title="Produk terlaris" sub="Bulan berjalan · qty">
            <Bars data={top.map((t) => ({ label: t.name.split(' ')[0]!, value: t.qty }))} />
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Transaksi terbaru" pad={false} action={
          <button className="text-xs font-bold text-info hover:underline" onClick={() => nav(isKasir ? '#/pos' : '#/laporan')}>
            Lihat semua →
          </button>
        }>
          <TWrap>
            <THead cols={['No. Transaksi', 'Santri', 'Outlet', 'Metode', 'Total', 'Waktu']} />
            <tbody>
              {[...db.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7).map((s) => (
                <TRow key={s.id}>
                  <TD className="font-bold tnum">{s.number}</TD>
                  <TD>{s.santriId ? <SantriChip id={s.santriId} size="sm" /> : <span className="text-xs text-mute">Tunai</span>}</TD>
                  <TD>{outletById(s.outletId)?.code}</TD>
                  <TD><Badge tone={s.method === 'SALDO_NFC' ? 'navy' : 'ok'}>{s.method === 'SALDO_NFC' ? 'SALDO' : 'CASH'}</Badge></TD>
                  <TD className="font-bold tnum">{rp(s.total)}</TD>
                  <TD className="text-mute tnum">{timeAgo(s.createdAt)}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
        <Card title="Aktivitas terbaru" sub="Dari audit trail" pad={false}>
          <div className="divide-y divide-line/70">
            {db.audits.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold leading-snug">{a.details}</p>
                  <p className="mt-0.5 text-[10.5px] text-mute">
                    {a.userName} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
