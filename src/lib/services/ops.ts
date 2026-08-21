/* ===== Service operasional: santri, kartu NFC, user, laundry, perpustakaan,
   absensi, akademik, hafalan, pelanggaran, tagihan. ===== */

import type {
  AbsenType, AttendanceSession, Grade, Invoice, LaundryOrder, LaundryStatus,
  Loan, MemRecord, NfcCard, Product, SaleMethod, Santri, User, Violation,
} from '../types';
import { activeCardOf, balanceOf, db, mutate } from '../store';
import { fmtDate, rp, todayISO, uid, uuid } from '../util';
import { audit } from './audit';
import { notify } from './notify';
import { ledgerBalance, postLedger } from './wallet';

const now = () => todayISO();

/* ---------- Santri CRUD ---------- */

export function saveSantri(data: Partial<Santri> & { name: string; nis: string }, actor: User): Santri {
  if (!data.name?.trim() || !data.nis?.trim()) throw new Error('Nama dan NIS wajib diisi.');
  if (db.santri.some((s) => s.nis === data.nis && s.id !== data.id && !s.deletedAt))
    throw new Error(`NIS ${data.nis} sudah digunakan santri lain.`);
  if (data.id) {
    const s = db.santri.find((x) => x.id === data.id);
    if (!s) throw new Error('Santri tidak ditemukan.');
    mutate(() => Object.assign(s, data));
    audit(actor, 'SANTRI_UPDATE', 'santri', s.id, `Data santri ${s.name} diperbarui`);
    return s;
  }
  const s: Santri = {
    id: uid('SAN'), nis: data.nis, nisn: data.nisn, name: data.name, nickname: data.nickname || data.name.split(' ')[0]!,
    gender: data.gender ?? 'L', birthPlace: data.birthPlace ?? '-', birthDate: data.birthDate ?? '2012-01-01',
    address: data.address ?? '-', kelasId: data.kelasId ?? db.kelas[0]!.id, entryYear: data.entryYear ?? new Date().getFullYear(),
    status: data.status ?? 'aktif', kamarId: data.kamarId, color: data.color ?? '#1f4b85', createdAt: now(),
  };
  mutate((d) => d.santri.push(s));
  audit(actor, 'SANTRI_CREATE', 'santri', s.id, `Santri baru: ${s.name} (NIS ${s.nis})`);
  return s;
}

export function softDeleteSantri(id: string, actor: User): void {
  mutate((d) => {
    const s = d.santri.find((x) => x.id === id);
    if (s) {
      s.deletedAt = now();
      s.status = 'nonaktif';
    }
  });
  audit(actor, 'SANTRI_DELETE', 'santri', id, 'Santri dihapus (soft delete — data dipertahankan)');
}

export function importSantri(rows: Array<Record<string, string>>, actor: User): number {
  let count = 0;
  for (const r of rows) {
    if (!r.nama || !r.nis) continue;
    if (db.santri.some((s) => s.nis === r.nis && !s.deletedAt)) continue;
    saveSantri({
      name: r.nama, nis: r.nis, nisn: r.nisn, nickname: r.panggilan,
      gender: (r.jk === 'P' ? 'P' : 'L'), address: r.alamat,
      entryYear: Number(r.tahun_masuk) || new Date().getFullYear(),
    }, actor);
    count++;
  }
  return count;
}

/* ---------- Kartu NFC ---------- */

