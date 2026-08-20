/* ===== Modul 17: Portal Wali Santri =====
   Satu wali bisa memiliki beberapa anak — tersedia pemilih anak. */

import { useState } from 'react';
import type { User } from '../lib/types';
import { activeCardOf, balanceOf, db, kelasById, kamarById, useDB, waliChildren, violationPoints } from '../lib/store';
import { fmtDate, fmtDT, rp, cx, timeAgo } from '../lib/util';
import { Avatar, Badge, Card, Empty, Stat, statusTone, Tabs, THead, TRow, TD, TWrap } from '../components/ui';
import { useHashRoute } from '../components/layout';
import { IcAlert, IcCal, IcCard, IcClipboard, IcMoonStar, IcReceipt, IcTag, IcWallet } from '../components/icons';

export default function WaliPortal({ user }: { user: User }) {
  useDB();
  const [, nav] = useHashRoute();
  const children = user.waliId ? waliChildren(user.waliId) : [];
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const child = children.find((c) => c.id === childId) ?? children[0];
  const [tab, setTab] = useState('ringkasan');

  if (!child) return <Empty title="Belum ada anak terdaftar" desc="Hubungi admin pesantren untuk menautkan akun wali Anda." />;

  const txs = db.walletTxs.filter((t) => t.santriId === child.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const invoices = db.invoices.filter((i) => i.santriId === child.id);
  const unpaid = invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIAL').reduce((a, i) => a + (i.amount - i.paidAmount), 0);
  const absen = db.attendance.filter((a) => a.santriId === child.id);
  const hadirRate = absen.length ? Math.round((absen.filter((a) => a.status === 'HADIR').length / absen.length) * 100) : 100;
  const mems = db.memRecords.filter((m) => m.santriId === child.id);
  const ayahs = mems.reduce((a, m) => a + (m.toAyah - m.fromAyah + 1), 0);
  const grades = db.grades.filter((g) => g.santriId === child.id);
  const viols = db.violations.filter((v) => v.santriId === child.id);
  const card = activeCardOf(child.id);
  const notifs = db.notifs.filter((n) => n.userId === user.id).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* pemilih anak */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <button key={c.id} onClick={() => { setChildId(c.id); setTab('ringkasan'); }} className={cx('flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all', c.id === child.id ? 'border-gold-400 bg-gold-50 shadow-sm' : 'border-line bg-surface hover:border-navy-300')}>
              <Avatar name={c.name} color={c.color} size={34} />
              <span className="text-left">
                <span className="block text-xs font-bold">{c.name}</span>
                <span className="block text-[10.5px] text-mute">{kelasById(c.kelasId)?.name} · {rp(balanceOf(c.id))}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* profil anak */}
      <Card pad={false}>
        <div className="motif flex flex-wrap items-center gap-4 rounded-t-xl bg-navy-950 p-4">
          <span className="pulse-ring rounded-full"><Avatar name={child.name} color={child.color} size={62} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-white">{child.name}</h2>
            <p className="text-[12.5px] text-navy-300 tnum">
              NIS {child.nis} · Kelas {kelasById(child.kelasId)?.name} · Kamar {kamarById(child.kamarId)?.name ?? '-'} · {db.asrama.find((a) => a.id === kamarById(child.kamarId)?.asramaId)?.name ?? ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="gold"><IcWallet size={11} /> Saldo {rp(balanceOf(child.id))}</Badge>
              {card ? <Badge tone="ok"><IcCard size={11} /> Kartu aktif</Badge> : <Badge tone="warn"><IcCard size={11} /> Tanpa kartu</Badge>}
              <Badge tone={statusTone(child.status)}>{child.status}</Badge>
            </div>
          </div>
        </div>
        <div className="stagger grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {[
            { l: 'Tunggakan', v: rp(unpaid), tone: unpaid > 0 ? 'text-danger' : 'text-ok', go: '#/tagihan' },
            { l: 'Kehadiran', v: `${hadirRate}%`, tone: 'text-ok' },
            { l: 'Hafalan', v: `${ayahs} ayat`, tone: 'text-navy-800' },
            { l: 'Poin aktif', v: `${violationPoints(child.id)}`, tone: violationPoints(child.id) > 0 ? 'text-warn' : 'text-ok' },
          ].map((s) => (
            <button key={s.l} onClick={() => s.go && nav(s.go)} className="bg-surface p-4 text-left transition-colors hover:bg-navy-50">
              <span className="block text-[10.5px] font-bold uppercase tracking-wide text-mute">{s.l}</span>
              <span className={cx('font-display mt-0.5 block text-lg font-bold tnum', s.tone)}>{s.v}</span>
            </button>
          ))}
        </div>
      </Card>

      <Tabs
        tabs={[
          { key: 'ringkasan', label: 'Ringkasan' },
          { key: 'saldo', label: 'Saldo & Transaksi' },
          { key: 'nilai', label: 'Nilai' },
          { key: 'hafalan', label: `Hafalan (${mems.length})` },
          { key: 'absensi', label: 'Absensi' },
          { key: 'pelanggaran', label: 'Pelanggaran' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'ringkasan' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Transaksi & saldo terbaru" pad={false} action={<button className="text-xs font-bold text-info hover:underline" onClick={() => setTab('saldo')}>Semua →</button>}>
            {txs.length === 0 ? <Empty title="Belum ada transaksi" /> : (
              <div className="divide-y divide-line/70">
                {txs.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', t.amount >= 0 ? 'bg-okbg text-ok' : 'bg-dangerbg text-danger')}>
                      {t.amount >= 0 ? <IcWallet size={15} /> : <IcReceipt size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{t.description}</p>
                      <p className="text-[10.5px] text-mute tnum">{timeAgo(t.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cx('text-xs font-bold tnum', t.amount >= 0 ? 'text-ok' : 'text-danger')}>{t.amount >= 0 ? '+' : ''}{rp(t.amount)}</p>
                      <p className="text-[10px] text-mute tnum">saldo {rp(t.balanceAfter)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="space-y-4">
            <Card title="Tagihan" pad={false} action={<button className="text-xs font-bold text-info hover:underline" onClick={() => nav('#/tagihan')}>Detail →</button>}>
              {invoices.length === 0 ? <Empty title="Tidak ada tagihan" /> : (
                <div className="divide-y divide-line/70">
                  {invoices.slice(0, 5).map((i) => (
                    <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700"><IcTag size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{i.label}</p>
                        <p className="text-[10.5px] text-mute">Jatuh tempo {fmtDate(i.dueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold tnum">{rp(i.amount)}</p>
                        <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Info dari pesantren" pad={false}>
              {notifs.length === 0 ? <Empty title="Tidak ada notifikasi" /> : (
                <div className="divide-y divide-line/70">
                  {notifs.map((n) => (
                    <div key={n.id} className="px-4 py-2.5">
                      <p className="text-xs font-bold">{n.title} {n.channel === 'whatsapp' && <Badge tone="ok">WA</Badge>}</p>
                      <p className="mt-0.5 whitespace-pre-line text-[11px] leading-snug text-mute">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'saldo' && (
        <Card title="Mutasi saldo" sub="Saldo anak Anda tersimpan aman di server pesantren" pad={false}>
          <TWrap>
            <THead cols={['Waktu', 'Keterangan', 'Nominal', 'Saldo']} />
            <tbody>
              {db.walletTxs.filter((t) => t.santriId === child.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
                <TRow key={t.id}>
                  <TD className="tnum text-mute">{fmtDT(t.createdAt)}</TD>
                  <TD className="font-semibold">{t.description}</TD>
                  <TD className={cx('font-bold tnum', t.amount >= 0 ? 'text-ok' : 'text-danger')}>{t.amount >= 0 ? '+' : ''}{rp(t.amount)}</TD>
                  <TD className="font-bold tnum">{rp(t.balanceAfter)}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
      )}

      {tab === 'nilai' && (
        <Card title="Nilai akademik" pad={false}>
          {grades.length === 0 ? <Empty title="Belum ada nilai" icon={<IcClipboard size={20} />} /> : (
            <TWrap>
              <THead cols={['Mapel', 'Jenis', 'Nilai', 'Term']} />
              <tbody>
                {grades.map((g) => (
                  <TRow key={g.id}>
                    <TD className="font-semibold">{db.subjects.find((s) => s.id === g.subjectId)?.name}</TD>
                    <TD><Badge tone="info">{g.kind}</Badge></TD>
                    <TD><span className={cx('font-display text-base font-bold tnum', g.score >= 75 ? 'text-ok' : 'text-danger')}>{g.score}</span></TD>
                    <TD className="text-mute">{g.term}</TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'hafalan' && (
        <Card title="Perkembangan hafalan" sub="Setoran yang diverifikasi guru tahfidz" pad={false}>
          {mems.length === 0 ? <Empty title="Belum ada setoran" icon={<IcMoonStar size={20} />} /> : (
            <TWrap>
              <THead cols={['Tanggal', 'Surah', 'Ayat', 'Predikat', 'Catatan']} />
              <tbody>
                {mems.map((m) => (
                  <TRow key={m.id}>
                    <TD className="tnum">{fmtDate(m.date)}</TD>
                    <TD className="font-semibold">{m.surah}</TD>
                    <TD className="tnum">{m.fromAyah}–{m.toAyah}</TD>
                    <TD><Badge tone={statusTone(m.quality)}>{m.quality}</Badge></TD>
                    <TD className="text-mute">{m.note || '-'}</TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'absensi' && (
        <Card title="Riwayat kehadiran" pad={false}>
          {absen.length === 0 ? <Empty title="Belum ada data absensi" icon={<IcCal size={20} />} /> : (
            <TWrap>
              <THead cols={['Waktu', 'Sesi', 'Jenis', 'Status']} />
              <tbody>
                {[...absen].sort((a, b) => b.at.localeCompare(a.at)).map((a) => {
                  const s = db.sessions.find((x) => x.id === a.sessionId);
                  return (
                    <TRow key={a.id}>
                      <TD className="tnum text-mute">{fmtDT(a.at)}</TD>
                      <TD className="font-semibold">{s?.name}</TD>
                      <TD><Badge tone="info">{s?.type}</Badge></TD>
                      <TD><Badge tone={statusTone(a.status)}>{a.status}</Badge></TD>
                    </TRow>
                  );
                })}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'pelanggaran' && (
        <Card title="Catatan pembinaan" sub="Transparansi untuk wali — setiap catatan disertai tindakan" pad={false}>
          {viols.length === 0 ? <Empty title="Alhamdulillah, tidak ada catatan" icon={<IcAlert size={20} />} /> : (
            <TWrap>
              <THead cols={['Tanggal', 'Catatan', 'Poin', 'Tindakan', 'Status']} />
              <tbody>
                {viols.map((v) => (
                  <TRow key={v.id}>
                    <TD className="tnum">{fmtDate(v.date)}</TD>
                    <TD>
                      <span className="font-semibold">{db.violationTypes.find((t) => t.id === v.typeId)?.name}</span>
                      <span className="block text-[10.5px] text-mute">{v.note}</span>
                    </TD>
                    <TD><Badge tone="danger">+{v.points}</Badge></TD>
                    <TD className="text-mute">{v.action || '-'}</TD>
                    <TD><Badge tone={statusTone(v.status)}>{v.status}</Badge></TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Transaksi tercatat" value={db.walletTxs.filter((t) => t.santriId === child.id).length} icon={<IcReceipt size={16} />} tone="navy" />
        <Stat label="Setoran hafalan" value={mems.length} icon={<IcMoonStar size={16} />} tone="gold" />
        <Stat label="Sesi dihadiri" value={absen.length} icon={<IcClipboard size={16} />} tone="ok" />
        <Stat label="Tagihan lunas" value={invoices.filter((i) => i.status === 'PAID').length} icon={<IcTag size={16} />} tone="info" />
      </div>
    </div>
  );
}
