/* ===== Modul 2: Data Santri — CRUD, pencarian, filter, pagination, import/export ===== */

import { useMemo, useRef, useState } from 'react';
import type { Santri, User } from '../lib/types';
import { activeCardOf, balanceOf, db, kelasById, kamarById, useDB } from '../lib/store';
import { importSantri, saveSantri, softDeleteSantri } from '../lib/services/ops';
import { downloadFile, fmtDate, fmtDT, parseCSV, rp, toCSV, cx } from '../lib/util';
import {
  Avatar, Badge, Btn, Card, Empty, Field, inputCls, Modal, Pagination, SearchBox,
  statusTone, Tabs, THead, TRow, TD, TWrap, useToast,
} from '../components/ui';
import { PageHead, SantriChip, useHashRoute } from '../components/layout';
import { IcCard, IcDownload, IcEdit, IcPlus, IcTrash, IcUpload, IcWallet } from '../components/icons';

const PER_PAGE = 8;

const emptyForm = { name: '', nis: '', nisn: '', nickname: '', gender: 'L' as 'L' | 'P', birthPlace: '', birthDate: '2012-01-01', address: '', kelasId: 'KLS-02', entryYear: new Date().getFullYear(), status: 'aktif' as Santri['status'], kamarId: 'KMR-A01' };

export function SantriListPage({ user }: { user: User }) {
  useDB();
  const [, nav] = useHashRoute();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [fKelas, setFKelas] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Santri | null | 'new'>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return db.santri
      .filter((s) => !s.deletedAt)
      .filter((s) => (!fStatus || s.status === fStatus) && (!fKelas || s.kelasId === fKelas))
      .filter((s) => !ql || s.name.toLowerCase().includes(ql) || s.nis.includes(ql) || s.nickname.toLowerCase().includes(ql))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, fKelas, fStatus]);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const rows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const exportCSV = () => {
    const csv = toCSV(
      list.map((s) => ({
        nis: s.nis, nisn: s.nisn ?? '', nama: s.name, panggilan: s.nickname, jk: s.gender,
        kelas: kelasById(s.kelasId)?.name ?? '', kamar: kamarById(s.kamarId)?.name ?? '',
        status: s.status, saldo: balanceOf(s.id), kartu: activeCardOf(s.id)?.uid ?? '-',
      }))
    );
    downloadFile(`santri-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.push('ok', 'Export berhasil', `${list.length} baris santri diunduh (CSV).`);
  };

  const onImport = async (f: File) => {
    const text = await f.text();
    const rowsCsv = parseCSV(text);
    try {
      const n = importSantri(rowsCsv, user);
      toast.push('ok', 'Import selesai', `${n} santri baru ditambahkan, ${rowsCsv.length - n} dilewati (duplikat/kosong).`);
    } catch (e) {
      toast.push('err', 'Import gagal', e instanceof Error ? e.message : '');
    }
  };

  return (
    <div>
      <PageHead
        title="Data Santri"
        desc={`${list.length} santri · satu akun & satu kartu NFC aktif per santri`}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <Btn variant="outline" size="sm" onClick={() => fileRef.current?.click()}><IcUpload size={14} /> Import</Btn>
            <Btn variant="outline" size="sm" onClick={exportCSV}><IcDownload size={14} /> Export</Btn>
            <Btn size="sm" onClick={() => setEdit('new')}><IcPlus size={14} /> Santri Baru</Btn>
          </>
        }
      />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="w-full sm:w-64"><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Cari nama / NIS / panggilan…" /></div>
          <select className={cx(inputCls, 'w-auto')} value={fKelas} onChange={(e) => { setFKelas(e.target.value); setPage(1); }}>
            <option value="">Semua kelas</option>
            {db.kelas.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select className={cx(inputCls, 'w-auto')} value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            {['aktif', 'cuti', 'lulus', 'keluar', 'nonaktif'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty title="Tidak ada santri ditemukan" desc="Ubah kata kunci atau filter, atau tambahkan santri baru." />
        ) : (
          <TWrap>
            <THead cols={['Santri', 'Kelas', 'Kamar', 'Kartu NFC', 'Saldo', 'Status', '']} />
            <tbody>
              {rows.map((s) => {
                const card = activeCardOf(s.id);
                return (
                  <TRow key={s.id} onClick={() => nav(`#/santri/${s.id}`)}>
                    <TD><SantriChip id={s.id} /></TD>
                    <TD>{kelasById(s.kelasId)?.name ?? '-'}</TD>
                    <TD>{kamarById(s.kamarId)?.name ?? '-'}</TD>
                    <TD>{card ? <span className="rounded-md bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy-700">{card.uid}</span> : <Badge tone="mute">BELUM ADA</Badge>}</TD>
                    <TD className="font-bold tnum">{rp(balanceOf(s.id))}</TD>
                    <TD><Badge tone={statusTone(s.status)}>{s.status.toUpperCase()}</Badge></TD>
                    <TD right><span className="text-xs font-bold text-info">Detail →</span></TD>
                  </TRow>
                );
              })}
            </tbody>
          </TWrap>
        )}
        <div className="border-t border-line p-3">
          <Pagination page={page} pages={pages} onPage={setPage} total={list.length} shown={rows.length} />
        </div>
      </Card>

      {edit && <SantriForm initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} actor={user} />}
    </div>
  );
}

