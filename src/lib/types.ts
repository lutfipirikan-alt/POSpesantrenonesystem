/* ===== Pesantren One System — Skema Data (cerminan skema relational PostgreSQL) ===== */

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'BENDAHARA'
  | 'KASIR'
  | 'PENGURUS'
  | 'GURU'
  | 'LAUNDRY'
  | 'PERPUS'
  | 'WALI';

export interface User {
  id: string;
  username: string;
  password: string; // demo only — produksi: hash via Supabase Auth, tidak pernah disimpan plaintext
  name: string;
  role: Role;
  outletId?: string;
  waliId?: string;
  active: boolean;
  lastLoginAt?: string;
}

export type SantriStatus = 'aktif' | 'cuti' | 'lulus' | 'keluar' | 'nonaktif';

export interface Santri {
  id: string;
  nis: string;
  nisn?: string;
  name: string;
  nickname: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  address: string;
  kelasId: string;
  entryYear: number;
  status: SantriStatus;
  kamarId?: string;
  activeCardId?: string;
  color: string;
  createdAt: string;
  deletedAt?: string; // soft delete
}

export interface Wali {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  userId?: string;
}

export interface WaliSantri {
  waliId: string;
  santriId: string;
  relation: string;
}

export interface Kelas {
  id: string;
  name: string;
  level: number;
  teacherId: string;
}

export interface Asrama {
  id: string;
  name: string;
  gender: 'L' | 'P';
}

export interface Kamar {
  id: string;
  asramaId: string;
  name: string;
  capacity: number;
}

export type CardStatus = 'ACTIVE' | 'BLOCKED' | 'LOST' | 'REPLACED' | 'INACTIVE';

export interface NfcCard {
  id: string;
  santriId: string;
  uid: string;
  cardNumber: string;
  status: CardStatus;
  issuedAt: string;
  deactivatedAt?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  santriId: string;
  balance: number; // cache — sumber kebenaran: ledger walletTxs
  updatedAt: string;
}

export type TxType =
  | 'TOP_UP'
  | 'PURCHASE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'TRANSFER'
  | 'WITHDRAWAL'
  | 'LAUNDRY'
  | 'LIBRARY_FINE'
  | 'OTHER';

export interface WalletTx {
  id: string;
  santriId: string;
  type: TxType;
  amount: number; // bertanda: + masuk, - keluar
  balanceBefore: number;
  balanceAfter: number;
  refType: 'SALE' | 'LAUNDRY' | 'LOAN' | 'INVOICE' | 'MANUAL' | 'TOPUP';
  refId: string;
  description: string;
  createdBy: string;
  createdAt: string;
  idemKey?: string; // idempotency key — unique
}

export interface ProductCategory {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  outletId: string;
  price: number;
  cost: number;
  stock: number;
  status: 'aktif' | 'nonaktif';
  color: string;
  deletedAt?: string;
}

export interface Outlet {
  id: string;
  name: string;
  code: string;
  kind: 'retail' | 'food' | 'service';
  active: boolean;
}

export interface OutletUser {
  outletId: string;
  userId: string;
}

export type SaleMethod = 'SALDO_NFC' | 'CASH';

export interface Sale {
  id: string;
  number: string;
  outletId: string;
  santriId?: string;
  cashierId: string;
  method: SaleMethod;
  subtotal: number;
  total: number;
  status: 'SUCCESS' | 'REFUNDED';
  idemKey: string;
  createdAt: string;
  refundedAt?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  name: string;
  price: number; // harga dari server (katalog), bukan dari client
  cost: number;
  qty: number;
  total: number;
}

export type InvType = 'IN' | 'OUT' | 'ADJUST' | 'SALE' | 'REFUND';

export interface InventoryTx {
  id: string;
  productId: string;
  type: InvType;
  qty: number;
  note: string;
  userId: string;
  createdAt: string;
}

export type LaundryStatus =
  | 'RECEIVED'
  | 'WASHING'
  | 'DRYING'
  | 'IRONING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface LaundryService {
  id: string;
  name: string;
  priceKg: number;
  duration: string;
}

