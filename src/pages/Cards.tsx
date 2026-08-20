/* ===== Modul 3: Manajemen Kartu NFC =====
   NFC = IDENTITAS santri. Saldo tetap di server; blokir/ganti kartu tidak
   menghilangkan saldo; histori kartu lama tidak pernah dihapus. */

import { useMemo, useState } from 'react';
import type { NfcCard, User } from '../lib/types';
import { activeCardOf, db, useDB } from '../lib/store';
import { blockCard, issueCard } from '../lib/services/ops';
import { resolveCard } from '../lib/services/nfc';
import { cx, fmtDate, fmtDT, rp } from '../lib/util';
import { balanceOf } from '../lib/services/wallet';
import { Avatar, Badge, Btn, Card, Empty, Field, inputCls, Modal, SearchBox, Stat, statusTone, THead, TRow, TD, TWrap, useToast, useNfcScan } from '../components/ui';
import { PageHead, SantriChip, useHashRoute } from '../components/layout';
import { IcCard, IcCheck, IcInfo, IcScan, IcX } from '../components/icons';

type PairState =
  | { step: 'idle' }
  | { step: 'waiting'; santriId: string }
  | { step: 'done'; santriId: string; card: NfcCard };

export default function CardsPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [, nav] = useHashRoute();
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [selSantri, setSelSantri] = useState('SAN-001');
  const [pair, setPair] = useState<PairState>({ step: 'idle' });
  const [manualUid, setManualUid] = useState('');
  const [blockTarget, setBlockTarget] = useState<NfcCard | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const stats = useMemo(
    () => ({
      active: db.cards.filter((c) => c.status === 'ACTIVE').length,
      blocked: db.cards.filter((c) => c.status === 'BLOCKED').length,
      lost: db.cards.filter((c) => c.status === 'LOST').length,
      replaced: db.cards.filter((c) => c.status === 'REPLACED' || c.status === 'INACTIVE').length,
    }),
    [db.cards]
  );

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return db.cards
      .filter((c) => (!fStatus || c.status === fStatus))
      .filter((c) => {
        if (!ql) return true;
        const s = db.santri.find((x) => x.id === c.santriId);
        return c.uid.toLowerCase().includes(ql) || c.cardNumber.toLowerCase().includes(ql) || (s?.name.toLowerCase().includes(ql) ?? false);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [q, fStatus]);

  const tryIssue = (santriId: string, uidVal: string) => {
    const existing = db.cards.find((c) => c.uid === uidVal.toUpperCase().trim());
    if (existing && existing.status === 'ACTIVE') {
      toast.push('err', 'UID sudah digunakan', `UID ini aktif atas nama ${db.santri.find((s) => s.id === existing.santriId)?.name}.`);
      setPair({ step: 'idle' });
      return;
    }
    try {
      const card = issueCard(santriId, uidVal, user);
      const s = db.santri.find((x) => x.id === santriId);
      setPair({ step: 'done', santriId, card });
      toast.push('ok', 'Kartu terpasang', `${s?.name} — ${card.cardNumber} (${card.uid})`);
    } catch (e) {
      toast.push('err', 'Gagal memasang kartu', e instanceof Error ? e.message : '');
      setPair({ step: 'idle' });
    }
  };

  // listener NFC hanya saat mode "menunggu tempel"
  useNfcScan((uidVal) => {
    if (pair.step === 'waiting') tryIssue(pair.santriId, uidVal);
  });

  return (
    <div className="space-y-4">
      <PageHead title="Kartu NFC" desc="Satu kartu aktif per santri · NFC adalah identitas, saldo tersimpan aman di server" />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kartu aktif" value={stats.active} icon={<IcCard size={17} />} tone="ok" />
        <Stat label="Diblokir" value={stats.blocked} icon={<IcX size={17} />} tone="danger" />
        <Stat label="Hilang" value={stats.lost} icon={<IcInfo size={17} />} tone="warn" />
        <Stat label="Diganti / nonaktif" value={stats.replaced} icon={<IcCheck size={17} />} tone="mute" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* alur pemasangan */}
        <Card title="Pasangkan kartu" sub="Alur registrasi: pilih santri → tempel kartu → UID terverifikasi">
          {pair.step === 'idle' && (
            <div className="space-y-3">
              <Field label="1 · Pilih santri" req>
                <select className={inputCls} value={selSantri} onChange={(e) => setSelSantri(e.target.value)}>
                  {db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — NIS {s.nis} {activeCardOf(s.id) ? '(punya kartu aktif)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {activeCardOf(selSantri) && (
                <p className="rounded-lg border border-warnln bg-warnbg px-3 py-2 text-[11.5px] font-semibold text-warn">
                  Santri ini sudah punya kartu aktif. Kartu lama akan berstatus REPLACED (histori tetap tersimpan).
                </p>
              )}
              <Btn variant="gold" size="lg" className="w-full" onClick={() => setPair({ step: 'waiting', santriId: selSantri })}>
                <IcScan size={16} /> 2 · Mulai & tempelkan kartu
              </Btn>
              <div className="flex gap-1.5">
                <input
                  className={inputCls}
                  placeholder="atau ketik UID: 04:A1:B2:C3:D4:E5:F6"
                  value={manualUid}
                  onChange={(e) => setManualUid(e.target.value)}
                />
                <Btn variant="outline" onClick={() => {
                  if (manualUid.trim()) {
                    tryIssue(selSantri, manualUid);
                    setManualUid('');
                  }
                }}>Pakai</Btn>
              </div>
              <p className="text-[11px] leading-relaxed text-mute">
                Gunakan <b>NFC Simulator</b> (kanan bawah) untuk menempel kartu, atau ketik UID manual. Sistem memastikan UID belum dipakai kartu aktif lain.
              </p>
            </div>
          )}

          {pair.step === 'waiting' && (
            <div className="space-y-3 text-center">
              <div className="relative mx-auto flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gold-300 bg-navy-950">
                <span className="scan-beam" />
                <div className="text-navy-100">
                  <IcCard size={34} className="mx-auto text-gold-300" />
                  <p className="font-display mt-2 text-sm font-bold text-white">Menunggu kartu…</p>
                  <p className="text-[11px] text-navy-300">Tempelkan kartu ke reader (NFC Simulator)</p>
                </div>
              </div>
              <p className="text-xs text-mute">
                Santri: <b>{db.santri.find((s) => s.id === (pair as { santriId: string }).santriId)?.name}</b>
              </p>
              <Btn variant="ghost" size="sm" onClick={() => setPair({ step: 'idle' })}>Batalkan</Btn>
            </div>
          )}

          {pair.step === 'done' && (
            <div className="space-y-3 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-okbg text-ok">
                <IcCheck size={26} />
              </span>
              <div>
                <p className="font-display text-base font-bold">Kartu berhasil dipasangkan</p>
                <p className="mt-1 text-xs text-mute">{db.santri.find((s) => s.id === pair.santriId)?.name} kini dapat bertransaksi & absensi dengan kartunya.</p>
              </div>
              <div className="rounded-lg border border-line bg-bg p-3 text-left text-xs">
                <div className="flex justify-between py-0.5"><span className="text-mute">No. kartu</span><b className="tnum">{pair.card.cardNumber}</b></div>
                <div className="flex justify-between py-0.5"><span className="text-mute">UID</span><b className="font-mono">{pair.card.uid}</b></div>
                <div className="flex justify-between py-0.5"><span className="text-mute">Status</span><Badge tone="ok">ACTIVE</Badge></div>
              </div>
              <div className="flex justify-center gap-2">
                <Btn variant="outline" size="sm" onClick={() => setPair({ step: 'idle' })}>Pasang kartu lain</Btn>
                <Btn size="sm" onClick={() => nav('#/topup')}>Lanjut Top Up →</Btn>
              </div>
            </div>
          )}
        </Card>

        {/* daftar kartu */}
        <Card className="xl:col-span-2" title="Database kartu" sub="Histori kartu lama dipertahankan untuk audit" pad={false}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-52"><SearchBox value={q} onChange={setQ} placeholder="Cari santri / UID / no. kartu" /></div>
              <select className={cx(inputCls, 'w-auto')} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">Semua status</option>
                {['ACTIVE', 'BLOCKED', 'LOST', 'REPLACED', 'INACTIVE'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          }
        >
          {list.length === 0 ? (
            <Empty title="Tidak ada kartu" icon={<IcCard size={20} />} />
          ) : (
            <TWrap>
              <THead cols={['Pemilik', 'No. Kartu', 'UID', 'Status', 'Terbit', 'Nonaktif / Alasan', 'Aksi']} />
              <tbody>
                {list.map((c) => {
                  const s = db.santri.find((x) => x.id === c.santriId);
                  return (
                    <TRow key={c.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          {s && <Avatar name={s.name} color={s.color} size={26} />}
                          <div>
                            <div className="text-xs font-bold">{s?.name ?? '?'}</div>
                            <div className="text-[10.5px] text-mute tnum">Saldo {s ? rp(balanceOf(s.id)) : '-'}</div>
                          </div>
                        </div>
                      </TD>
                      <TD className="font-bold tnum">{c.cardNumber}</TD>
                      <TD><span className="rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy-700">{c.uid}</span></TD>
                      <TD><Badge tone={statusTone(c.status)}>{c.status}</Badge></TD>
                      <TD className="tnum text-mute">{fmtDate(c.issuedAt)}</TD>
                      <TD className="max-w-44 text-[11px] text-mute">
                        {c.deactivatedAt ? `${fmtDT(c.deactivatedAt)} — ${c.reason ?? ''}` : '-'}
                      </TD>
                      <TD>
                        {c.status === 'ACTIVE' ? (
                          <Btn variant="danger" size="sm" onClick={() => { setBlockTarget(c); setBlockReason(''); }}>Blokir</Btn>
                        ) : (
                          <button className="text-[11px] font-bold text-info hover:underline" onClick={() => { setSelSantri(c.santriId); setPair({ step: 'idle' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            Ganti baru
                          </button>
                        )}
                      </TD>
                    </TRow>
                  );
                })}
              </tbody>
            </TWrap>
          )}
        </Card>
      </div>

      <Card pad={false}>
        <div className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-infobg text-info"><IcInfo size={16} /></span>
          <div className="text-[12.5px] leading-relaxed text-mute">
            <b className="text-ink">Kartu hilang?</b> Blokir kartu lama (saldo santri tidak berubah), lalu pasangkan kartu baru — saldo & histori transaksi tetap utuh karena tersimpan di server, bukan di kartu.
            Setiap transaksi memvalidasi status kartu: <span className="font-mono text-[11px]">ACTIVE → diizinkan</span>, <span className="font-mono text-[11px]">BLOCKED/LOST/REPLACED → ditolak</span>.
          </div>
        </div>
      </Card>

      {/* modal blokir */}
      <Modal open={!!blockTarget} onClose={() => setBlockTarget(null)} title="Blokir kartu" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setBlockTarget(null)}>Batal</Btn>
            <Btn variant="danger" onClick={() => {
              if (!blockTarget) return;
              try {
                blockCard(blockTarget.id, blockReason, user);
                toast.push('ok', 'Kartu diblokir', `${blockTarget.cardNumber} — saldo santri tetap aman. Pasangkan kartu baru kapan saja.`);
                setBlockTarget(null);
              } catch (e) {
                toast.push('err', 'Gagal memblokir', e instanceof Error ? e.message : '');
              }
            }}>Blokir Kartu</Btn>
          </>
        }>
        {blockTarget && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-bg p-3">
              <SantriChip id={blockTarget.santriId} />
              <p className="mt-2 font-mono text-xs font-bold text-navy-700">{blockTarget.uid}</p>
            </div>
            <Field label="Alasan pemblokiran" req hint="Wajib — tercatat permanen di audit log">
              <input className={inputCls} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="cth: kartu hilang di asrama" autoFocus />
            </Field>
            <p className="text-[11.5px] text-mute">Saldo santri <b>tidak berubah</b>. Kartu yang diblokir akan ditolak di semua reader (POS, top up, absensi).</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