export function issueCard(santriId: string, uidCard: string, actor: User): NfcCard {
  const UID = uidCard.toUpperCase().trim();
  if (!/^([0-9A-F]{2}:){3,9}[0-9A-F]{2}$/.test(UID))
    throw new Error('Format UID tidak valid. Contoh: 04:A1:B2:C3:D4:E5:F6');
  const santri = db.santri.find((s) => s.id === santriId);
  if (!santri) throw new Error('Santri tidak ditemukan.');
  // UID tidak boleh digunakan kartu aktif lain
  const used = db.cards.find((c) => c.uid === UID && c.status === 'ACTIVE');
  if (used) throw new Error(`UID ${UID} sudah terpasang pada santri ${db.santri.find((s) => s.id === used.santriId)?.name ?? '?'}.`);
  const card: NfcCard = {
    id: uid('CRD'), santriId, uid: UID, cardNumber: `NFC-${String(db.cards.length + 1).padStart(4, '0')}`,
    status: 'ACTIVE', issuedAt: now(), createdAt: now(), updatedAt: now(),
  };
  mutate((d) => {
    // kartu aktif lama santri → REPLACED (histori tidak dihapus)
    const old = activeCardOf(santriId);
    if (old) {
      old.status = 'REPLACED';
      old.deactivatedAt = now();
      old.reason = `Diganti kartu ${card.cardNumber}`;
      old.updatedAt = now();
    }
    d.cards.push(card);
    const s = d.santri.find((x) => x.id === santriId)!;
    s.activeCardId = card.id;
  });
  audit(actor, 'CARD_ISSUE', 'nfc_cards', card.id, `Kartu ${card.cardNumber} (UID ${UID}) dipasangkan ke ${santri.name}`);
  return card;
}

export function blockCard(cardId: string, reason: string, actor: User): NfcCard {
  if (!reason.trim()) throw new Error('Alasan pemblokiran wajib diisi.');
  const card = db.cards.find((c) => c.id === cardId);
  if (!card) throw new Error('Kartu tidak ditemukan.');
  if (card.status !== 'ACTIVE') throw new Error('Hanya kartu ACTIVE yang dapat diblokir.');
  mutate((d) => {
    const c = d.cards.find((x) => x.id === cardId)!;
    c.status = 'BLOCKED';
    c.deactivatedAt = now();
    c.reason = reason;
    c.updatedAt = now();
    const s = d.santri.find((x) => x.activeCardId === cardId);
    if (s) s.activeCardId = undefined;
  });
  audit(actor, 'CARD_BLOCK', 'nfc_cards', cardId, `Kartu ${card.cardNumber} diblokir — ${reason}. Saldo santri TIDAK berubah.`);
  return db.cards.find((c) => c.id === cardId)!;
}

/* ---------- User ---------- */

export function saveUser(data: Partial<User> & { username: string; name: string; role: User['role'] }, actor: User): User {
  if (data.id) {
    const u = db.users.find((x) => x.id === data.id);
    if (!u) throw new Error('User tidak ditemukan.');
    const oldRole = u.role;
    mutate(() => Object.assign(u, data));
    if (oldRole !== data.role)
      audit(actor, 'ROLE_CHANGE', 'users', u.id, `Role ${u.name}: ${oldRole} → ${data.role}`);
    return u;
  }
  if (db.users.some((u) => u.username === data.username)) throw new Error('Username sudah dipakai.');
  const u: User = {
    id: uid('USR'), username: data.username, password: 'demo123', name: data.name,
    role: data.role, outletId: data.outletId, waliId: data.waliId, active: true,
  };
  mutate((d) => d.users.push(u));
  audit(actor, 'USER_CREATE', 'users', u.id, `User baru ${u.username} (${u.role})`);
  return u;
}

/* ---------- Laundry ---------- */

export function createLaundryOrder(santriId: string, serviceId: string, weightKg: number, actor: User): LaundryOrder {
  const svc = db.laundryServices.find((s) => s.id === serviceId);
  if (!svc) throw new Error('Layanan tidak ditemukan.');
  if (!(weightKg > 0)) throw new Error('Berat harus lebih dari 0.');
  const total = Math.round(svc.priceKg * weightKg);
  const order: LaundryOrder = {
    id: uid('LND'), number: `LDR-${String(db.laundryOrders.length + 94).padStart(4, '0')}`,
    santriId, serviceId, weightKg, priceKg: svc.priceKg, total, status: 'RECEIVED', createdAt: now(),
  };
  mutate((d) => d.laundryOrders.unshift(order));
  audit(actor, 'LAUNDRY_CREATE', 'laundry_orders', order.id, `${order.number} — ${weightKg} kg, ${rp(total)}`);
  return order;
}

