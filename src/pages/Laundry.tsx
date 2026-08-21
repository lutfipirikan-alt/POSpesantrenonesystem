/* ===== Modul 10: Laundry ===== */

import { useState } from 'react';
import type { LaundryStatus, User } from '../lib/types';
import { db, santriById, useDB } from '../lib/store';
import { createLaundryOrder, payLaundry, setLaundryStatus } from '../lib/services/ops';
import { resolveCard } from '../lib/services/nfc';
import { cx, fmtDT, rp } from '../lib/util';
import { Badge, Btn, Card, Empty, Field, inputCls, Modal, Spinner, statusTone, THead, TRow, TD, TWrap, useToast, useNfcScan } from '../components/ui';
import { PageHead, SantriChip } from '../components/layout';
import { IcCard, IcPlus, IcScan, IcWasher } from '../components/icons';

const FLOW: LaundryStatus[] = ['RECEIVED', 'WASHING', 'DRYING', 'IRONING', 'READY', 'COMPLETED'];
const FLOW_LABEL: Record<LaundryStatus, string> = {
  RECEIVED: 'Diterima', WASHING: 'Dicuci', DRYING: 'Dikeringkan', IRONING: 'Disetrika', READY: 'Siap', COMPLETED: 'Selesai', CANCELLED: 'Batal',
};

