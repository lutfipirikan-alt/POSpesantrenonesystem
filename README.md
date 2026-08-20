# Pesantren One System

Sistem manajemen pesantren terpadu: **satu akun & satu kartu NFC per santri**, dengan saldo tersimpan di server (ledger), multi-outlet (koperasi, kantin, laundry, perpustakaan), RBAC 9 role, audit trail, dan portal wali santri.

> **Catatan environment**: repositori ini berjalan di stack **React + Vite + Tailwind CSS** (SPA statis). Arsitektur yang diminta (Next.js App Router + Supabase + PostgreSQL) dipetakan ke struktur yang setara dan siap migrasi: seluruh logika bisnis terpusat di **service layer** (`src/lib/services/*`) yang berperan sebagai "server" — validasi saldo/harga/role dilakukan di sana, bukan di UI. Persistensi memakai localStorage sebagai pengganti PostgreSQL agar demo dapat dijalankan tanpa backend; schema relasional lengkap tercermin di `src/lib/types.ts`.

## Prinsip yang diimplementasikan

| Prinsip | Implementasi |
|---|---|
| NFC = identitas, bukan penyimpan saldo | `services/nfc.ts` hanya memetakan UID → santri; saldo selalu dibaca dari ledger |
| Ledger, bukan saldo bebas edit | `services/wallet.ts` — setiap mutasi = 1 baris `wallet_transactions` (before/after) |
| Anti transaksi ganda | Idempotency key unik per transaksi + cooldown/debounce pembacaan kartu (`settings.nfcCooldownMs`) |
| Locking & konsistensi saldo | Mutex per santri (`withLock`) mensimulasikan `SELECT … FOR UPDATE`; uji konkurensi tersedia |
| Validasi server-side | Harga & total dihitung dari katalog di service; saldo divalidasi ulang saat checkout |
| Audit trail append-only | `services/audit.ts` — login, CRUD santri, kartu, top up, transaksi, refund, adjustment, perubahan role/harga/stok |
| RBAC | 9 role + matriks permission (lihat halaman *Pengguna & Role*); guard di router + service |
| Histori kartu tak terhapus | Blokir/ganti kartu mengubah status (BLOCKED/LOST/REPLACED), baris lama tetap |

## Menjalankan secara lokal

```bash
npm install
npm run dev      # development server → http://localhost:5173
npm run build    # build produksi → dist/
```

Login dengan salah satu **akun demo** (password: `demo123`):

| Username | Role |
|---|---|
| `superadmin` | Super Admin |
| `admin` | Admin Pesantren |
| `bendahara` | Bendahara |
| `kasir` / `kasir2` | Kasir Koperasi / Kantin |
| `pengurus` | Pengurus Asrama |
| `guru` | Guru (Ust. Karim — mapel VIII A) |
| `laundry` | Petugas Laundry |
| `perpus` | Petugas Perpustakaan |
| `wali` | Wali Santri (H. Abdullah — anak: Ahmad & Hasan) |

## Uji tanpa hardware NFC

Klik **NFC Simulator** (kanan bawah) → pilih santri → **Tempel**, atau ketik UID manual (mis. `04:A1:B2:C3:D4:E5:F6`). Event UID disiarkan ke halaman aktif (POS, top up, absensi, laundry, perpustakaan, pemasangan kartu). Bacaan duplikat dalam jendela cooldown otomatis diabaikan.

## Uji otomatis

Buka **Uji Sistem** (menu Sistem) — 11 skenario dijalankan terhadap service layer sungguhan:

- Top up → ledger & saldo benar
- Idempotency key duplikat → diproses sekali
- Saldo tidak mencukupi → ditolak total (tanpa pemotongan parsial/ledger)
- 10 top up paralel → saldo konsisten (lock)
- Kartu diblokir / UID duplikat → ditolak
- 3 tap NFC cepat → 1 event (debounce)
- Checkout: harga dari katalog, saldo terpotong tepat
- Checkout gagal → atomik (tanpa sale/ledger)
- Refund: saldo & stok pulih, double-refund ditolak

Data demo dipulihkan otomatis setelah uji.

## Struktur

```
src/
  lib/
    types.ts            # schema relasional (users, santri, nfc_cards, wallets, wallet_transactions, products, sales, …)
    seed.ts             # seed demo + riwayat 14 hari (ledger konsisten dengan saldo akhir)
    store.ts            # persistensi + reaktivitas + helper relasional
    tests.ts            # test suite (wallet, concurrency, NFC, POS, refund)
    services/
      auth.ts           # login, RBAC, permission per role
      nfc.ts            # interface NfcReader, MockNfcReader, kerangka WebUsbNfcReader, resolveCard
      wallet.ts         # ledger: postLedger (mutex + idempotency + validasi saldo)
      pos.ts            # checkout (harga server-side, atomik), refundSale
      ops.ts            # santri, kartu, user, laundry, perpustakaan, absensi, akademik, hafalan, pelanggaran, tagihan, produk/stok
      notify.ts         # NotificationChannel (InApp + WhatsApp provider-agnostic), template pesan
      audit.ts          # audit trail append-only
      reports.ts        # agregasi laporan
  components/           # design system, ikon SVG, grafik SVG, shell + NFC dock
  pages/                # Dashboard, Santri, Cards, Finance (topup/ledger/tagihan), POS, Catalog, Laundry, Library, School, Wali, Admin
```

## Batasan & jalan migrasi

- **NFC hardware**: `WebUsbNfcReader` adalah kerangka (device CCID/PCSC seperti ACS ACR122U butuh driver WebUSB yang belum diverifikasi tanpa perangkat). Gunakan Mock Mode untuk pengujian; implementasi produksi tinggal menggantikan kelas reader tanpa menyentuh logika bisnis.
- **Database**: ganti persistensi `store.ts` dengan Supabase/PostgreSQL + RLS; service layer sudah memusatkan seluruh aturan bisnis.
- **WhatsApp**: implementasikan interface `NotificationChannel` untuk provider pilihan (Wablas/Fonnte/Twilio) via env var — tanpa mengubah pemanggil.