export function setLaundryStatus(orderId: string, status: LaundryStatus, actor: User): void {
  mutate((d) => {
    const o = d.laundryOrders.find((x) => x.id === orderId);
    if (o) o.status = status;
  });
  const o = db.laundryOrders.find((x) => x.id === orderId);
  audit(actor, 'LAUNDRY_STATUS', 'laundry_orders', orderId, `${o?.number} → ${status}`);
  if (status === 'READY' && o) {
    notify({
      santri: db.santri.find((s) => s.id === o.santriId),
      title: `Laundry ${o.number} siap diambil`,
      body: `Laundry ${o.number} sudah siap. Silakan ambil di unit laundry.`,
      refType: 'LAUNDRY', refId: o.id,
    });
  }
}

export async function payLaundry(orderId: string, method: SaleMethod, actor: User): Promise<LaundryOrder> {
  const o = db.laundryOrders.find((x) => x.id === orderId);
  if (!o) throw new Error('Order tidak ditemukan.');
  if (o.paidAt) throw new Error('Order sudah dibayar.');
  if (method === 'SALDO_NFC') {
    const bal = ledgerBalance(o.santriId);
    if (bal < o.total) throw new Error(`Saldo tidak mencukupi. Saldo ${rp(bal)}, tagihan ${rp(o.total)}.`);
    await postLedger({
      santriId: o.santriId, type: 'LAUNDRY', amount: -o.total, refType: 'LAUNDRY', refId: o.id,
      description: `Pembayaran laundry ${o.number}`, actor, idemKey: `laundry-${o.id}`,
    });
  }
  mutate((d) => {
    const x = d.laundryOrders.find((v) => v.id === orderId)!;
    x.method = method;
    x.paidAt = now();
  });
  audit(actor, 'LAUNDRY_PAY', 'laundry_orders', orderId, `${o.number} dibayar ${method} ${rp(o.total)}`);
  return db.laundryOrders.find((x) => x.id === orderId)!;
}

/* ---------- Perpustakaan ---------- */

const FINE_PER_DAY = 500;

export function createLoan(bookId: string, santriId: string, actor: User): Loan {
  const book = db.books.find((b) => b.id === bookId);
  if (!book) throw new Error('Buku tidak ditemukan.');
  if (book.available < 1) throw new Error('Stok buku habis.');
  const loan: Loan = {
    id: uid('LON'), bookId, santriId, loanDate: now(),
    dueDate: new Date(Date.now() + 7 * 86400_000).toISOString(), fine: 0, finePaid: false, status: 'DIPINJAM',
  };
  mutate((d) => {
    d.loans.unshift(loan);
    d.books.find((b) => b.id === bookId)!.available -= 1;
  });
  audit(actor, 'LOAN_CREATE', 'library_loans', loan.id, `"${book.title}" dipinjam ${db.santri.find((s) => s.id === santriId)?.name}`);
  return loan;
}

export async function returnLoan(loanId: string, actor: User): Promise<Loan> {
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) throw new Error('Peminjaman tidak ditemukan.');
  if (loan.status === 'KEMBALI') throw new Error('Buku sudah dikembalikan.');
  const lateDays = Math.max(0, Math.floor((Date.now() - new Date(loan.dueDate).getTime()) / 86400_000));
  const fine = lateDays * FINE_PER_DAY;
  let finePaid = fine === 0;
  mutate((d) => {
    const l = d.loans.find((x) => x.id === loanId)!;
    l.returnDate = now();
    l.status = 'KEMBALI';
    l.fine = fine;
    d.books.find((b) => b.id === l.bookId)!.available += 1;
  });
  if (fine > 0) {
    const bal = ledgerBalance(loan.santriId);
    if (bal >= fine) {
      await postLedger({
        santriId: loan.santriId, type: 'LIBRARY_FINE', amount: -fine, refType: 'LOAN', refId: loan.id,
        description: `Denda keterlambatan ${lateDays} hari`, actor, idemKey: `fine-${loan.id}`,
      });
      finePaid = true;
    }
    mutate((d) => {
      d.loans.find((x) => x.id === loanId)!.finePaid = finePaid;
    });
  }
  audit(actor, 'LOAN_RETURN', 'library_loans', loanId, `Buku kembali${fine ? ` — denda ${rp(fine)} (${lateDays} hari terlambat)` : ''}`);
  return db.loans.find((l) => l.id === loanId)!;
}

