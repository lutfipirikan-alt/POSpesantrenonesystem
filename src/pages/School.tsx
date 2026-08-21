/* ===== Modul 12–15: Absensi (sesi), Akademik & Nilai, Hafalan, Pelanggaran ===== */

import { useMemo, useState } from 'react';
import type { User } from '../lib/types';
import { db, useDB, violationPoints } from '../lib/store';
import { addMemRecord, addViolation, closeSession, openSession, saveGrade, setViolationStatus, tapIn } from '../lib/services/ops';
import { resolveCard } from '../lib/services/nfc';
import { cx, fmtDate, fmtDT, fmtTime } from '../lib/util';
import { Avatar, Badge, Btn, Card, Empty, Field, inputCls, Modal, SearchBox, statusTone, Tabs, THead, TRow, TD, TWrap, useToast, useNfcScan } from '../components/ui';
import { PageHead, SantriChip, useNow } from '../components/layout';
import { IcAlert, IcCal, IcCap, IcCheck, IcClipboard, IcMoonStar, IcPlus, IcScan, IcX } from '../components/icons';

/* ================= ABSENSI ================= */

export function AttendancePage({ user }: { user: User }) {
  useDB();
  const now = useNow(10_000);
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [create, setCreate] = useState(false);
  const [nf, setNf] = useState({ name: '', type: 'shalat' as const, unit: 'Masjid Al-Ikhlas', dur: 60 });

  useNfcScan((uid) => {
    if (!armed || !activeId) return;
    try {
      const res = tapIn(activeId, uid, user);
      toast.push('ok', `${res.santri.nickname} — ${res.status}`, res.status === 'TERLAMBAT' ? 'Tercatat terlambat (melebihi 10 menit).' : 'Kehadiran tercatat.');
    } catch (e) {
      toast.push('err', 'Absensi ditolak', e instanceof Error ? e.message : '');
    }
  });

  const openSessions = db.sessions.filter((s) => !s.closedAt && new Date(s.endsAt).getTime() > now.getTime());
  const active = db.sessions.find((s) => s.id === activeId);
  const records = db.attendance.filter((a) => a.sessionId === activeId).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-4">
      <PageHead
        title="Absensi NFC"
        desc="Setiap sesi punya ID & periode aktif — satu scan NFC tidak otomatis menjadi absensi di semua konteks"
        actions={<Btn size="sm" onClick={() => setCreate(true)}><IcPlus size={14} /> Buka Sesi</Btn>}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-mute">Sesi aktif ({openSessions.length})</p>
          {openSessions.length === 0 && (
            <Card><Empty title="Tidak ada sesi" desc="Buka sesi absensi baru." icon={<IcClipboard size={20} />} /></Card>
          )}
          {openSessions.map((s) => {
            const cnt = db.attendance.filter((a) => a.sessionId === s.id).length;
            const isActive = activeId === s.id;
            return (
              <button key={s.id} onClick={() => { setActiveId(s.id); setArmed(false); }} className={cx('w-full rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5', isActive ? 'border-gold-400 bg-gold-50 shadow-sm' : 'border-line bg-surface')}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-[13.5px] font-bold">{s.name}</span>
                  <Badge tone="info">{s.type}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-mute">{s.unit} · {fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-ok tnum">{cnt} hadir</span>
                  <span className={cx('tnum', new Date(s.endsAt).getTime() - now.getTime() < 15 * 60_000 ? 'text-warn' : 'text-mute')}>
                    sisa {Math.max(0, Math.round((new Date(s.endsAt).getTime() - now.getTime()) / 60_000))} mnt
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <Card className="xl:col-span-2" title={active ? active.name : 'Pilih sesi'} sub={active ? `${active.unit} · ${fmtTime(active.startsAt)}–${fmtTime(active.endsAt)}` : 'Klik sesi di sebelah kiri'}
          action={active && (
            <div className="flex gap-2">
              <Btn size="sm" variant={armed ? 'gold' : 'primary'} className={armed ? 'pulse-ring' : ''} onClick={() => setArmed(!armed)}>
                <IcScan size={14} /> {armed ? 'Menunggu tempelan…' : 'Scan Absensi'}
              </Btn>
              <Btn size="sm" variant="outline" onClick={() => { closeSession(active.id, user); toast.push('info', 'Sesi ditutup'); setActiveId(null); }}>
                <IcX size={13} /> Tutup Sesi
              </Btn>
            </div>
          )}>
          {!active ? (
            <Empty title="Belum ada sesi dipilih" icon={<IcClipboard size={20} />} />
          ) : (
            <div className="relative overflow-hidden">
              {armed && <span className="scan-beam" />}
              {records.length === 0 ? (
                <Empty title="Belum ada yang absen" desc={armed ? 'Tempelkan kartu santri di NFC Simulator…' : 'Tekan "Scan Absensi" lalu tempel kartu.'} />
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {records.map((r) => (
                    <div key={r.id} className="anim-pop flex items-center gap-2.5 rounded-lg border border-line bg-bg px-3 py-2">
                      <Avatar name={db.santri.find((s) => s.id === r.santriId)?.name ?? '?'} color={db.santri.find((s) => s.id === r.santriId)?.color} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{db.santri.find((s) => s.id === r.santriId)?.name}</p>
                        <p className="text-[10.5px] text-mute tnum">{fmtTime(r.at)}</p>
                      </div>
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Riwayat sesi" pad={false}>
        <TWrap>
          <THead cols={['Sesi', 'Jenis', 'Unit', 'Tanggal', 'Periode', 'Hadir', 'Terlambat', 'Status']} />
          <tbody>
            {db.sessions.map((s) => {
              const recs = db.attendance.filter((a) => a.sessionId === s.id);
              return (
                <TRow key={s.id} onClick={() => setActiveId(s.id)}>
                  <TD className="font-semibold">{s.name}</TD>
                  <TD><Badge tone="info">{s.type}</Badge></TD>
                  <TD className="text-mute">{s.unit}</TD>
                  <TD className="tnum">{fmtDate(s.startsAt)}</TD>
                  <TD className="tnum text-mute">{fmtTime(s.startsAt)}–{fmtTime(s.endsAt)}</TD>
                  <TD className="font-bold text-ok tnum">{recs.filter((r) => r.status === 'HADIR').length}</TD>
                  <TD className="font-bold text-warn tnum">{recs.filter((r) => r.status === 'TERLAMBAT').length}</TD>
                  <TD>{s.closedAt || new Date(s.endsAt).getTime() < now.getTime() ? <Badge tone="mute">SELESAI</Badge> : <Badge tone="ok">BERJALAN</Badge>}</TD>
                </TRow>
              );
            })}
          </tbody>
        </TWrap>
      </Card>

      <Modal open={create} onClose={() => setCreate(false)} title="Buka sesi absensi" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCreate(false)}>Batal</Btn>
            <Btn disabled={!nf.name.trim()} onClick={() => {
              const s = openSession(nf.name, nf.type, nf.unit, nf.dur, user);
              toast.push('ok', 'Sesi dibuka', `${s.name} aktif ${nf.dur} menit.`);
              setCreate(false);
              setActiveId(s.id);
              setNf({ ...nf, name: '' });
            }}>Buka Sesi</Btn>
          </>
        }>
        <div className="space-y-3">
          <Field label="Nama sesi" req><input className={inputCls} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="cth: Shalat Dzuhur Berjamaah" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis">
              <select className={inputCls} value={nf.type} onChange={(e) => setNf({ ...nf, type: e.target.value as typeof nf.type })}>
                {['masuk', 'kelas', 'shalat', 'kegiatan', 'asrama'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Durasi (menit)"><input type="number" className={inputCls} value={nf.dur} onChange={(e) => setNf({ ...nf, dur: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Lokasi / unit"><input className={inputCls} value={nf.unit} onChange={(e) => setNf({ ...nf, unit: e.target.value })} /></Field>
          <p className="text-[11px] text-mute">Scan di luar periode aktif sesi akan ditolak. Absen &gt;10 menit dari awal sesi = TERLAMBAT.</p>
        </div>
      </Modal>
    </div>
  );
}

/* ================= AKADEMIK ================= */

export function AcademicPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const isGuru = user.role === 'GURU';
  const subjects = isGuru ? db.subjects.filter((s) => s.teacherId === user.id) : db.subjects;
  const [kelasId, setKelasId] = useState(subjects[0]?.kelasId ?? 'KLS-02');
  const [subId, setSubId] = useState(subjects[0]?.id ?? '');
  const [input, setInput] = useState(false);
  const [gf, setGf] = useState({ santriId: '', kind: 'UTS' as 'Harian' | 'UTS' | 'UAS' | 'Tugas', score: 80, note: '' });

  const kelasSubjects = subjects.filter((s) => s.kelasId === kelasId);
  const current = kelasSubjects.find((s) => s.id === subId) ?? kelasSubjects[0];
  const santriKelas = db.santri.filter((s) => s.kelasId === kelasId && s.status === 'aktif' && !s.deletedAt);
  const grades = db.grades.filter((g) => g.subjectId === current?.id);

  const avg = (sid: string) => {
    const gs = grades.filter((g) => g.santriId === sid);
    if (!gs.length) return null;
    return Math.round(gs.reduce((a, g) => a + g.score, 0) / gs.length);
  };

  return (
    <div className="space-y-4">
      <PageHead
        title="Akademik & Nilai"
        desc={`${db.settings.termYear} · ${db.settings.term}${isGuru ? ' · hanya mapel yang Anda ampu' : ''}`}
        actions={!isGuru || subjects.some((s) => s.id === current?.id) ? <Btn size="sm" onClick={() => { setGf({ santriId: santriKelas[0]?.id ?? '', kind: 'UTS', score: 80, note: '' }); setInput(true); }} disabled={!current}><IcPlus size={14} /> Input Nilai</Btn> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select className={cx(inputCls, 'w-auto')} value={kelasId} onChange={(e) => { setKelasId(e.target.value); const s = db.subjects.find((x) => x.kelasId === e.target.value); if (s) setSubId(s.id); }}>
          {db.kelas.map((k) => <option key={k.id} value={k.id}>Kelas {k.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {kelasSubjects.map((s) => (
            <button key={s.id} onClick={() => setSubId(s.id)} className={cx('rounded-full border px-3 py-1 text-xs font-bold transition-all', current?.id === s.id ? 'border-navy-800 bg-navy-800 text-white' : 'border-line bg-surface text-mute hover:text-ink')}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {current && (
        <Card title={`Nilai ${current.name} — Kelas ${db.kelas.find((k) => k.id === kelasId)?.name}`} sub={`Guru: ${db.users.find((u) => u.id === current.teacherId)?.name ?? '-'}`} pad={false}>
          <TWrap>
            <THead cols={['Santri', 'Harian', 'UTS', 'UAS', 'Tugas', 'Rata-rata']} />
            <tbody>
              {santriKelas.map((s) => {
                const g = (kind: string) => grades.find((x) => x.santriId === s.id && x.kind === kind);
                const a = avg(s.id);
                return (
                  <TRow key={s.id}>
                    <TD><SantriChip id={s.id} size="sm" /></TD>
                    {['Harian', 'UTS', 'UAS', 'Tugas'].map((k) => (
                      <TD key={k} className="tnum">{g(k) ? <span className={cx('font-bold', g(k)!.score >= 75 ? 'text-ok' : 'text-danger')}>{g(k)!.score}</span> : <span className="text-mute">—</span>}</TD>
                    ))}
                    <TD>{a !== null ? <Badge tone={a >= 75 ? 'ok' : 'danger'}>{a}</Badge> : <span className="text-mute">—</span>}</TD>
                  </TRow>
                );
              })}
            </tbody>
          </TWrap>
          {santriKelas.length === 0 && <Empty title="Tidak ada santri di kelas ini" />}
        </Card>
      )}

      <Modal open={input} onClose={() => setInput(false)} title={`Input nilai — ${current?.name}`} w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setInput(false)}>Batal</Btn>
            <Btn disabled={!gf.santriId || !current} onClick={() => {
              if (!current) return;
              try {
                saveGrade({ santriId: gf.santriId, subjectId: current.id, term: `${db.settings.termYear} ${db.settings.term}`, kind: gf.kind, score: gf.score, note: gf.note, teacherId: user.id }, user);
                toast.push('ok', 'Nilai tersimpan', `${db.santri.find((s) => s.id === gf.santriId)?.name}: ${gf.kind} = ${gf.score}`);
                setInput(false);
              } catch (e) {
                toast.push('err', 'Ditolak', e instanceof Error ? e.message : '');
              }
            }}>Simpan Nilai</Btn>
          </>
        }>
        <div className="space-y-3">
          <Field label="Santri" req>
            <select className={inputCls} value={gf.santriId} onChange={(e) => setGf({ ...gf, santriId: e.target.value })}>
              <option value="">— pilih —</option>
              {santriKelas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis">
              <select className={inputCls} value={gf.kind} onChange={(e) => setGf({ ...gf, kind: e.target.value as typeof gf.kind })}>
                {['Harian', 'UTS', 'UAS', 'Tugas'].map((k) => <option key={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Nilai (0–100)" req><input type="number" className={inputCls} value={gf.score} onChange={(e) => setGf({ ...gf, score: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Catatan"><input className={inputCls} value={gf.note} onChange={(e) => setGf({ ...gf, note: e.target.value })} /></Field>
          {isGuru && <p className="text-[11px] text-mute">Server memverifikasi Anda adalah guru mapel ini — input untuk mapel lain akan ditolak.</p>}
        </div>
      </Modal>
    </div>
  );
}

/* ================= HAFALAN ================= */

const SURAH_LIST = ['An-Naba', 'An-Naziat', 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Insyiqaq', 'Al-Buruj', 'At-Tariq', 'Al-A’la', 'Al-Ghasyiyah', 'Al-Fajr', 'Al-Balad', 'Asy-Syams', 'Al-Lail', 'Ad-Duha', 'Al-Insyirah', 'At-Tin', 'Al-‘Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-‘Adiyat', 'Al-Qari’ah', 'At-Takatsur', 'Al-‘Asr', 'Al-Humazah', 'Al-Fil', 'Quraisy', 'Al-Ma’un', 'Al-Kautsar', 'Al-Kafirun', 'An-Nasr', 'Al-Lahab', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas', 'Al-Mulk', 'Al-Qalam'];

export function MemorizationPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [mf, setMf] = useState({ santriId: 'SAN-001', surah: 'An-Naba', from: 1, to: 10, quality: 'Jayyid Jiddan' as const, note: '' });

  const progress = useMemo(
    () =>
      db.santri
        .filter((s) => s.status === 'aktif' && !s.deletedAt)
        .map((s) => {
          const recs = db.memRecords.filter((m) => m.santriId === s.id);
          const ayahs = recs.reduce((a, m) => a + (m.toAyah - m.fromAyah + 1), 0);
          const last = recs[0];
          return { s, ayahs, count: recs.length, last };
        })
        .sort((a, b) => b.ayahs - a.ayahs),
    []
  );

  return (
    <div className="space-y-4">
      <PageHead
        title="Hafalan Al-Quran"
        desc="Target per kelas, setoran harian, dan pantauan kualitas — wali santri dapat melihat perkembangan"
        actions={<Btn size="sm" onClick={() => setAdd(true)}><IcPlus size={14} /> Catat Setoran</Btn>}
      />

      <div className="grid gap-2 lg:grid-cols-3">
        {db.memTargets.map((t) => (
          <div key={t.id} className="motif flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-950 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-400 text-navy-950"><IcMoonStar size={19} /></span>
            <div>
              <p className="font-display text-sm font-bold text-white">Kelas {db.kelas.find((k) => k.id === t.kelasId)?.name}</p>
              <p className="text-[11px] text-navy-300">{t.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Progres santri" sub="Total ayat tersimpan" pad={false}>
          <div className="divide-y divide-line/70">
            {progress.map(({ s, ayahs, count, last }) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={s.name} color={s.color} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{s.name}</p>
                  <p className="text-[10.5px] text-mute">{count} setoran{last ? ` · terakhir ${last.surah}` : ''}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-gold-400 transition-all duration-700" style={{ width: `${Math.min(100, (ayahs / 150) * 100)}%` }} />
                  </div>
                </div>
                <span className="font-display text-sm font-bold text-navy-800 tnum">{ayahs} <span className="text-[10px] font-normal text-mute">ayat</span></span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-2" title="Riwayat setoran" pad={false}>
          <TWrap>
            <THead cols={['Tanggal', 'Santri', 'Surah', 'Ayat', 'Kualitas', 'Catatan guru']} />
            <tbody>
              {db.memRecords.map((m) => (
                <TRow key={m.id}>
                  <TD className="tnum text-mute">{fmtDate(m.date)}</TD>
                  <TD><SantriChip id={m.santriId} size="sm" /></TD>
                  <TD className="font-semibold">{m.surah}</TD>
                  <TD className="tnum">{m.fromAyah}–{m.toAyah}</TD>
                  <TD><Badge tone={statusTone(m.quality)}>{m.quality}</Badge></TD>
                  <TD className="max-w-52 truncate text-mute">{m.note || '-'}</TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
      </div>

      <Modal open={add} onClose={() => setAdd(false)} title="Catat setoran hafalan" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Batal</Btn>
            <Btn onClick={() => {
              try {
                addMemRecord({ santriId: mf.santriId, surah: mf.surah, fromAyah: mf.from, toAyah: mf.to, date: new Date().toISOString(), quality: mf.quality, note: mf.note, teacherId: user.id }, user);
                toast.push('ok', 'Setoran tercatat', 'Wali santri menerima notifikasi.');
                setAdd(false);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              }
            }}>Simpan</Btn>
          </>
        }>
        <div className="space-y-3">
          <Field label="Santri" req>
            <select className={inputCls} value={mf.santriId} onChange={(e) => setMf({ ...mf, santriId: e.target.value })}>
              {db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Surah">
            <select className={inputCls} value={mf.surah} onChange={(e) => setMf({ ...mf, surah: e.target.value })}>
              {SURAH_LIST.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari ayat"><input type="number" className={inputCls} value={mf.from} onChange={(e) => setMf({ ...mf, from: Number(e.target.value) })} /></Field>
            <Field label="Sampai ayat"><input type="number" className={inputCls} value={mf.to} onChange={(e) => setMf({ ...mf, to: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Kualitas">
            <select className={inputCls} value={mf.quality} onChange={(e) => setMf({ ...mf, quality: e.target.value as typeof mf.quality })}>
              {['Mumtaz', 'Jayyid Jiddan', 'Jayyid', 'Maqbul'].map((kq) => <option key={kq}>{kq}</option>)}
            </select>
          </Field>
          <Field label="Catatan guru"><input className={inputCls} value={mf.note} onChange={(e) => setMf({ ...mf, note: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ================= PELANGGARAN ================= */

export function ViolationPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [add, setAdd] = useState(false);
  const [vf, setVf] = useState({ santriId: 'SAN-003', typeId: 'VT-01', date: new Date().toISOString().slice(0, 10), note: '', action: '' });

  const ranked = db.santri
    .filter((s) => !s.deletedAt)
    .map((s) => ({ s, pts: violationPoints(s.id) }))
    .filter((x) => x.pts > 0)
    .sort((a, b) => b.pts - a.pts);

  return (
    <div className="space-y-4">
      <PageHead
        title="Pelanggaran & Poin"
        desc="Jenis pelanggaran berbobot poin · wali menerima notifikasi · histori dapat dilihat wali sesuai izin"
        actions={<Btn size="sm" variant="danger" onClick={() => setAdd(true)}><IcPlus size={14} /> Catat Pelanggaran</Btn>}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Poin aktif per santri" pad={false}>
          {ranked.length === 0 ? <Empty title="Tidak ada poin aktif" /> : (
            <div className="divide-y divide-line/70">
              {ranked.map(({ s, pts }) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={s.name} color={s.color} size={32} />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{s.name}</span>
                  <Badge tone={pts >= 40 ? 'danger' : pts >= 20 ? 'warn' : 'info'}>{pts} poin</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="xl:col-span-2" title="Catatan pelanggaran" pad={false}>
          <TWrap>
            <THead cols={['Tanggal', 'Santri', 'Jenis', 'Poin', 'Petugas', 'Tindakan', 'Status', '']} />
            <tbody>
              {db.violations.map((v) => (
                <TRow key={v.id}>
                  <TD className="tnum text-mute">{fmtDate(v.date)}</TD>
                  <TD><SantriChip id={v.santriId} size="sm" /></TD>
                  <TD>
                    <span className="font-semibold">{db.violationTypes.find((t) => t.id === v.typeId)?.name}</span>
                    <span className="block max-w-48 truncate text-[10.5px] text-mute">{v.note}</span>
                  </TD>
                  <TD><Badge tone="danger">+{v.points}</Badge></TD>
                  <TD className="text-mute">{db.users.find((u) => u.id === v.officerId)?.name ?? '-'}</TD>
                  <TD className="max-w-40 truncate text-mute">{v.action || '-'}</TD>
                  <TD><Badge tone={statusTone(v.status)}>{v.status}</Badge></TD>
                  <TD>
                    {v.status !== 'SELESAI' && (
                      <div className="flex gap-1">
                        {v.status === 'TERCATAT' && <Btn variant="outline" size="sm" onClick={() => { setViolationStatus(v.id, 'DITINDAK', user); toast.push('info', 'Ditindaklanjuti'); }}>Tindak</Btn>}
                        <Btn variant="ghost" size="sm" onClick={() => { setViolationStatus(v.id, 'SELESAI', user); toast.push('ok', 'Selesai — poin tidak lagi dihitung'); }}><IcCheck size={13} /></Btn>
                      </div>
                    )}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </TWrap>
        </Card>
      </div>

      <Card title="Jenis pelanggaran & bobot poin" pad={false}>
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {db.violationTypes.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-line bg-bg px-3 py-2.5">
              <div>
                <p className="text-xs font-bold">{t.name}</p>
                <p className="text-[10.5px] text-mute">{t.category}</p>
              </div>
              <Badge tone={t.points >= 30 ? 'danger' : t.points >= 15 ? 'warn' : 'info'}>+{t.points}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={add} onClose={() => setAdd(false)} title="Catat pelanggaran" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAdd(false)}>Batal</Btn>
            <Btn variant="danger" onClick={() => {
              try {
                addViolation({ santriId: vf.santriId, typeId: vf.typeId, date: new Date(vf.date).toISOString(), note: vf.note, action: vf.action }, user);
                toast.push('ok', 'Pelanggaran tercatat', 'Poin bertambah & wali dinotifikasi.');
                setAdd(false);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              }
            }}>Catat</Btn>
          </>
        }>
        <div className="space-y-3">
          <Field label="Santri" req>
            <select className={inputCls} value={vf.santriId} onChange={(e) => setVf({ ...vf, santriId: e.target.value })}>
              {db.santri.filter((s) => !s.deletedAt && s.status !== 'keluar').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Jenis pelanggaran" req>
            <select className={inputCls} value={vf.typeId} onChange={(e) => setVf({ ...vf, typeId: e.target.value })}>
              {db.violationTypes.map((t) => <option key={t.id} value={t.id}>{t.name} (+{t.points})</option>)}
            </select>
          </Field>
          <Field label="Tanggal"><input type="date" className={inputCls} value={vf.date} onChange={(e) => setVf({ ...vf, date: e.target.value })} /></Field>
          <Field label="Catatan kejadian"><input className={inputCls} value={vf.note} onChange={(e) => setVf({ ...vf, note: e.target.value })} /></Field>
          <Field label="Tindakan"><input className={inputCls} value={vf.action} onChange={(e) => setVf({ ...vf, action: e.target.value })} placeholder="cth: teguran, piket tambahan" /></Field>
        </div>
      </Modal>
    </div>
  );
}
