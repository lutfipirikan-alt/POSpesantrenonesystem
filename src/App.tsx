/* ===== Pesantren One System — root & router ===== */

import { useState } from 'react';
import { currentUser, useDB, waliChildren as dbWaliChildren } from './lib/store';
import { can } from './lib/services/auth';
import { LoginPage, Shell, useHashRoute } from './components/layout';
import { Btn, Empty, ToastProvider } from './components/ui';
import { IcLock } from './components/icons';
import Dashboard from './pages/Dashboard';
import { SantriListPage, SantriDetailPage } from './pages/Santri';
import CardsPage from './pages/Cards';
import { TopUpPage, WalletPage, TagihanPage } from './pages/Finance';
import PosPage from './pages/Pos';
import CatalogPage from './pages/Catalog';
import LaundryPage from './pages/Laundry';
import LibraryPage from './pages/Library';
import { AttendancePage, AcademicPage, MemorizationPage, ViolationPage } from './pages/School';
import WaliPortal from './pages/Wali';
import { LaporanPage, AuditPage, UsersPage, NotifPage, TestsPage, SettingsPage } from './pages/Admin';

function Router() {
  useDB();
  const [route] = useHashRoute();
  const user = currentUser();

  if (!user) return <LoginPage />;

  const page = route[0] || (user.role === 'WALI' ? 'wali' : 'dash');
  const allowed = can(user, page);

  if (!allowed) {
    return (
      <Shell user={user} route={route}>
        <Empty
          icon={<IcLock size={22} />}
          title="Akses ditolak"
          desc={`Role Anda tidak memiliki izin untuk halaman "${page}". Izin diverifikasi di sisi server.`}
          action={<Btn onClick={() => (window.location.hash = user.role === 'WALI' ? '#/wali' : '#/')}>Kembali ke beranda</Btn>}
        />
      </Shell>
    );
  }

  let el: React.ReactNode;
  switch (page) {
    case 'dash':
      el = user.role === 'WALI' ? <WaliPortal user={user} /> : <Dashboard user={user} />;
      break;
    case 'wali':
      el = <WaliPortal user={user} />;
      break;
    case 'santri':
      el = route[1] ? <SantriDetailPage id={route[1]} user={user} /> : <SantriListPage user={user} />;
      break;
    case 'kartu':
      el = <CardsPage user={user} />;
      break;
    case 'pos':
      el = <PosPage user={user} />;
      break;
    case 'topup':
      el = <TopUpPage user={user} />;
      break;
    case 'wallet':
      el = <WalletPage user={user} />;
      break;
    case 'tagihan':
      el = user.role === 'WALI' ? <WaliBilling user={user} /> : <TagihanPage user={user} />;
      break;
    case 'produk':
      el = <CatalogPage user={user} />;
      break;
    case 'laundry':
      el = <LaundryPage user={user} />;
      break;
    case 'perpustakaan':
      el = <LibraryPage user={user} />;
      break;
    case 'absensi':
      el = <AttendancePage user={user} />;
      break;
    case 'akademik':
      el = <AcademicPage user={user} />;
      break;
    case 'hafalan':
      el = <MemorizationPage user={user} />;
      break;
    case 'pelanggaran':
      el = <ViolationPage user={user} />;
      break;
    case 'laporan':
      el = <LaporanPage />;
      break;
    case 'audit':
      el = <AuditPage />;
      break;
    case 'users':
      el = <UsersPage user={user} />;
      break;
    case 'notif':
      el = <NotifPage user={user} />;
      break;
    case 'tests':
      el = <TestsPage />;
      break;
    case 'pengaturan':
      el = <SettingsPage />;
      break;
    default:
      el = <Dashboard user={user} />;
  }

  return <Shell user={user} route={route}>{el}</Shell>;
}

/** Tagihan dalam konteks wali: pilih anak, lalu lihat tagihannya. */
function WaliBilling({ user }: { user: import('./lib/types').User }) {
  useDB();
  const children = user.waliId ? dbWaliChildren(user.waliId) : [];
  const [childId, setChildId] = useState(children[0]?.id ?? '');
  return (
    <div className="space-y-3">
      {children.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {children.map((c) => (
            <button
              key={c.id}
              onClick={() => setChildId(c.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${childId === c.id ? 'border-navy-800 bg-navy-800 text-white' : 'border-line bg-surface text-mute'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      {childId ? <TagihanPage user={user} waliView={childId} /> : <Empty title="Belum ada anak tertaut" />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Router />
    </ToastProvider>
  );
}