/* ---------- Absensi (sesi berbasis, bukan scan liar) ---------- */

export function openSession(name: string, type: AbsenType, unit: string, durationMin: number, actor: User): AttendanceSession {
  const s: AttendanceSession = {
    id: uid('SES'), name, type, unit,
    startsAt: now(), endsAt: new Date(Date.now() + durationMin * 60_000).toISOString(), createdBy: actor.id,
  };
  mutate((d) => d.sessions.unshift(s));
  audit(actor, 'SESSION_OPEN', 'attendance_sessions', s.id, `Sesi "${name}" dibuka s.d. ${new Date(s.endsAt).toLocaleTimeString('id-ID')}`);
  return s;
}

export function closeSession(sessionId: string, actor: User): void {
  mutate((d) => {
    const s = d.sessions.find((x) => x.id === sessionId);
    if (s) s.closedAt = now();
  });
  audit(actor, 'SESSION_CLOSE', 'attendance_sessions', sessionId, 'Sesi absensi ditutup');
}

export function tapIn(sessionId: string, nfcUid: string, actor: User): { santri: Santri; status: 'HADIR' | 'TERLAMBAT' } {
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Sesi tidak ditemukan.');
  if (session.closedAt) throw new Error('Sesi sudah ditutup.');
  const t = Date.now();
  if (t < new Date(session.startsAt).getTime() || t > new Date(session.endsAt).getTime())
    throw new Error('Sesi tidak dalam periode aktif.');
  const card = db.cards.find((c) => c.uid === nfcUid.toUpperCase().trim() && c.status === 'ACTIVE');
  if (!card) throw new Error('Kartu tidak dikenal atau tidak aktif.');
  const santri = db.santri.find((s) => s.id === card.santriId);
  if (!santri) throw new Error('Santri tidak ditemukan.');
  if (db.attendance.some((a) => a.sessionId === sessionId && a.santriId === santri.id))
    throw new Error(`${santri.nickname} sudah tercatat di sesi ini (duplikat diabaikan).`);
  const status = t - new Date(session.startsAt).getTime() > 10 * 60_000 ? 'TERLAMBAT' : 'HADIR';
  mutate((d) => d.attendance.push({ id: uid('ABS'), sessionId, santriId: santri.id, at: now(), status }));
  audit(actor, 'ATTENDANCE', 'attendance_records', sessionId, `${santri.name} — ${status} (${session.name})`);
  return { santri, status };
}

/* ---------- Akademik & Hafalan ---------- */

export function saveGrade(data: Omit<Grade, 'id' | 'createdAt'>, actor: User): Grade {
  const subject = db.subjects.find((s) => s.id === data.subjectId);
  if (!subject) throw new Error('Mapel tidak ditemukan.');
  // server-side authorization: hanya guru mapel bersangkutan
  if (actor.role === 'GURU' && subject.teacherId !== actor.id)
    throw new Error('Anda bukan guru mata pelajaran ini.');
  if (data.score < 0 || data.score > 100) throw new Error('Nilai harus 0–100.');
  const existing = db.grades.find(
    (g) => g.santriId === data.santriId && g.subjectId === data.subjectId && g.kind === data.kind && g.term === data.term
  );
  if (existing) {
    mutate((d) => {
      const g = d.grades.find((x) => x.id === existing.id)!;
      g.score = data.score;
      g.note = data.note;
    });
    audit(actor, 'GRADE_UPDATE', 'grades', existing.id, `Nilai ${subject.name} ${data.kind} → ${data.score}`);
    return existing;
  }
  const g: Grade = { ...data, id: uid('GRD'), createdAt: now() };
  mutate((d) => d.grades.push(g));
  audit(actor, 'GRADE_CREATE', 'grades', g.id, `${subject.name} ${data.kind} = ${data.score}`);
  return g;
}