export interface LaundryOrder {
  id: string;
  number: string;
  santriId: string;
  serviceId: string;
  weightKg: number;
  priceKg: number;
  total: number;
  status: LaundryStatus;
  method?: SaleMethod;
  paidAt?: string;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  copies: number;
  available: number;
  color: string;
}

export interface Loan {
  id: string;
  bookId: string;
  santriId: string;
  loanDate: string;
  dueDate: string;
  returnDate?: string;
  fine: number;
  finePaid: boolean;
  status: 'DIPINJAM' | 'KEMBALI';
}

export type AbsenType = 'masuk' | 'kelas' | 'shalat' | 'kegiatan' | 'asrama';

export interface AttendanceSession {
  id: string;
  name: string;
  type: AbsenType;
  unit: string;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  closedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  santriId: string;
  at: string;
  status: 'HADIR' | 'TERLAMBAT';
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  kelasId: string;
  teacherId: string;
}

export interface Grade {
  id: string;
  santriId: string;
  subjectId: string;
  term: string;
  kind: 'Harian' | 'UTS' | 'UAS' | 'Tugas';
  score: number;
  note?: string;
  teacherId: string;
  createdAt: string;
}

export interface MemTarget {
  id: string;
  kelasId: string;
  juz: number;
  label: string;
}

export interface MemRecord {
  id: string;
  santriId: string;
  surah: string;
  fromAyah: number;
  toAyah: number;
  date: string;
  quality: 'Mumtaz' | 'Jayyid Jiddan' | 'Jayyid' | 'Maqbul';
  note?: string;
  teacherId: string;
}

export interface ViolationType {
  id: string;
  name: string;
  points: number;
  category: string;
}

export interface Violation {
  id: string;
  santriId: string;
  typeId: string;
  date: string;
  points: number;
  officerId: string;
  note: string;
  action: string;
  status: 'TERCATAT' | 'DITINDAK' | 'SELESAI';
}

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export interface Invoice {
  id: string;
  number: string;
  santriId: string;
  type: 'SPP' | 'MAKAN' | 'ASRAMA' | 'PENDIDIKAN' | 'LAUNDRY' | 'KEGIATAN' | 'LAINNYA';
  label: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  period: string;
  status: InvoiceStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  santriId: string;
  amount: number;
  method: 'CASH' | 'TRANSFER' | 'SALDO_NFC';
  note: string;
  userId: string;
  idemKey: string;
  createdAt: string;
}

export interface Notif {
  id: string;
  userId?: string;
  title: string;
  body: string;
  channel: 'inapp' | 'whatsapp';
  read: boolean;
  refType?: string;
  refId?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface Settings {
  pesantren: string;
  address: string;
  phone: string;
  termYear: string;
  term: 'Ganjil' | 'Genap';
  waProvider: string;
  nfcCooldownMs: number;
}

export interface DB {
  version: number;
  settings: Settings;
  sessionUserId: string | null;
  users: User[];
  santri: Santri[];
  wali: Wali[];
  waliSantri: WaliSantri[];
  kelas: Kelas[];
  asrama: Asrama[];
  kamar: Kamar[];
  cards: NfcCard[];
  wallets: Wallet[];
  walletTxs: WalletTx[];
  categories: ProductCategory[];
  products: Product[];
  outlets: Outlet[];
  outletUsers: OutletUser[];
  sales: Sale[];
  saleItems: SaleItem[];
  inventoryTxs: InventoryTx[];
  laundryServices: LaundryService[];
  laundryOrders: LaundryOrder[];
  books: Book[];
  loans: Loan[];
  sessions: AttendanceSession[];
  attendance: AttendanceRecord[];
  subjects: Subject[];
  grades: Grade[];
  memTargets: MemTarget[];
  memRecords: MemRecord[];
  violationTypes: ViolationType[];
  violations: Violation[];
  invoices: Invoice[];
  payments: Payment[];
  notifs: Notif[];
  audits: AuditLog[];
}