export default function LaundryPage({ user }: { user: User }) {
  useDB();
  const toast = useToast();
  const [fStatus, setFStatus] = useState('');
  const [create, setCreate] = useState(false);
  const [santriId, setSantriId] = useState('');
  const [svcId, setSvcId] = useState('LS-01');
  const [weight, setWeight] = useState(3);
  const [pay, setPay] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<'SALDO_NFC' | 'CASH'>('SALDO_NFC');
  const [busy, setBusy] = useState(false);

  useNfcScan((uid) => {
    if (!create) return;
    const res = resolveCard(uid);
    if ('error' in res) return;
    setSantriId(res.santri.id);
  });

  const svc = db.laundryServices.find((s) => s.id === svcId);
  const total = svc ? Math.round(svc.priceKg * weight) : 0;
  const orders = db.laundryOrders.filter((o) => !fStatus || o.status === fStatus);

  const advance = (id: string, cur: LaundryStatus) => {
    const idx = FLOW.indexOf(cur);
    const next = FLOW[idx + 1];
    if (!next) return;
    setLaundryStatus(id, next, user);
    toast.push('ok', `Status → ${FLOW_LABEL[next]}`, next === 'READY' ? 'Wali santri telah dinotifikasi.' : undefined);
  };

  return (
    <div className="space-y-4">
      <PageHead
        title="Laundry Santri"
        desc="Penerimaan → cuci → kering → setrika → siap → selesai · pembayaran bisa memakai saldo NFC"
        actions={<Btn size="sm" onClick={() => { setCreate(true); setSantriId(''); }}><IcPlus size={14} /> Order Baru</Btn>}
      />

      <div className="stagger grid grid-cols-3 gap-2 lg:grid-cols-6">
        {FLOW.map((st) => {
          const n = db.laundryOrders.filter((o) => o.status === st).length;
          return (
            <button key={st} onClick={() => setFStatus(fStatus === st ? '' : st)} className={cx('rounded-xl border p-3 text-center transition-all hover:-translate-y-0.5', fStatus === st ? 'border-gold-400 bg-gold-50' : 'border-line bg-surface')}>
              <span className="font-display block text-xl font-bold tnum">{n}</span>
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-mute">{FLOW_LABEL[st]}</span>
            </button>
          );
        })}
      </div>

      <Card pad={false}>
        {orders.length === 0 ? <Empty title="Tidak ada order" icon={<IcWasher size={20} />} /> : (
          <TWrap>
            <THead cols={['No. Order', 'Santri', 'Layanan', 'Berat', 'Total', 'Status', 'Pembayaran', 'Aksi']} />
            <tbody>
              {orders.map((o) => {
                const s = db.laundryServices.find((x) => x.id === o.serviceId);
                const next = FLOW[FLOW.indexOf(o.status) + 1];
                return (
                  <TRow key={o.id}>
                    <TD>
                      <span className="font-bold tnum">{o.number}</span>
                      <span className="block text-[10.5px] text-mute tnum">{fmtDT(o.createdAt)}</span>
                    </TD>
                    <TD><SantriChip id={o.santriId} size="sm" /></TD>
                    <TD className="text-xs">{s?.name}</TD>
                    <TD className="tnum">{o.weightKg} kg</TD>
                    <TD className="font-bold tnum">{rp(o.total)}</TD>
                    <TD><Badge tone={statusTone(o.status)}>{FLOW_LABEL[o.status]}</Badge></TD>
                    <TD>{o.paidAt ? <Badge tone="ok">{o.method === 'SALDO_NFC' ? 'SALDO' : 'CASH'}</Badge> : <Badge tone="danger">BELUM</Badge>}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {!o.paidAt && o.status !== 'CANCELLED' && (
                          <Btn variant="ok" size="sm" onClick={() => setPay(o.id)}>Bayar</Btn>
                        )}
                        {next && o.status !== 'CANCELLED' && (
                          <Btn variant="outline" size="sm" onClick={() => advance(o.id, o.status)}>→ {FLOW_LABEL[next]}</Btn>
                        )}
                        {o.status === 'RECEIVED' && (
                          <Btn variant="ghost" size="sm" onClick={() => { setLaundryStatus(o.id, 'CANCELLED', user); toast.push('info', 'Order dibatalkan'); }}>Batal</Btn>
                        )}
                      </div>
                    </TD>
                  </TRow>
                );
              })}
            </tbody>
          </TWrap>
        )}
      </Card>

      {/* order baru */}
      <Modal open={create} onClose={() => setCreate(false)} title="Order laundry baru" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCreate(false)}>Batal</Btn>
            <Btn disabled={!santriId || weight <= 0} onClick={() => {
              try {
                const o = createLaundryOrder(santriId, svcId, weight, user);
                toast.push('ok', `Order ${o.number} dibuat`, `${weight} kg · ${rp(o.total)} — dibayar saat diambil / sekarang`);
                setCreate(false);
              } catch (e) {
                toast.push('err', 'Gagal', e instanceof Error ? e.message : '');
              }
            }}>Simpan Order</Btn>
          </>
        }>
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border border-dashed border-navy-200 bg-navy-950 p-3">
            {santriId ? (
              <div className="anim-pop flex items-center gap-2.5">
                <SantriChip id={santriId} />
                <span className="ml-auto text-[10.5px] text-ok">kartu terbaca ✓</span>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-xs text-navy-300"><IcScan size={16} className="text-gold-300" /> Tempel kartu santri di NFC Simulator…</p>
            )}
          </div>
          <Field label="Atau pilih manual">
            <select className={inputCls} value={santriId} onChange={(e) => setSantriId(e.target.value)}>
              <option value="">— santri —</option>
              {db.santri.filter((s) => s.status === 'aktif' && !s.deletedAt).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Layanan">
            <select className={inputCls} value={svcId} onChange={(e) => setSvcId(e.target.value)}>
              {db.laundryServices.map((s) => <option key={s.id} value={s.id}>{s.name} — {rp(s.priceKg)}/kg</option>)}
            </select>
          </Field>
          <Field label="Berat (kg)" req>
            <input type="number" step="0.1" className={inputCls} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </Field>
          <div className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2.5">
            <span className="text-xs font-bold text-navy-800">Total (dihitung server)</span>
            <span className="font-display text-lg font-bold text-navy-800 tnum">{rp(total)}</span>
          </div>
        </div>
      </Modal>

      {/* bayar */}
      <Modal open={!!pay} onClose={() => !busy && setPay(null)} title="Pembayaran laundry" w="max-w-md"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPay(null)} disabled={busy}>Batal</Btn>
            <Btn variant="ok" disabled={busy} onClick={async () => {
              if (!pay) return;
              setBusy(true);
              try {
                await payLaundry(pay, payMethod, user);
                toast.push('ok', 'Pembayaran berhasil', payMethod === 'SALDO_NFC' ? 'Saldo santri terpotong via ledger.' : 'Pembayaran tunai dicatat.');
                setPay(null);
              } catch (e) {
                toast.push('err', 'Pembayaran ditolak', e instanceof Error ? e.message : '');
              } finally {
                setBusy(false);
              }
            }}>{busy ? <Spinner size={14} /> : 'Bayar Sekarang'}</Btn>
          </>
        }>
        {pay && (() => {
          const o = db.laundryOrders.find((x) => x.id === pay);
          if (!o) return null;
          return (
            <div className="space-y-3">
              <div className="rounded-lg border border-line bg-bg p-3 text-[13px]">
                <div className="flex justify-between"><b>{o.number}</b><b className="tnum">{rp(o.total)}</b></div>
                <div className="mt-1.5"><SantriChip id={o.santriId} size="sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['SALDO_NFC', 'CASH'] as const).map((m) => (
                  <button key={m} onClick={() => setPayMethod(m)} className={cx('rounded-lg border py-2.5 text-xs font-bold', payMethod === m ? 'border-navy-800 bg-navy-800 text-white' : 'border-line text-mute')}>
                    {m === 'SALDO_NFC' ? `SALDO NFC (${rp(o.santriId ? db.wallets.find((w) => w.santriId === o.santriId)?.balance ?? 0 : 0)})` : 'TUNAI'}
                  </button>
                ))}
              </div>
              {payMethod === 'SALDO_NFC' && santriById(o.santriId) && (
                <p className="text-[11px] text-mute">Saldo {santriById(o.santriId)?.name}: <b className="tnum">{rp(db.wallets.find((w) => w.santriId === o.santriId)?.balance ?? 0)}</b> — divalidasi ulang di server.</p>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
