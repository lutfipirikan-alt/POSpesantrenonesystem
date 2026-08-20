/* ===== Shell aplikasi: login, sidebar, topbar, dan NFC Simulator dock ===== */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { activeCardOf, db, santriById, useDB } from '../lib/store';
import { balanceOf } from '../lib/services/wallet';
import { can, login, logout, ROLE_LABEL, ROLE_TONE } from '../lib/services/auth';
import { nfcReader, resolveCard } from '../lib/services/nfc';
import { rp, cx, fmtTime, num } from '../lib/util';
import {
  IcAlert, IcBell, IcBook, IcBox, IcCal, IcCap, IcCard, IcCart, IcChart, IcClipboard,
  IcDash, IcDownload, IcFlask, IcGrip, IcInfo, IcLogout, IcMoonStar, IcReceipt, IcSantri,
  IcScan, IcSend, IcSettings, IcShield, IcStar, IcTag, IcUsers, IcWallet, IcWifi, IcX, Logo,
} from './icons';

/* ---------- PWA install prompt (Android: "Tambahkan ke layar utama") ---------- */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let bipEvent: BeforeInstallPromptEvent | null = null;
let appInstalled =
  typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches;
const bipListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    bipEvent = e as BeforeInstallPromptEvent;
    bipListeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    appInstalled = true;
    bipEvent = null;
    bipListeners.forEach((l) => l());
  });
}
function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    bipListeners.add(l);
    return () => {
      bipListeners.delete(l);
    };
  }, []);
  return {
    available: !!bipEvent && !appInstalled,
    installed: appInstalled,
    prompt: async () => {
      if (!bipEvent) return false;
      await bipEvent.prompt();
      const c = await bipEvent.userChoice;
      if (c.outcome === 'accepted') {
        appInstalled = true;
        bipEvent = null;
        bipListeners.forEach((l) => l());
      }
      return c.outcome === 'accepted';
    },
  };
}
import { Avatar, Badge, Btn, Field, inputCls, Modal, useToast, type Tone } from './ui';
import type { User } from '../lib/types';

/* ---------- router hash ---------- */
export function useHashRoute(): [string[], (to: string) => void] {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const h = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return [parts, (to: string) => (window.location.hash = to)];
}

/* ---------- nav ---------- */
export interface NavItem {
  key: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  section: string;
}
export const NAV: NavItem[] = [
  { key: 'dash', label: 'Dashboard', icon: IcDash, section: 'Ringkasan' },
  { key: 'wali', label: 'Portal Wali', icon: IcStar, section: 'Ringkasan' },
  { key: 'santri', label: 'Data Santri', icon: IcSantri, section: 'Santri & Kartu' },
  { key: 'kartu', label: 'Kartu NFC', icon: IcCard, section: 'Santri & Kartu' },
  { key: 'pos', label: 'POS Kasir', icon: IcCart, section: 'Keuangan' },
  { key: 'topup', label: 'Top Up Saldo', icon: IcWallet, section: 'Keuangan' },
  { key: 'wallet', label: 'Ledger & Saldo', icon: IcReceipt, section: 'Keuangan' },
  { key: 'tagihan', label: 'Tagihan', icon: IcTag, section: 'Keuangan' },
  { key: 'produk', label: 'Produk & Stok', icon: IcBox, section: 'Unit & Outlet' },
  { key: 'laundry', label: 'Laundry', icon: IcGrip, section: 'Unit & Outlet' },
  { key: 'perpustakaan', label: 'Perpustakaan', icon: IcBook, section: 'Unit & Outlet' },
  { key: 'absensi', label: 'Absensi', icon: IcClipboard, section: 'Pendidikan' },
  { key: 'akademik', label: 'Akademik & Nilai', icon: IcCap, section: 'Pendidikan' },
  { key: 'hafalan', label: 'Hafalan', icon: IcMoonStar, section: 'Pendidikan' },
  { key: 'pelanggaran', label: 'Pelanggaran', icon: IcAlert, section: 'Pendidikan' },
  { key: 'laporan', label: 'Laporan', icon: IcChart, section: 'Sistem' },
  { key: 'audit', label: 'Audit Log', icon: IcShield, section: 'Sistem' },
  { key: 'users', label: 'Pengguna & Role', icon: IcUsers, section: 'Sistem' },
  { key: 'notif', label: 'Notifikasi', icon: IcBell, section: 'Sistem' },
  { key: 'tests', label: 'Uji Sistem', icon: IcFlask, section: 'Sistem' },
  { key: 'pengaturan', label: 'Pengaturan', icon: IcSettings, section: 'Sistem' },
];