export function addMemRecord(data: Omit<MemRecord, 'id'>, actor: User): MemRecord {
  const r: MemRecord = { ...data, id: uid('MEM') };
  mutate((d) => d.memRecords.unshift(r));
  const santri = db.santri.find((s) => s.id === data.santriId);
  audit(actor, 'MEMORIZE', 'memorization_records', r.id, `${santri?.name}: ${data.surah} ${data.fromAyah}-${data.toAyah} (${data.quality})`);
  notify({
    santri,
    title: 'Setoran hafalan baru',
    body: `${santri?.name} menyetorkan ${data.surah} ayat ${data.fromAyah}-${data.toAyah} dengan predikat ${data.quality}.`,
    refType: 'MEMORIZE', refId: r.id,
  });
  return r;
}

/* ---------- Pelanggaran ---------- */

export function addViolation(data: { santriId: string; typeId: string; date: string; note: string; action: string }, actor: User): Violation {
  const type = db.violationTypes.find((t) => t.id === data.typeId);
  if (!type) throw new Error('Jenis pelanggaran tidak ditemukan.');
  const v: Violation = {
    id: uid('VIO'), santriId: data.santriId, typeId: data.typeId, date: data.date,
    points: type.points, officerId: actor.id, note: data.note, action: data.action, status: 'TERCATAT',
  };
  mutate((d) => d.violations.unshift(v));
  const santri = db.santri.find((s) => s.id === data.santriId);
  audit(actor, 'VIOLATION_ADD', 'violations', v.id, `${santri?.name}: ${type.name} (+${type.points} poin)`);
  notify({
    santri,
    title: 'Catatan pelanggaran',
    body: `${santri?.nickname} tercatat: ${type.name} (+${type.points} poin) pada ${fmtDate(data.date)}. Tindakan: ${data.action || '-'}`,
    refType: 'VIOLATION', refId: v.id,
  });
  return v;
}

export function setViolationStatus(id: string, status: Violation['status'], actor: User): void {
  mutate((d) => {
    const v = d.violations.find((x) => x.id === id);
    if (v) v.status = status;
  });
  audit(actor, 'VIOLATION_STATUS', 'violations', id, `Status → ${status}`);
}

/* ---------- Tagihan / Invoice ---------- */

export function createInvoice(data: { santriId: string; type: Invoice['type']; label: string; amount: number; dueDate: string; period: string }, actor: User): Invoice {
  if (!(data.amount > 0)) throw new Error('Nominal tagihan harus > 0.');
  const inv: Invoice = {
    id: uid('INV'), number: `PPD-${new Date().getFullYear()}-${String(db.invoices.length + 201)}`,
    santriId: data.santriId, type: data.type, label: data.label, amount: data.amount, paidAmount: 0,
    dueDate: data.dueDate, period: data.period, status: 'UNPAID', createdAt: now(),
  };
  mutate((d) => d.invoices.unshift(inv));
  const santri = db.santri.find((s) => s.id === data.santriId);
  audit(actor, 'INVOICE_CREATE', 'invoices', inv.id, `${inv.number} — ${data.label} ${rp(data.amount)}`);
  notify({
    santri,
    title: 'Tagihan baru diterbitkan',
    body: `${data.label} untuk ${santri?.name} — ${rp(data.amount)}, jatuh tempo ${fmtDate(data.dueDate)}.`,
    refType: 'INVOICE', refId: inv.id,
  });
  return inv;
}

