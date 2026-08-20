/* ===== Autentikasi & RBAC =====
   Demo: kredensial lokal. Produksi: Supabase Auth (password tidak pernah
   disimpan manual) + Row Level Security di PostgreSQL. Role TIDAK dipercaya
   dari frontend — ditentukan dari record user di "server". */

import type { Role, User } from '../types';
import { currentUser, db, mutate } from '../store';
import { audit } from './audit';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin Pesantren',
  BENDAHARA: 'Bendahara',
  KASIR: 'Kasir',
  PENGURUS: 'Pengurus Asrama',
  GURU: 'Guru',
  LAUNDRY: 'Petugas Laundry',
  PERPUS: 'Petugas Perpustakaan',
  WALI: 'Wali Santri',
};

export const ROLE_TONE: Record<Role, 'gold' | 'navy' | 'ok' | 'info' | 'warn' | 'danger' | 'mute'> = {
  SUPER_ADMIN: 'gold',
  ADMIN: 'navy',
  BENDAHARA: 'ok',
  KASIR: 'info',
  PENGURUS: 'warn',
  GURU: 'info',
  LAUNDRY: 'mute',
  PERPUS: 'mute',
  WALI: 'gold',
};

const PERMS: Record<Role, string[]> = {
  SUPER_ADMIN: ['dash', 'santri', 'kartu', 'pos', 'topup', 'wallet', 'tagihan', 'produk', 'laundry', 'perpustakaan', 'absensi', 'akademik', 'hafalan', 'pelanggaran', 'wali', 'laporan', 'audit', 'users', 'notif', 'tests', 'pengaturan'],
  ADMIN: ['dash', 'santri', 'kartu', 'absensi', 'akademik', 'hafalan', 'pelanggaran', 'laporan', 'pengaturan'],
  BENDAHARA: ['dash', 'topup', 'wallet', 'tagihan', 'laporan', 'audit'],
  KASIR: ['dash', 'pos', 'topup', 'produk', 'laporan'],
  PENGURUS: ['dash', 'santri', 'absensi', 'pelanggaran', 'laundry'],
  GURU: ['dash', 'akademik', 'hafalan', 'absensi'],
  LAUNDRY: ['dash', 'laundry'],
  PERPUS: ['dash', 'perpustakaan'],
  WALI: ['wali', 'tagihan', 'notif'],
};

export function can(user: User | null, route: string): boolean {
  if (!user) return false;
  return PERMS[user.role]?.includes(route) ?? false;
}

export function login(username: string, password: string): User {
  const user = db.users.find((u) => u.username === username.trim().toLowerCase());
  if (!user) throw new Error('Username tidak ditemukan.');
  if (!user.active) throw new Error('Akun dinonaktifkan. Hubungi admin.');
  if (user.password !== password) throw new Error('Password salah.');
  mutate((d) => {
    d.sessionUserId = user.id;
    const u = d.users.find((x) => x.id === user.id)!;
    u.lastLoginAt = new Date().toISOString();
  });
  audit(user, 'LOGIN', 'users', user.id, `Login berhasil sebagai ${ROLE_LABEL[user.role]}`);
  return user;
}

export function logout(): void {
  const user = currentUser();
  if (user) audit(user, 'LOGOUT', 'users', user.id, 'Logout');
  mutate((d) => {
    d.sessionUserId = null;
  });
}

export function requireRole(user: User | null, routes: string[]): void {
  if (!user) throw new Error('Sesi berakhir. Silakan masuk kembali.');
  if (!routes.some((r) => can(user, r))) throw new Error('Akses ditolak: Anda tidak memiliki izin untuk halaman ini.');
}