function SantriForm({ initial, onClose, actor }: { initial: Santri | null; onClose: () => void; actor: User }) {
  const toast = useToast();
  const [, nav] = useHashRoute();
  const [f, setF] = useState(() =>
    initial
      ? { name: initial.name, nis: initial.nis, nisn: initial.nisn ?? '', nickname: initial.nickname, gender: initial.gender, birthPlace: initial.birthPlace, birthDate: initial.birthDate.slice(0, 10), address: initial.address, kelasId: initial.kelasId, entryYear: initial.entryYear, status: initial.status, kamarId: initial.kamarId ?? 'KMR-A01' }
      : emptyForm
  );
  const set = (k: string, v: string | number) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal open onClose={onClose} title={initial ? `Ubah data — ${initial.name}` : 'Santri baru'} w="max-w-2xl"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn
            onClick={() => {
              try {
                const s = saveSantri({ ...f, id: initial?.id }, actor);
                toast.push('ok', initial ? 'Perubahan disimpan' : 'Santri ditambahkan', s.name);
                onClose();
                if (!initial) nav(`#/santri/${s.id}`);
              } catch (e) {
                toast.push('err', 'Gagal menyimpan', e instanceof Error ? e.message : '');
              }
            }}
          >
            Simpan
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama lengkap" req><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Nama panggilan"><input className={inputCls} value={f.nickname} onChange={(e) => set('nickname', e.target.value)} /></Field>
        <Field label="NIS" req><input className={inputCls} value={f.nis} onChange={(e) => set('nis', e.target.value)} /></Field>
        <Field label="NISN"><input className={inputCls} value={f.nisn} onChange={(e) => set('nisn', e.target.value)} /></Field>
        <Field label="Jenis kelamin">
          <select className={inputCls} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="L">Laki-laki</option><option value="P">Perempuan</option>
          </select>
        </Field>
        <Field label="Tempat lahir"><input className={inputCls} value={f.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} /></Field>
        <Field label="Tanggal lahir"><input type="date" className={inputCls} value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></Field>
        <Field label="Tahun masuk"><input type="number" className={inputCls} value={f.entryYear} onChange={(e) => set('entryYear', Number(e.target.value))} /></Field>
        <Field label="Kelas">
          <select className={inputCls} value={f.kelasId} onChange={(e) => set('kelasId', e.target.value)}>
            {db.kelas.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </Field>
        <Field label="Kamar">
          <select className={inputCls} value={f.kamarId} onChange={(e) => set('kamarId', e.target.value)}>
            {db.kamar.map((k) => <option key={k.id} value={k.id}>{k.name} — {db.asrama.find((a) => a.id === k.asramaId)?.name}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {['aktif', 'cuti', 'lulus', 'keluar', 'nonaktif'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Alamat"><input className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export function SantriDetailPage({ id, user }: { id: string; user: User }) {
  useDB();
  const [, nav] = useHashRoute();
  const toast = useToast();
  const [tab, setTab] = useState('profil');
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const s = db.santri.find((x) => x.id === id && !x.deletedAt);
  if (!s) return <Empty title="Santri tidak ditemukan" action={<Btn onClick={() => nav('#/santri')}>Kembali</Btn>} />;

  const card = activeCardOf(s.id);
  const cardHistory = db.cards.filter((c) => c.santriId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const txs = db.walletTxs.filter((t) => t.santriId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  const grades = db.grades.filter((g) => g.santriId === s.id);
  const mems = db.memRecords.filter((m) => m.santriId === s.id);
  const viols = db.violations.filter((v) => v.santriId === s.id);
  const absen = db.attendance.filter((a) => a.santriId === s.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const waliLinks = db.waliSantri.filter((w) => w.santriId === s.id).map((w) => ({ wali: db.wali.find((x) => x.id === w.waliId), rel: w.relation }));

  return (
    <div className="space-y-4">
      <button className="text-xs font-bold text-mute hover:text-ink" onClick={() => nav('#/santri')}>← Semua santri</button>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-4 p-4">
          <Avatar name={s.name} color={s.color} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight">{s.name}</h2>
              <Badge tone={statusTone(s.status)}>{s.status.toUpperCase()}</Badge>
            </div>
            <p className="mt-0.5 text-[13px] text-mute tnum">
              NIS {s.nis} · {kelasById(s.kelasId)?.name} · Kamar {kamarById(s.kamarId)?.name ?? '-'} · Masuk {s.entryYear}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="navy"><IcWallet size={12} /> Saldo {rp(balanceOf(s.id))}</Badge>
              {card ? (
                <Badge tone="ok"><IcCard size={12} /> {card.uid}</Badge>
              ) : (
                <Badge tone="warn"><IcCard size={12} /> Belum ada kartu aktif</Badge>
              )}
              {waliLinks[0]?.wali && <Badge tone="mute">Wali: {waliLinks[0].wali.name} ({waliLinks[0].rel})</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={() => nav('#/kartu')}><IcCard size={14} /> Kelola Kartu</Btn>
            <Btn variant="outline" size="sm" onClick={() => setEdit(true)}><IcEdit size={14} /> Ubah</Btn>
            <Btn variant="danger" size="sm" onClick={() => setConfirmDel(true)}><IcTrash size={14} /></Btn>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { key: 'profil', label: 'Profil' },
          { key: 'kartu', label: `Kartu (${cardHistory.length})` },
          { key: 'saldo', label: 'Saldo & Ledger' },
          { key: 'akademik', label: 'Nilai' },
          { key: 'hafalan', label: `Hafalan (${mems.length})` },
          { key: 'pelanggaran', label: `Pelanggaran (${viols.length})` },
          { key: 'absensi', label: 'Absensi' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'profil' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Data pribadi">
            <dl className="divide-y divide-line/70 text-[13px]">
              {[
                ['Nama lengkap', s.name], ['Panggilan', s.nickname], ['NIS', s.nis], ['NISN', s.nisn ?? '-'],
                ['Jenis kelamin', s.gender === 'L' ? 'Laki-laki' : 'Perempuan'],
                ['Tempat, tanggal lahir', `${s.birthPlace}, ${fmtDate(s.birthDate)}`],
                ['Alamat', s.address],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-mute">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
          </Card>
          <Card title="Data pesantren & wali">
            <dl className="divide-y divide-line/70 text-[13px]">
              {[
                ['Kelas', kelasById(s.kelasId)?.name ?? '-'],
                ['Kamar', kamarById(s.kamarId)?.name ?? '-'],
                ['Asrama', db.asrama.find((a) => a.id === kamarById(s.kamarId)?.asramaId)?.name ?? '-'],
                ['Tahun masuk', String(s.entryYear)], ['Status', s.status],
                ['Terdaftar', fmtDate(s.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-mute">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
              {waliLinks.map((w, i) => (
                <div key={i} className="py-2">
                  <dt className="text-mute">Wali ({w.rel})</dt>
                  <dd className="mt-0.5 font-semibold">{w.wali?.name} · {w.wali?.phone}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {tab === 'kartu' && (
        <Card title="Riwayat kartu NFC" sub="Histori kartu lama tidak pernah dihapus — blokir kartu tidak menghilangkan saldo" pad={false}>
          {cardHistory.length === 0 ? (
            <Empty title="Belum ada kartu" desc="Pasangkan kartu NFC dari halaman Kartu NFC." icon={<IcCard size={20} />} action={<Btn size="sm" onClick={() => nav('#/kartu')}>Pasangkan Kartu</Btn>} />
          ) : (
            <TWrap>
              <THead cols={['No. Kartu', 'UID', 'Status', 'Diterbitkan', 'Nonaktif', 'Alasan']} />
              <tbody>
                {cardHistory.map((c) => (
                  <TRow key={c.id}>
                    <TD className="font-bold tnum">{c.cardNumber}</TD>
                    <TD><span className="font-mono text-xs font-bold text-navy-700">{c.uid}</span></TD>
                    <TD><Badge tone={statusTone(c.status)}>{c.status}</Badge></TD>
                    <TD className="tnum">{fmtDate(c.issuedAt)}</TD>
                    <TD className="tnum">{c.deactivatedAt ? fmtDate(c.deactivatedAt) : '-'}</TD>
                    <TD className="text-mute">{c.reason ?? '-'}</TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'saldo' && (
        <Card title="Ledger saldo" sub="Setiap perubahan saldo berasal dari transaksi ledger" pad={false}
          action={<Btn size="sm" variant="gold" onClick={() => nav('#/topup')}><IcWallet size={14} /> Top Up</Btn>}>
          {txs.length === 0 ? (
            <Empty title="Belum ada transaksi" />
          ) : (
            <TWrap>
              <THead cols={['Waktu', 'Keterangan', 'Sebelum', 'Sesudah', '', 'Nominal']} />
              <tbody>
                {txs.map((t) => (
                  <TRow key={t.id}>
                    <TD className="whitespace-nowrap text-mute tnum">{fmtDT(t.createdAt)}</TD>
                    <TD>
                      <div className="font-semibold">{t.description}</div>
                      <div className="text-[10.5px] text-mute">{t.type}</div>
                    </TD>
                    <TD className="tnum text-mute">{rp(t.balanceBefore)}</TD>
                    <TD className="font-bold tnum">{rp(t.balanceAfter)}</TD>
                    <TD><Badge tone={statusTone(t.type === 'REFUND' ? 'HADIR' : t.amount >= 0 ? 'PAID' : 'UNPAID')}>{t.type}</Badge></TD>
                    <TD right className={cx('font-bold tnum', t.amount >= 0 ? 'text-ok' : 'text-danger')}>{t.amount >= 0 ? '+' : ''}{rp(t.amount)}</TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'akademik' && (
        <Card title="Nilai akademik" pad={false}>
          {grades.length === 0 ? <Empty title="Belum ada nilai" /> : (
            <TWrap>
              <THead cols={['Mapel', 'Jenis', 'Nilai', 'Term', 'Catatan']} />
              <tbody>
                {grades.map((g) => (
                  <TRow key={g.id}>
                    <TD className="font-semibold">{db.subjects.find((x) => x.id === g.subjectId)?.name}</TD>
                    <TD><Badge tone="info">{g.kind}</Badge></TD>
                    <TD><span className={cx('font-display text-base font-bold tnum', g.score >= 75 ? 'text-ok' : 'text-danger')}>{g.score}</span></TD>
                    <TD className="text-mute">{g.term}</TD>
                    <TD className="text-mute">{g.note || '-'}</TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'hafalan' && (
        <Card title="Setoran hafalan" pad={false}>
          {mems.length === 0 ? <Empty title="Belum ada setoran" /> : (
            <TWrap>
              <THead cols={['Tanggal', 'Surah', 'Ayat', 'Kualitas', 'Catatan guru']} />
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

      {tab === 'pelanggaran' && (
        <Card title="Catatan pelanggaran" pad={false}>
          {viols.length === 0 ? <Empty title="Bersih — tidak ada pelanggaran" /> : (
            <TWrap>
              <THead cols={['Tanggal', 'Jenis', 'Poin', 'Tindakan', 'Status']} />
              <tbody>
                {viols.map((v) => (
                  <TRow key={v.id}>
                    <TD className="tnum">{fmtDate(v.date)}</TD>
                    <TD className="font-semibold">{db.violationTypes.find((t) => t.id === v.typeId)?.name}</TD>
                    <TD className="font-bold text-danger tnum">+{v.points}</TD>
                    <TD className="text-mute">{v.action || '-'}</TD>
                    <TD><Badge tone={statusTone(v.status)}>{v.status}</Badge></TD>
                  </TRow>
                ))}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {tab === 'absensi' && (
        <Card title="Riwayat absensi" pad={false}>
          {absen.length === 0 ? <Empty title="Belum ada absensi" /> : (
            <TWrap>
              <THead cols={['Waktu', 'Sesi', 'Jenis', 'Status']} />
              <tbody>
                {absen.map((a) => {
                  const ses = db.sessions.find((x) => x.id === a.sessionId);
                  return (
                    <TRow key={a.id}>
                      <TD className="tnum">{fmtDT(a.at)}</TD>
                      <TD className="font-semibold">{ses?.name}</TD>
                      <TD><Badge tone="info">{ses?.type}</Badge></TD>
                      <TD><Badge tone={statusTone(a.status)}>{a.status}</Badge></TD>
                    </TRow>
                  );
                })}
              </tbody>
            </TWrap>
          )}
        </Card>
      )}

      {edit && <SantriForm initial={s} onClose={() => setEdit(false)} actor={user} />}
      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Hapus santri?" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmDel(false)}>Batal</Btn>
            <Btn variant="danger" onClick={() => {
              softDeleteSantri(s.id, user);
              toast.push('ok', 'Santri dihapus (soft delete)', 'Data & histori tetap tersimpan untuk audit.');
              setConfirmDel(false);
              nav('#/santri');
            }}>Hapus</Btn>
          </>
        }>
        <p className="text-sm text-mute">
          <b>{s.name}</b> akan dinonaktifkan (soft delete). Histori transaksi, ledger, dan kartu tetap tersimpan dan tidak dapat dihapus — sesuai kebijakan audit.
        </p>
      </Modal>
    </div>
  );
}
