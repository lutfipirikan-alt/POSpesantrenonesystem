/* ===== Seed data demo — Pondok Pesantren Demo =====
   Riwayat 14 hari dibangkitkan deterministik; ledger selalu konsisten dengan saldo akhir. */

import type {
  AttendanceRecord, AttendanceSession, AuditLog, Book, DB, Grade, InventoryTx, Invoice,
  LaundryOrder, Loan, MemRecord, NfcCard, Notif, Payment, Product, Sale, SaleItem, Santri,
  User, Violation, WalletTx,
} from './types';
import { daysAgoISO, mulberry32, uid, uuid } from './util';

export const SEED_VERSION = 7;
const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const H = 3600_000;
const D = 24 * H;

const santriSpec = [
  { id: 'SAN-001', nis: '202600123', nisn: '0091234561', name: 'Ahmad Fauzan', nick: 'Ahmad', gender: 'L' as const, bp: 'Kediri', bd: '2012-04-11', addr: 'Jl. Melati 12, Kediri', kelasId: 'KLS-02', year: 2024, kamar: 'KMR-A01', card: '04:A1:B2:C3:D4:E5:F6', cardNo: 'NFC-0001', color: '#1f4b85', final: 150_000 },
  { id: 'SAN-002', nis: '202600124', nisn: '0091234562', name: 'Muhammad Ridwan', nick: 'Ridwan', gender: 'L' as const, bp: 'Malang', bd: '2012-08-23', addr: 'Jl. Kenanga 3, Malang', kelasId: 'KLS-02', year: 2024, kamar: 'KMR-A01', card: '04:B1:C2:D3:E4:F5:A6', cardNo: 'NFC-0002', color: '#17835a', final: 100_000 },
  { id: 'SAN-003', nis: '202600125', nisn: '0091234563', name: 'Ali Akbar', nick: 'Ali', gender: 'L' as const, bp: 'Surabaya', bd: '2013-01-17', addr: 'Jl. Mangga 8, Surabaya', kelasId: 'KLS-02', year: 2024, kamar: 'KMR-A02', card: '04:C1:D2:E3:F4:A5:B6', cardNo: 'NFC-0003', color: '#a26a10', final: 75_000 },
  { id: 'SAN-004', nis: '202600126', name: 'Hasan Basri', nick: 'Hasan', gender: 'L' as const, bp: 'Jombang', bd: '2013-06-02', addr: 'Ds. Plandi, Jombang', kelasId: 'KLS-01', year: 2025, kamar: 'KMR-B01', card: '04:D1:E2:F3:A4:B5:C6', cardNo: 'NFC-0004', color: '#2c6fb0', final: 40_000 },
  { id: 'SAN-005', nis: '202600127', nisn: '0091234565', name: 'Fatimah Azzahra', nick: 'Fatimah', gender: 'P' as const, bp: 'Yogyakarta', bd: '2011-11-30', addr: 'Jl. Kaliurang km 9, Sleman', kelasId: 'KLS-03', year: 2023, kamar: 'KMR-C01', card: '04:E1:F2:A3:B4:C5:D6', cardNo: 'NFC-0005', color: '#8b5cf6', final: 200_000 },
  { id: 'SAN-006', nis: '202500098', name: 'Umar Faruq', nick: 'Umar', gender: 'L' as const, bp: 'Solo', bd: '2012-02-14', addr: 'Jl. Slamet Riyadi 45, Solo', kelasId: 'KLS-02', year: 2023, kamar: 'KMR-A02', card: '', cardNo: '', color: '#c24545', final: 0, cuti: true },
];