export const ROUTE_TITLE: Record<string, string> = {
  dash: 'Dashboard', wali: 'Portal Wali Santri', santri: 'Data Santri', kartu: 'Manajemen Kartu NFC',
  pos: 'POS Koperasi / Kantin', topup: 'Top Up Saldo', wallet: 'Ledger & Saldo Santri', tagihan: 'Tagihan Pesantren',
  produk: 'Produk & Inventori', laundry: 'Laundry Santri', perpustakaan: 'Perpustakaan', absensi: 'Absensi NFC',
  akademik: 'Akademik & Nilai', hafalan: 'Hafalan Al-Quran', pelanggaran: 'Pelanggaran & Poin',
  laporan: 'Laporan', audit: 'Audit Log', users: 'Pengguna & Role', notif: 'Notifikasi', tests: 'Uji Sistem', pengaturan: 'Pengaturan',
};

/* ---------- Login ---------- */
export function LoginPage() {
  useDB();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('demo123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [, nav] = useHashRoute();

  const demoUsers = db.users.filter((u) => u.active);
  const today = new Date();
  const clock = useClock();
  const txToday = db.sales.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString()).length;
  const saldo = db.wallets.reduce((a, w) => a + w.balance, 0);

  const doLogin = (u?: string) => {
    setErr('');
    setLoading(true);
    setTimeout(() => {
      try {
        const user = login(u ?? username, password);
        nav(can(user, 'dash') ? '#/' : can(user, 'wali') ? '#/wali' : '#/');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Login gagal');
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  return (
    <div className="flex min-h-screen">
      {/* panel identitas */}
      <div className="motif relative hidden w-[46%] flex-col justify-between overflow-hidden bg-navy-950 p-10 text-navy-100 lg:flex">
        <div className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full border-[28px] border-navy-800/50" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[22px] border-gold-400/15" />
        <div className="relative flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="font-display text-lg font-bold tracking-tight text-white">Pesantren One System</div>
            <div className="text-xs text-navy-300">{db.settings.pesantren}</div>
          </div>
        </div>
        <div className="relative">
          <p className="font-display max-w-md text-[34px] font-bold leading-[1.15] tracking-tight text-white">
            Satu kartu, satu akun, <span className="text-gold-300">seluruh pesantren</span> terkelola.
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-navy-200">
            NFC sebagai identitas santri — saldo aman di server dengan ledger, idempotency, dan audit trail di setiap transaksi.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[
              { l: 'Santri aktif', v: num(db.santri.filter((s) => s.status === 'aktif').length) },
              { l: 'Transaksi hari ini', v: num(txToday) },
              { l: 'Saldo beredar', v: rp(saldo) },
            ].map((s) => (
              <div key={s.l} className="rounded-lg border border-navy-800 bg-navy-900/70 p-3">
                <div className="font-display text-lg font-bold text-gold-300 tnum">{s.v}</div>
                <div className="mt-0.5 text-[11px] text-navy-300">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between text-xs text-navy-300">
          <span>
            {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="font-display text-lg font-bold text-white tnum">{clock}</span>
        </div>
      </div>

      {/* form */}
      <div className="flex flex-1 items-center justify-center bg-bg p-6">
        <div className="anim-fade-up w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo size={38} />
            <div>
              <div className="font-display font-bold">Pesantren One System</div>
              <div className="text-xs text-mute">{db.settings.pesantren}</div>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Masuk ke sistem</h1>
          <p className="mt-1 text-sm text-mute">Pilih akun demo sesuai role, atau masukkan kredensial.</p>

          <form
            className="mt-5 space-y-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              doLogin();
            }}
          >
            <Field label="Username" req>
              <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="cth: kasir" autoFocus />
            </Field>
            <Field label="Password" req hint="Semua akun demo memakai password: demo123">
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {err && (
              <div className="flex items-center gap-2 rounded-lg border border-dangerln bg-dangerbg px-3 py-2 text-xs font-bold text-danger">
                <IcAlert size={14} /> {err}
              </div>
            )}
            <Btn type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Memverifikasi…' : 'Masuk'}
            </Btn>
          </form>

          <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-mute">Akun demo — klik untuk mengisi</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {demoUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setUsername(u.username);
                  setPassword('demo123');
                  setErr('');
                }}
                className={cx(
                  'rounded-lg border px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                  username === u.username ? 'border-gold-400 bg-gold-50' : 'border-line bg-surface'
                )}
              >
                <span className="block truncate text-xs font-bold">{ROLE_LABEL[u.role]}</span>
                <span className="block truncate text-[11px] text-mute">@{u.username}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-infoln bg-infobg px-3.5 py-3 text-[11.5px] leading-relaxed text-info">
            <IcInfo size={15} className="mt-0.5 shrink-0" />
            <span>
              <b>Uji coba di HP Android:</b> buka alamat ini di Chrome, lalu tekan tombol <b>Instal</b> di kanan atas (atau menu Chrome ⋮ → <i>Tambahkan ke layar utama</i>). Aplikasi terbuka fullscreen seperti aplikasi biasa dan tetap berjalan saat offline.
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-mute">
            Produksi: autentikasi via Supabase Auth + Row Level Security. Demo ini menyimpan sesi secara lokal.
          </p>
        </div>
      </div>
    </div>
  );
}

function useClock(): string {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ---------- NFC Simulator Dock ---------- */
export function NfcDock() {
  useDB();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(nfcReader.connected);
  const [uidInput, setUidInput] = useState('');
  const [selSantri, setSelSantri] = useState('SAN-001');
  const [, force] = useState(0);

  useEffect(() => {
    nfcReader.onEvent = () => force((x) => x + 1);
    void nfcReader.connect().then(() => setConnected(true));
    const offCard = nfcReader.onCardDetected((uid) => {
      const res = resolveCard(uid);
      window.dispatchEvent(new CustomEvent('pos1s:nfc', { detail: { uid } }));
      if ('error' in res) toast.push('err', 'Kartu ditolak', res.error);
      else toast.push('ok', `Kartu terbaca — ${res.santri.name}`, `UID ${uid}`);
    });
    const offErr = nfcReader.onError((e) => toast.push('err', 'NFC Reader', e.message));
    return () => {
      offCard();
      offErr();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const santriWithCard = db.santri.filter((s) => activeCardOf(s.id));

  return (
    <>
      {/* pill status */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        className="no-print fixed bottom-[4.75rem] right-4 z-[60] flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900 py-2 pl-3 pr-4 text-xs font-bold text-navy-100 shadow-xl transition-transform hover:scale-[1.03] lg:bottom-4"
      >
        <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok blink' : 'bg-danger')} />
        <IcWifi size={14} className="text-gold-300" />
        NFC Simulator
        <span className="text-navy-400">{open ? '—' : '+'}</span>
      </button>

      {open && (
        <div className="anim-pop no-print fixed inset-x-3 bottom-2 z-[60] overflow-hidden rounded-xl border border-navy-700 bg-navy-950 text-navy-100 shadow-2xl lg:inset-x-auto lg:bottom-16 lg:right-4 lg:w-[320px]">
          <div className="motif flex items-center justify-between border-b border-navy-800 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold">
              <IcScan size={15} className="text-gold-300" /> MockNfcReader
              <Badge tone={connected ? 'ok' : 'danger'}>{connected ? 'TERHUBUNG' : 'OFFLINE'}</Badge>
            </div>
            <button onClick={() => setOpen(false)} className="text-navy-400 hover:text-white">
              <IcX size={14} />
            </button>
          </div>
          <div className="space-y-2.5 p-3.5">
            <p className="text-[11px] leading-relaxed text-navy-300">
              Simulasi USB NFC reader di meja kasir. Tempel = kirim UID ke halaman aktif (POS, top up, absensi…). Bacaan duplikat didebounce {db.settings.nfcCooldownMs} ms.
            </p>
            <div className="flex gap-1.5">
              <select
                className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-900 px-2 py-1.5 text-xs text-navy-100 outline-none"
                value={selSantri}
                onChange={(e) => setSelSantri(e.target.value)}
              >
                {santriWithCard.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Btn
                variant="gold"
                size="sm"
                className="pulse-ring"
                onClick={() => {
                  const card = activeCardOf(selSantri);
                  if (card) nfcReader.simulateTap(card.uid);
                }}
              >
                <IcCard size={13} /> Tempel
              </Btn>
            </div>
            <div className="flex gap-1.5">
              <input
                className="min-w-0 flex-1 rounded-lg border border-navy-700 bg-navy-900 px-2 py-1.5 text-[11px] text-navy-100 outline-none placeholder:text-navy-500"
                placeholder="UID manual: 04:A1:B2:…"
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && uidInput.trim()) {
                    nfcReader.simulateTap(uidInput);
                    setUidInput('');
                  }
                }}
              />
              <Btn variant="outline" size="sm" className="border-navy-700 bg-navy-900 text-navy-100 hover:bg-navy-800" onClick={() => {
                if (uidInput.trim()) {
                  nfcReader.simulateTap(uidInput);
                  setUidInput('');
                }
              }}>
                <IcSend size={13} />
              </Btn>
            </div>
            <button className="w-full rounded-lg border border-dashed border-navy-700 py-1.5 text-[11px] font-bold text-navy-300 hover:bg-navy-900" onClick={() => nfcReader.simulateUnknown()}>
              Tempel kartu tak dikenal (uji error)
            </button>
            <div className="max-h-28 space-y-1 overflow-auto rounded-lg bg-navy-900/70 p-2">
              {nfcReader.events.length === 0 && <p className="text-[11px] text-navy-500">Belum ada event…</p>}
              {nfcReader.events.map((e) => (
                <div key={e.id} className="flex items-start gap-1.5 text-[10.5px] leading-snug">
                  <span className={cx('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', e.kind === 'detected' && 'bg-ok', e.kind === 'duplicate' && 'bg-gold-400', e.kind === 'error' && 'bg-danger', e.kind === 'info' && 'bg-info')} />
                  <span className="text-navy-300">
                    <span className="tnum text-navy-500">{fmtTime(e.at)}</span> {e.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Shell ---------- */
export function Shell({ user, route, children }: { user: User; route: string[]; children: ReactNode }) {
  useDB();
  const [, nav] = useHashRoute();
  const toast = useToast();
  const install = useInstallApp();
  const [sideOpen, setSideOpen] = useState(false);
  const page = route[0] || 'dash';
  const unread = db.notifs.filter((n) => !n.read && (!n.userId || n.userId === user.id)).length;

  const navItems = useMemo(
    () => NAV.filter((n) => can(user, n.key)),
    [user]
  );
  const sections = useMemo(() => {
    const m = new Map<string, NavItem[]>();
    navItems.forEach((n) => m.set(n.section, [...(m.get(n.section) ?? []), n]));
    return [...m.entries()];
  }, [navItems]);

  const santri = user.waliId ? null : null;
  void santri;

  return (
    <div className="min-h-screen bg-bg">
      {/* sidebar */}
      <aside
        className={cx(
          'no-print motif fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-navy-950 text-navy-200 transition-transform duration-200 lg:translate-x-0',
          sideOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-navy-800/80 px-4 py-4">
          <Logo size={34} />
          <div className="min-w-0">
            <div className="font-display truncate text-[13.5px] font-bold leading-tight text-white">Pesantren One</div>
            <div className="truncate text-[10.5px] text-navy-400">{db.settings.pesantren}</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {sections.map(([sec, items]) => (
            <div key={sec} className="mb-4">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-500">{sec}</p>
              {items.map((n) => {
                const active = page === n.key || (n.key === 'santri' && page === 'santri');
                return (
                  <button
                    key={n.key}
                    onClick={() => {
                      nav(`#/${n.key}`);
                      setSideOpen(false);
                    }}
                    className={cx(
                      'group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold transition-all',
                      active ? 'bg-navy-800 text-white shadow-inner' : 'text-navy-300 hover:bg-navy-900 hover:text-white'
                    )}
                  >
                    <span className={cx('relative', active && 'text-gold-300')}>
                      {active && <span className="absolute -left-2.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-gold-400" />}
                      <n.icon size={16} />
                    </span>
                    {n.label}
                    {n.key === 'notif' && unread > 0 && (
                      <span className="ml-auto rounded-full bg-gold-400 px-1.5 py-px text-[10px] font-bold text-navy-950 tnum">{unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-navy-800/80 p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-navy-900/80 p-2.5">
            <Avatar name={user.name} color="#dba63e" size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">{user.name}</div>
              <div className="truncate text-[10.5px] text-navy-400">{ROLE_LABEL[user.role]}</div>
            </div>
            <button
              title="Keluar"
              onClick={() => {
                logout();
                nav('#/');
              }}
              className="rounded-md p-1.5 text-navy-400 transition-colors hover:bg-navy-800 hover:text-danger"
            >
              <IcLogout size={15} />
            </button>
          </div>
        </div>
      </aside>
      {sideOpen && <div className="no-print fixed inset-0 z-40 bg-navy-950/50 lg:hidden" onClick={() => setSideOpen(false)} />}

      {/* main */}
      <div className="lg:pl-60">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-2.5 lg:px-6">
            <button className="rounded-md border border-line p-1.5 lg:hidden" onClick={() => setSideOpen(true)}>
              <IcGrip size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display truncate text-[15px] font-bold tracking-tight">{ROUTE_TITLE[page] ?? 'Pesantren One System'}</h1>
              <p className="hidden text-[11px] text-mute sm:block">
                {db.settings.termYear} · {db.settings.term} · {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {install.available && (
                <Btn
                  variant="gold"
                  size="sm"
                  onClick={async () => {
                    const ok = await install.prompt();
                    toast.push(
                      ok ? 'ok' : 'info',
                      ok ? 'Aplikasi terpasang' : 'Instalasi dibatalkan',
                      ok ? 'Buka Pesantren One System dari layar utama HP Anda.' : 'Menu Chrome ⋮ → "Tambahkan ke layar utama" juga bisa.'
                    );
                  }}
                >
                  <IcDownload size={13} /> <span className="hidden sm:inline">Instal Aplikasi</span>
                  <span className="sm:hidden">Instal</span>
                </Btn>
              )}
              <span className="hidden items-center gap-1.5 rounded-full border border-okln bg-okbg px-2.5 py-1 text-[11px] font-bold text-ok md:flex">
                <span className="blink h-1.5 w-1.5 rounded-full bg-ok" /> NFC Reader Aktif
              </span>
              {can(user, 'notif') && (
                <button onClick={() => nav('#/notif')} className="relative rounded-md border border-line p-1.5 text-mute transition-colors hover:bg-navy-50 hover:text-ink" title="Notifikasi">
                  <IcBell size={16} />
                  {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-bold text-white tnum">{unread}</span>}
                </button>
              )}
              <Badge tone={ROLE_TONE[user.role] as Tone} className="hidden sm:inline-flex">{ROLE_LABEL[user.role]}</Badge>
              <div className="flex items-center gap-2 rounded-lg border border-line py-1 pl-1 pr-2.5">
                <Avatar name={user.name} color="#143a6c" size={26} />
                <span className="hidden max-w-28 truncate text-xs font-bold md:block">{user.name}</span>
              </div>
            </div>
          </div>
        </header>
        <main key={page} className="anim-fade-up mx-auto max-w-[1400px] p-4 pb-28 lg:p-6">{children}</main>
      </div>
      <NfcDock />
    </div>
  );
}

export function PageHead({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        {desc && <p className="mt-0.5 text-[13px] text-mute">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SantriChip({ id, size = 'md' }: { id?: string; size?: 'sm' | 'md' }) {
  const s = santriById(id);
  if (!s) return <span className="text-xs text-mute">Umum</span>;
  return (
    <span className="flex items-center gap-2">
      <Avatar name={s.name} color={s.color} size={size === 'sm' ? 24 : 30} />
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-bold leading-tight">{s.name}</span>
        <span className="block text-[10.5px] leading-tight text-mute tnum">NIS {s.nis}</span>
      </span>
    </span>
  );
}

export function balanceLabel(id: string): string {
  return rp(balanceOf(id));
}

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}