export async function payInvoice(invoiceId: string, amount: number, method: 'CASH' | 'TRANSFER' | 'SALDO_NFC', actor: User, idemKey?: string): Promise<Invoice> {
  const key = idemKey ?? uuid();
  if (db.payments.some((p) => p.idemKey === key)) throw new Error('Pembayaran sudah diproses (duplikat dicegah).');
  const inv = db.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error('Tagihan tidak ditemukan.');
  if (inv.status === 'CANCELLED') throw new Error('Tagihan dibatalkan.');
  if (!(amount > 0)) throw new Error('Nominal harus > 0.');
  const remaining = inv.amount - inv.paidAmount;
  if (amount > remaining) throw new Error(`Nominal melebihi sisa tagihan (${rp(remaining)}).`);
  mutate((d) => {
    const i = d.invoices.find((x) => x.id === invoiceId)!;
    i.paidAmount += amount;
    i.status = i.paidAmount >= i.amount ? 'PAID' : 'PARTIAL';
    d.payments.unshift({
      id: uid('PAY'), invoiceId, santriId: i.santriId, amount, method,
      note: i.label, userId: actor.id, idemKey: key, createdAt: now(),
    });
  });
  audit(actor, 'PAYMENT', 'payments', invoiceId, `${inv.number} dibayar ${rp(amount)} (${method})`);
  const santri = db.santri.find((s) => s.id === inv.santriId);
  notify({
    santri,
    title: 'Pembayaran diterima',
    body: `${inv.label}: pembayaran ${rp(amount)} via ${method}. Sisa ${rp(inv.amount - inv.paidAmount)}.`,
    refType: 'INVOICE', refId: inv.id,
  });
  return db.invoices.find((i) => i.id === invoiceId)!;
}

export function cancelInvoice(invoiceId: string, actor: User): void {
  mutate((d) => {
    const i = d.invoices.find((x) => x.id === invoiceId);
    if (i && i.paidAmount === 0) i.status = 'CANCELLED';
  });
  audit(actor, 'INVOICE_CANCEL', 'invoices', invoiceId, 'Tagihan dibatalkan');
}

/* ---------- Produk & Inventori ---------- */

export function saveProduct(
  data: {
    id?: string; sku: string; barcode: string; name: string; categoryId: string; outletId: string;
    price: number; cost: number; stock: number; status: 'aktif' | 'nonaktif';
  },
  actor: User
): Product {
  if (!data.name.trim()) throw new Error('Nama produk wajib diisi.');
  if (!(data.price >= 0)) throw new Error('Harga jual tidak valid.');
  if (data.id) {
    const p = db.products.find((x) => x.id === data.id);
    if (!p) throw new Error('Produk tidak ditemukan.');
    const oldPrice = p.price;
    mutate(() => Object.assign(p, data));
    if (oldPrice !== data.price)
      audit(actor, 'PRICE_CHANGE', 'products', p.id, `Harga "${p.name}": ${rp(oldPrice)} → ${rp(data.price)}`);
    else audit(actor, 'PRODUCT_UPDATE', 'products', p.id, `Produk "${p.name}" diperbarui`);
    return p;
  }
  const p: Product = { ...data, id: uid('PRD'), color: '#1f4b85' };
  mutate((d) => d.products.push(p));
  if (p.stock > 0)
    mutate((d) => d.inventoryTxs.unshift({ id: uid('INV'), productId: p.id, type: 'IN', qty: p.stock, note: 'Stok awal produk', userId: actor.id, createdAt: now() }));
  audit(actor, 'PRODUCT_CREATE', 'products', p.id, `Produk baru "${p.name}" @ ${rp(p.price)}`);
  return p;
}

export function stockMove(productId: string, type: 'IN' | 'OUT' | 'ADJUST', qty: number, note: string, actor: User): void {
  const p = db.products.find((x) => x.id === productId);
  if (!p) throw new Error('Produk tidak ditemukan.');
  if (!qty) throw new Error('Qty tidak boleh nol.');
  const delta = type === 'IN' ? Math.abs(qty) : type === 'OUT' ? -Math.abs(qty) : qty;
  if (p.stock + delta < 0) throw new Error(`Stok tidak cukup (tersisa ${p.stock}).`);
  mutate((d) => {
    const prod = d.products.find((x) => x.id === productId)!;
    prod.stock += delta;
    d.inventoryTxs.unshift({ id: uid('INV'), productId, type, qty: delta, note: note || type, userId: actor.id, createdAt: now() });
  });
  audit(actor, 'STOCK_' + type, 'inventory_transactions', productId, `"${p.name}" ${type} ${delta > 0 ? '+' : ''}${delta} → ${p.stock + delta}`);
}

export { balanceOf };