const productSpec: Array<[string, string, string, string, string, string, number, number, number, string]> = [
  ['PRD-01', 'KPR-001', '8991001', 'Air Mineral 600ml', 'CAT-2', 'OUT-01', 3000, 2000, 148, '#2c6fb0'],
  ['PRD-02', 'KPR-002', '8991002', 'Roti Cokelat', 'CAT-1', 'OUT-01', 5000, 3500, 64, '#a26a10'],
  ['PRD-03', 'KPR-003', '8991003', 'Buku Tulis 38lbr', 'CAT-3', 'OUT-01', 4000, 2600, 210, '#17835a'],
  ['PRD-04', 'KPR-004', '8991004', 'Pensil 2B', 'CAT-3', 'OUT-01', 2000, 1200, 180, '#5c6c86'],
  ['PRD-05', 'KPR-005', '8991005', 'Sabun Mandi', 'CAT-4', 'OUT-01', 5000, 3600, 92, '#8b5cf6'],
  ['PRD-06', 'KPR-006', '8991006', 'Mie Instan Cup', 'CAT-1', 'OUT-01', 6000, 4500, 75, '#c24545'],
  ['PRD-07', 'KPR-007', '8991007', 'Susu Kotak 200ml', 'CAT-2', 'OUT-01', 5000, 3800, 58, '#dba63e'],
  ['PRD-08', 'KPR-008', '8991008', 'Odol 120g', 'CAT-4', 'OUT-01', 9000, 6800, 40, '#17835a'],
  ['PRD-09', 'KNT-001', '8992001', 'Nasi + Ayam Goreng', 'CAT-5', 'OUT-02', 10000, 7000, 999, '#a26a10'],
  ['PRD-10', 'KNT-002', '8992002', 'Es Teh Manis', 'CAT-2', 'OUT-02', 3000, 1000, 999, '#dba63e'],
  ['PRD-11', 'KNT-003', '8992003', 'Bakso Kuah', 'CAT-5', 'OUT-02', 8000, 5500, 999, '#c24545'],
  ['PRD-12', 'KNT-004', '8992004', 'Gorengan (3 pcs)', 'CAT-1', 'OUT-02', 3000, 1800, 999, '#17835a'],
];

export function buildSeed(): DB {
  const rnd = mulberry32(20260817);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const between = (a: number, b: number) => a + rnd() * (b - a);

  /* ---------- master ---------- */
  const users: User[] = [
    { id: 'U-01', username: 'superadmin', password: 'demo123', name: 'H. Zainal Arifin', role: 'SUPER_ADMIN', active: true },
    { id: 'U-02', username: 'admin', password: 'demo123', name: 'Ust. Salman Al-Farisi', role: 'ADMIN', active: true },
    { id: 'U-03', username: 'bendahara', password: 'demo123', name: 'Ustdz. Rahmawati', role: 'BENDAHARA', active: true },
    { id: 'U-04', username: 'kasir', password: 'demo123', name: 'Bima Saputra', role: 'KASIR', outletId: 'OUT-01', active: true },
    { id: 'U-05', username: 'pengurus', password: 'demo123', name: 'Ust. Fauzi Rahman', role: 'PENGURUS', active: true },
    { id: 'U-06', username: 'guru', password: 'demo123', name: 'Ust. Karim Hakim', role: 'GURU', active: true },
    { id: 'U-07', username: 'laundry', password: 'demo123', name: 'Tono Prasetyo', role: 'LAUNDRY', outletId: 'OUT-03', active: true },
    { id: 'U-08', username: 'perpus', password: 'demo123', name: 'Ustdz. Niamah', role: 'PERPUS', outletId: 'OUT-04', active: true },
    { id: 'U-09', username: 'wali', password: 'demo123', name: 'H. Abdullah', role: 'WALI', waliId: 'WL-01', active: true },
    { id: 'U-10', username: 'kasir2', password: 'demo123', name: 'Siti Nurhaliza', role: 'KASIR', outletId: 'OUT-02', active: true },
  ];

  const santriList: Santri[] = santriSpec.map((s) => ({
    id: s.id, nis: s.nis, nisn: s.nisn, name: s.name, nickname: s.nick, gender: s.gender,
    birthPlace: s.bp, birthDate: s.bd, address: s.addr, kelasId: s.kelasId, entryYear: s.year,
    status: s.cuti ? 'cuti' : 'aktif', kamarId: s.kamar, activeCardId: s.card ? `CRD-${s.id}` : undefined,
    color: s.color, createdAt: daysAgoISO(400 - s.year * 0.1),
  }));

  const cards: NfcCard[] = santriSpec.filter((s) => s.card).map((s) => ({
    id: `CRD-${s.id}`, santriId: s.id, uid: s.card, cardNumber: s.cardNo, status: 'ACTIVE',
    issuedAt: daysAgoISO(300, 8), createdAt: daysAgoISO(300, 8), updatedAt: daysAgoISO(300, 8),
  }));
  // riwayat kartu hilang milik Ali (tidak boleh pernah dihapus)
  cards.push({
    id: 'CRD-OLD-003', santriId: 'SAN-003', uid: '04:AA:BB:CC:DD:EE:01', cardNumber: 'NFC-0000',
    status: 'LOST', issuedAt: daysAgoISO(300, 8), deactivatedAt: daysAgoISO(40, 10),
    reason: 'Kartu hilang di asrama', createdAt: daysAgoISO(300, 8), updatedAt: daysAgoISO(40, 10),
  });

  const products: Product[] = productSpec.map((p) => ({
    id: p[0], sku: p[1], barcode: p[2], name: p[3], categoryId: p[4], outletId: p[5],
    price: p[6], cost: p[7], stock: p[8], status: 'aktif', color: p[9],
  }));

  const inventoryTxs: InventoryTx[] = products
    .filter((p) => p.outletId === 'OUT-01')
    .map((p) => ({
      id: uid('INV'), productId: p.id, type: 'IN' as const, qty: p.stock,
      note: 'Stok awal periode', userId: 'U-04', createdAt: daysAgoISO(15, 7),
    }));

  /* ---------- riwayat 14 hari (ledger konsisten) ---------- */
  const sales: Sale[] = [];
  const saleItems: SaleItem[] = [];
  const walletTxs: WalletTx[] = [];
  const deltas: Record<string, number> = {};
  const addDelta = (sid: string, amt: number) => (deltas[sid] = (deltas[sid] ?? 0) + amt);
  const nfcSantri = ['SAN-001', 'SAN-002', 'SAN-003', 'SAN-001', 'SAN-005', 'SAN-002'];

  let saleSeq = 1;
  const pushSale = (sid: string, dayIdx: number, ms: number, method: 'SALDO_NFC' | 'CASH') => {
    const outlet = rnd() > 0.42 ? 'OUT-01' : 'OUT-02';
    const pool = products.filter((p) => p.outletId === outlet);
    const nItems = 1 + Math.floor(rnd() * 3);
    const chosen: Product[] = [];
    for (let i = 0; i < nItems; i++) chosen.push(pick(pool));
    const items: SaleItem[] = [];
    let total = 0;
    const saleId = uid('SLE');
    chosen.forEach((p) => {
      const qty = rnd() > 0.8 ? 2 : 1;
      total += p.price * qty;
      items.push({ id: uid('ITM'), saleId, productId: p.id, name: p.name, price: p.price, cost: p.cost, qty, total: p.price * qty });
    });
    const d = new Date(ms);
    const number = `TRX-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(saleSeq++).padStart(4, '0')}`;
    sales.push({
      id: saleId, number, outletId: outlet, santriId: method === 'SALDO_NFC' ? sid : undefined,
      cashierId: outlet === 'OUT-01' ? 'U-04' : 'U-10', method, subtotal: total, total,
      status: 'SUCCESS', idemKey: uuid(), createdAt: iso(ms),
    });
    saleItems.push(...items);
    if (method === 'SALDO_NFC') addDelta(sid, -total);
    return { saleId, total, number, ms, sid };
  };

  type HistEvt = { ms: number; sid: string; kind: 'SALE' | 'TOPUP'; amount: number; refId: string; refNumber: string };
  const events: HistEvt[] = [];

  for (let day = 13; day >= 0; day--) {
    const base = NOW - day * D;
    const n = day === 0 ? 4 : 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const sid = pick(nfcSantri);
      const ms = day === 0 ? NOW - (n - i) * 42 * 60_000 : base - Math.floor(between(2, 11)) * H;
      if (ms > NOW - 2 * 60_000 && day === 0) continue;
      const r = pushSale(sid, day, ms, rnd() > 0.22 ? 'SALDO_NFC' : 'CASH');
      if (r.sid === sid && sales[sales.length - 1]?.method === 'SALDO_NFC')
        events.push({ ms, sid, kind: 'SALE', amount: -r.total, refId: r.saleId, refNumber: r.number });
    }
    if (day === 9 || day === 4) {
      const sid = day === 9 ? 'SAN-002' : 'SAN-003';
      const amount = 50_000;
      addDelta(sid, amount);
      events.push({ ms: base - 6 * H, sid, kind: 'TOPUP', amount, refId: uid('TPU'), refNumber: `TP-${day === 9 ? '0141' : '0157'}` });
    }
  }
  events.sort((a, b) => a.ms - b.ms);

  // saldo awal = target akhir - delta riwayat (agar saldo akhir pas dengan spesifikasi demo)
  const running: Record<string, number> = {};
  santriSpec.forEach((s) => {
    running[s.id] = s.final - (deltas[s.id] ?? 0);
    walletTxs.push({
      id: uid('WTX'), santriId: s.id, type: 'TOP_UP', amount: running[s.id], balanceBefore: 0,
      balanceAfter: running[s.id], refType: 'TOPUP', refId: uid('TPU'),
      description: 'Saldo awal tahun ajaran (top up bendahara)', createdBy: 'U-03',
      createdAt: daysAgoISO(15, 7, 30), idemKey: uuid(),
    });
  });
  events.forEach((e) => {
    const before = running[e.sid] ?? 0;
    const after = before + e.amount;
    running[e.sid] = after;
    walletTxs.push({
      id: uid('WTX'), santriId: e.sid,
      type: e.kind === 'TOPUP' ? 'TOP_UP' : 'PURCHASE', amount: e.amount, balanceBefore: before,
      balanceAfter: after, refType: e.kind === 'TOPUP' ? 'TOPUP' : 'SALE', refId: e.refId,
      description: e.kind === 'TOPUP' ? `Top up tunai (${e.refNumber})` : `Transaksi ${e.refNumber}`,
      createdBy: e.kind === 'TOPUP' ? 'U-03' : 'U-04', createdAt: iso(e.ms), idemKey: uuid(),
    });
  });

  // refund contoh: 1 transaksi Ali kemarin dibatalkan → stok kembali + saldo kembali
  const refundedSale = sales.filter((s) => s.santriId === 'SAN-003').slice(-1)[0];
  if (refundedSale) {
    refundedSale.status = 'REFUNDED';
    refundedSale.refundedAt = iso(new Date(refundedSale.createdAt).getTime() + 2 * H);
    const before = running['SAN-003']!;
    walletTxs.push({
      id: uid('WTX'), santriId: 'SAN-003', type: 'REFUND', amount: refundedSale.total,
      balanceBefore: before, balanceAfter: before + refundedSale.total, refType: 'SALE',
      refId: refundedSale.id, description: `Refund ${refundedSale.number} — barang tidak tersedia`,
      createdBy: 'U-04', createdAt: refundedSale.refundedAt, idemKey: uuid(),
    });
    saleItems.filter((i) => i.saleId === refundedSale.id).forEach((i) => {
      inventoryTxs.push({ id: uid('INV'), productId: i.productId, type: 'REFUND', qty: i.qty, note: `Refund ${refundedSale.number}`, userId: 'U-04', createdAt: refundedSale.refundedAt! });
    });
    running['SAN-003'] = before + refundedSale.total;
    deltas['SAN-003'] = (deltas['SAN-003'] ?? 0) + refundedSale.total;
  }

  const wallets = santriSpec.map((s) => ({ santriId: s.id, balance: running[s.id] ?? 0, updatedAt: iso(NOW - 3 * H) }));

  /* ---------- modul lain ---------- */
  const sessions: AttendanceSession[] = [
    { id: 'SES-01', name: 'Shalat Subuh Berjamaah', type: 'shalat', unit: 'Masjid Al-Ikhlas', startsAt: daysAgoISO(1, 4, 15), endsAt: daysAgoISO(1, 5, 0), createdBy: 'U-05', closedAt: daysAgoISO(1, 5, 5) },
    { id: 'SES-02', name: 'KBM Pagi — Sesi 1', type: 'kelas', unit: 'Gedung Ibnu Sina', startsAt: iso(NOW - 2 * H), endsAt: iso(NOW + 2 * H), createdBy: 'U-06' },
    { id: 'SES-03', name: 'Apel Pagi Asrama', type: 'asrama', unit: 'Halaman Asrama Putra', startsAt: daysAgoISO(1, 6, 0), endsAt: daysAgoISO(1, 6, 30), createdBy: 'U-05', closedAt: daysAgoISO(1, 6, 40) },
  ];
  const attendance: AttendanceRecord[] = [
    { id: uid('ABS'), sessionId: 'SES-01', santriId: 'SAN-001', at: daysAgoISO(1, 4, 21), status: 'HADIR' },
    { id: uid('ABS'), sessionId: 'SES-01', santriId: 'SAN-002', at: daysAgoISO(1, 4, 26), status: 'HADIR' },
    { id: uid('ABS'), sessionId: 'SES-01', santriId: 'SAN-003', at: daysAgoISO(1, 4, 52), status: 'TERLAMBAT' },
    { id: uid('ABS'), sessionId: 'SES-01', santriId: 'SAN-005', at: daysAgoISO(1, 4, 19), status: 'HADIR' },
    { id: uid('ABS'), sessionId: 'SES-02', santriId: 'SAN-001', at: iso(NOW - 1.6 * H), status: 'HADIR' },
    { id: uid('ABS'), sessionId: 'SES-02', santriId: 'SAN-002', at: iso(NOW - 1.4 * H), status: 'HADIR' },
    { id: uid('ABS'), sessionId: 'SES-02', santriId: 'SAN-004', at: iso(NOW - 0.9 * H), status: 'TERLAMBAT' },
    { id: uid('ABS'), sessionId: 'SES-03', santriId: 'SAN-001', at: daysAgoISO(1, 6, 4), status: 'HADIR' },
    { id: uid('ABS'), sessionId: 'SES-03', santriId: 'SAN-004', at: daysAgoISO(1, 6, 6), status: 'HADIR' },
  ];

  const grades: Grade[] = [];
  const gSubjects = ['SUB-01', 'SUB-02', 'SUB-03'];
  ['SAN-001', 'SAN-002', 'SAN-003'].forEach((sid, i) =>
    gSubjects.forEach((sub, j) => {
      (['UTS', 'UAS'] as const).forEach((kind, k) => {
        grades.push({
          id: uid('GRD'), santriId: sid, subjectId: sub, term: '2026/2027 Ganjil', kind,
          score: Math.round(68 + ((i * 7 + j * 9 + k * 5) % 28)), note: '', teacherId: 'U-06',
          createdAt: daysAgoISO(20 - k * 10),
        });
      });
    })
  );

  const memRecords: MemRecord[] = [
    { id: uid('MEM'), santriId: 'SAN-001', surah: 'An-Naba', fromAyah: 1, toAyah: 40, date: daysAgoISO(12), quality: 'Jayyid Jiddan', note: 'Tajwid baik, lancarkan makhraj', teacherId: 'U-06' },
    { id: uid('MEM'), santriId: 'SAN-001', surah: 'An-Naziat', fromAyah: 1, toAyah: 25, date: daysAgoISO(6), quality: 'Jayyid', note: 'Ulangi ayat 18-25', teacherId: 'U-06' },
    { id: uid('MEM'), santriId: 'SAN-001', surah: 'An-Naziat', fromAyah: 26, toAyah: 46, date: daysAgoISO(2), quality: 'Mumtaz', note: 'Sangat lancar', teacherId: 'U-06' },
    { id: uid('MEM'), santriId: 'SAN-002', surah: 'Abasa', fromAyah: 1, toAyah: 42, date: daysAgoISO(9), quality: 'Jayyid', note: '', teacherId: 'U-06' },
    { id: uid('MEM'), santriId: 'SAN-002', surah: 'At-Takwir', fromAyah: 1, toAyah: 29, date: daysAgoISO(3), quality: 'Jayyid Jiddan', note: '', teacherId: 'U-06' },
    { id: uid('MEM'), santriId: 'SAN-005', surah: 'Al-Mulk', fromAyah: 1, toAyah: 30, date: daysAgoISO(8), quality: 'Mumtaz', note: 'Siap lanjut Al-Qalam', teacherId: 'U-06' },
    { id: uid('MEM'), santriId: 'SAN-004', surah: 'Al-Buruj', fromAyah: 1, toAyah: 12, date: daysAgoISO(4), quality: 'Maqbul', note: 'Perlu murajaah rutin', teacherId: 'U-06' },
  ];

  const violations: Violation[] = [
    { id: uid('VIO'), santriId: 'SAN-003', typeId: 'VT-01', date: daysAgoISO(5), points: 10, officerId: 'U-05', note: 'Terlambat shalat subuh berjamaah', action: 'Teguran lisan', status: 'SELESAI' },
    { id: uid('VIO'), santriId: 'SAN-004', typeId: 'VT-03', date: daysAgoISO(3), points: 15, officerId: 'U-05', note: 'Tidak melaksanakan piket kebersihan kamar', action: 'Piket tambahan 2 hari', status: 'DITINDAK' },
    { id: uid('VIO'), santriId: 'SAN-002', typeId: 'VT-02', date: daysAgoISO(1), points: 5, officerId: 'U-06', note: 'Ramai saat jam pelajaran berlangsung', action: 'Peringatan', status: 'TERCATAT' },
  ];

  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  santriSpec.filter((s) => !s.cuti).forEach((s, i) => {
    const julId = uid('INV');
    invoices.push({ id: julId, number: `PPD-2026-07-${String(101 + i)}`, santriId: s.id, type: 'SPP', label: 'SPP Juli 2026', amount: 350_000, paidAmount: 350_000, dueDate: daysAgoISO(35), period: 'Juli 2026', status: 'PAID', createdAt: daysAgoISO(45) });
    payments.push({ id: uid('PAY'), invoiceId: julId, santriId: s.id, amount: 350_000, method: 'TRANSFER', note: 'Transfer BCA', userId: 'U-03', idemKey: uuid(), createdAt: daysAgoISO(38) });
    invoices.push({ id: uid('INV'), number: `PPD-2026-08-${String(101 + i)}`, santriId: s.id, type: 'SPP', label: 'SPP Agustus 2026', amount: 350_000, paidAmount: 0, dueDate: daysAgoISO(-12), period: 'Agustus 2026', status: 'UNPAID', createdAt: daysAgoISO(16) });
    invoices.push({ id: uid('INV'), number: `PPD-2026-08B${String(101 + i)}`, santriId: s.id, type: 'ASRAMA', label: 'Asrama Agustus 2026', amount: 250_000, paidAmount: 0, dueDate: daysAgoISO(-12), period: 'Agustus 2026', status: 'UNPAID', createdAt: daysAgoISO(16) });
    const mId = uid('INV');
    const paid = i % 2 === 0 ? 150_000 : 0;
    invoices.push({ id: mId, number: `PPD-2026-08C${String(101 + i)}`, santriId: s.id, type: 'MAKAN', label: 'Uang Makan Agustus 2026', amount: 300_000, paidAmount: paid, dueDate: daysAgoISO(-12), period: 'Agustus 2026', status: paid ? 'PARTIAL' : 'UNPAID', createdAt: daysAgoISO(16) });
    if (paid) payments.push({ id: uid('PAY'), invoiceId: mId, santriId: s.id, amount: paid, method: 'CASH', note: 'Tunai di kantor', userId: 'U-03', idemKey: uuid(), createdAt: daysAgoISO(9) });
  });

  const laundryOrders: LaundryOrder[] = [
    { id: uid('LND'), number: 'LDR-0091', santriId: 'SAN-001', serviceId: 'LS-01', weightKg: 3.2, priceKg: 6000, total: 19_200, status: 'READY', method: 'SALDO_NFC', paidAt: daysAgoISO(2, 10), createdAt: daysAgoISO(3, 9) },
    { id: uid('LND'), number: 'LDR-0092', santriId: 'SAN-002', serviceId: 'LS-02', weightKg: 2.4, priceKg: 10_000, total: 24_000, status: 'WASHING', createdAt: daysAgoISO(1, 8) },
    { id: uid('LND'), number: 'LDR-0093', santriId: 'SAN-005', serviceId: 'LS-01', weightKg: 4.0, priceKg: 6000, total: 24_000, status: 'COMPLETED', method: 'CASH', paidAt: daysAgoISO(5, 15), createdAt: daysAgoISO(7, 9) },
  ];

  const books: Book[] = [
    { id: 'BK-01', title: 'Sirah Nabawiyah', author: 'Syaikh Shafiyurrahman', category: 'Diniyah', isbn: '978-602-111-01', copies: 6, available: 5, color: '#17835a' },
    { id: 'BK-02', title: 'Tafsir Juz Amma', author: 'Ust. Salim Bahreisy', category: 'Al-Quran', isbn: '978-602-111-02', copies: 8, available: 8, color: '#dba63e' },
    { id: 'BK-03', title: 'Matematika Kelas VIII', author: 'Kemendikbud', category: 'Umum', isbn: '978-602-111-03', copies: 30, available: 27, color: '#2c6fb0' },
    { id: 'BK-04', title: 'Kamus Al-Munawwir', author: 'KH. A. Warson Munawwir', category: 'Bahasa Arab', isbn: '978-602-111-04', copies: 4, available: 4, color: '#8b5cf6' },
    { id: 'BK-05', title: 'Fiqih Sunnah Jilid 1', author: 'Sayyid Sabiq', category: 'Diniyah', isbn: '978-602-111-05', copies: 5, available: 5, color: '#c24545' },
    { id: 'BK-06', title: 'IPA Terpadu Kelas VIII', author: 'Kemendikbud', category: 'Umum', isbn: '978-602-111-06', copies: 30, available: 29, color: '#a26a10' },
    { id: 'BK-07', title: 'Bulughul Maram', author: 'Ibnu Hajar Al-Asqalani', category: 'Hadits', isbn: '978-602-111-07', copies: 6, available: 6, color: '#0e2b54' },
    { id: 'BK-08', title: 'Nahwu Wadhih', author: 'Ali Al-Jarim', category: 'Bahasa Arab', isbn: '978-602-111-08', copies: 10, available: 10, color: '#17835a' },
  ];
  const loans: Loan[] = [
    { id: uid('LON'), bookId: 'BK-01', santriId: 'SAN-002', loanDate: daysAgoISO(4), dueDate: daysAgoISO(-7), fine: 0, finePaid: false, status: 'DIPINJAM' },
    { id: uid('LON'), bookId: 'BK-03', santriId: 'SAN-003', loanDate: daysAgoISO(12), dueDate: daysAgoISO(5), fine: 1500, finePaid: false, status: 'DIPINJAM' },
    { id: uid('LON'), bookId: 'BK-07', santriId: 'SAN-001', loanDate: daysAgoISO(15), dueDate: daysAgoISO(8), returnDate: daysAgoISO(9), fine: 0, finePaid: true, status: 'KEMBALI' },
  ];

  const audits: AuditLog[] = [
    { id: uid('AUD'), userId: 'U-02', userName: 'Ust. Salman Al-Farisi', role: 'ADMIN', action: 'CARD_ISSUE', entity: 'nfc_cards', entityId: 'CRD-SAN-005', details: 'Kartu NFC-0005 dipasangkan ke Fatimah Azzahra', createdAt: daysAgoISO(3, 9) },
    { id: uid('AUD'), userId: 'U-03', userName: 'Ustdz. Rahmawati', role: 'BENDAHARA', action: 'TOP_UP', entity: 'wallet_transactions', entityId: walletTxs[walletTxs.length - 2]?.id ?? '', details: 'Top up Rp50.000 untuk Ali Akbar', createdAt: daysAgoISO(4, 10) },
    { id: uid('AUD'), userId: 'U-01', userName: 'H. Zainal Arifin', role: 'SUPER_ADMIN', action: 'LOGIN', entity: 'users', entityId: 'U-01', details: 'Login berhasil', createdAt: daysAgoISO(1, 7) },
  ];

  const notifs: Notif[] = [
    { id: uid('NTF'), userId: 'U-09', title: 'Tagihan baru diterbitkan', body: 'SPP Agustus 2026 untuk Ahmad Fauzan — Rp350.000, jatuh tempo 12 hari lagi.', channel: 'inapp', read: false, refType: 'INVOICE', createdAt: daysAgoISO(2, 8) },
    { id: uid('NTF'), userId: 'U-09', title: 'Setoran hafalan baru', body: 'Ahmad Fauzan menyetorkan An-Naziat 26-46 dengan predikat Mumtaz.', channel: 'whatsapp', read: false, refType: 'MEMORIZE', createdAt: daysAgoISO(2, 11) },
  ];

  return {
    version: SEED_VERSION,
    settings: {
      pesantren: 'Pondok Pesantren Demo', address: 'Jl. Pesantren Raya No. 1, Kediri, Jawa Timur',
      phone: '(0354) 555-0123', termYear: '2026/2027', term: 'Ganjil', waProvider: 'Wablas (terhubung via service)', nfcCooldownMs: 2500,
    },
    sessionUserId: null,
    users, santri: santriList,
    wali: [
      { id: 'WL-01', name: 'H. Abdullah', phone: '0812-3456-7890', email: 'abdullah@mail.com', address: 'Jl. Melati 12, Kediri', userId: 'U-09' },
      { id: 'WL-02', name: 'Bpk. Ridwan Sr.', phone: '0813-1111-2222', address: 'Jl. Kenanga 3, Malang' },
      { id: 'WL-03', name: 'Ibu Khotijah', phone: '0815-3333-4444', address: 'Jl. Mangga 8, Surabaya' },
    ],
    waliSantri: [
      { waliId: 'WL-01', santriId: 'SAN-001', relation: 'Ayah' },
      { waliId: 'WL-01', santriId: 'SAN-004', relation: 'Ayah' },
      { waliId: 'WL-02', santriId: 'SAN-002', relation: 'Ayah' },
      { waliId: 'WL-03', santriId: 'SAN-003', relation: 'Ibu' },
    ],
    kelas: [
      { id: 'KLS-01', name: 'VII A', level: 7, teacherId: 'U-06' },
      { id: 'KLS-02', name: 'VIII A', level: 8, teacherId: 'U-06' },
      { id: 'KLS-03', name: 'IX A', level: 9, teacherId: 'U-08' },
    ],
    asrama: [
      { id: 'ASM-01', name: 'Al-Fath (Putra)', gender: 'L' },
      { id: 'ASM-02', name: 'An-Nur (Putri)', gender: 'P' },
    ],
    kamar: [
      { id: 'KMR-A01', asramaId: 'ASM-01', name: 'A-01', capacity: 6 },
      { id: 'KMR-A02', asramaId: 'ASM-01', name: 'A-02', capacity: 6 },
      { id: 'KMR-B01', asramaId: 'ASM-01', name: 'B-01', capacity: 6 },
      { id: 'KMR-C01', asramaId: 'ASM-02', name: 'C-01', capacity: 6 },
    ],
    cards, wallets, walletTxs,
    categories: [
      { id: 'CAT-1', name: 'Makanan', color: '#a26a10' },
      { id: 'CAT-2', name: 'Minuman', color: '#2c6fb0' },
      { id: 'CAT-3', name: 'ATK', color: '#17835a' },
      { id: 'CAT-4', name: 'Kebersihan', color: '#8b5cf6' },
      { id: 'CAT-5', name: 'Menu Kantin', color: '#c24545' },
    ],
    products,
    outlets: [
      { id: 'OUT-01', name: 'Koperasi Al-Barokah', code: 'KPR', kind: 'retail', active: true },
      { id: 'OUT-02', name: 'Kantin Sehat', code: 'KNT', kind: 'food', active: true },
      { id: 'OUT-03', name: 'Laundry Santri', code: 'LDR', kind: 'service', active: true },
      { id: 'OUT-04', name: 'Perpustakaan', code: 'PRP', kind: 'service', active: true },
    ],
    outletUsers: [
      { outletId: 'OUT-01', userId: 'U-04' },
      { outletId: 'OUT-02', userId: 'U-10' },
      { outletId: 'OUT-03', userId: 'U-07' },
      { outletId: 'OUT-04', userId: 'U-08' },
    ],
    sales, saleItems, inventoryTxs,
    laundryServices: [
      { id: 'LS-01', name: 'Reguler (3 hari)', priceKg: 6000, duration: '3 hari' },
      { id: 'LS-02', name: 'Kilat (1 hari)', priceKg: 10000, duration: '1 hari' },
      { id: 'LS-03', name: 'Setrika Saja', priceKg: 4000, duration: '2 hari' },
    ],
    laundryOrders, books, loans, sessions, attendance,
    subjects: [
      { id: 'SUB-01', code: 'MTK', name: 'Matematika', kelasId: 'KLS-02', teacherId: 'U-06' },
      { id: 'SUB-02', code: 'ARB', name: 'Bahasa Arab', kelasId: 'KLS-02', teacherId: 'U-06' },
      { id: 'SUB-03', code: 'FQH', name: 'Fiqih', kelasId: 'KLS-02', teacherId: 'U-06' },
      { id: 'SUB-04', code: 'QUR', name: 'Al-Quran Hadits', kelasId: 'KLS-01', teacherId: 'U-06' },
      { id: 'SUB-05', code: 'IPA', name: 'IPA Terpadu', kelasId: 'KLS-03', teacherId: 'U-08' },
    ],
    grades,
    memTargets: [
      { id: 'MT-01', kelasId: 'KLS-02', juz: 30, label: 'Juz 30 — An-Naba s.d. An-Nas' },
      { id: 'MT-02', kelasId: 'KLS-01', juz: 30, label: 'Juz 30 — surah pendek' },
      { id: 'MT-03', kelasId: 'KLS-03', juz: 29, label: 'Juz 29 — Al-Mulk s.d. Al-Mursalat' },
    ],
    memRecords,
    violationTypes: [
      { id: 'VT-01', name: 'Terlambat shalat berjamaah', points: 10, category: 'Ibadah' },
      { id: 'VT-02', name: 'Ramai di kelas / KBM', points: 5, category: 'Akademik' },
      { id: 'VT-03', name: 'Tidak piket kebersihan', points: 15, category: 'Kedisiplinan' },
      { id: 'VT-04', name: 'Keluar pondok tanpa izin', points: 40, category: 'Berat' },
      { id: 'VT-05', name: 'Membawa HP', points: 30, category: 'Berat' },
      { id: 'VT-06', name: 'Bullying / berkelahi', points: 50, category: 'Berat' },
    ],
    violations, invoices, payments, notifs, audits,
  };
}
