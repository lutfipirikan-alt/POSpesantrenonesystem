# Pesantren One System — Aplikasi Android NATIVE

Aplikasi Android **asli** (Kotlin + Jetpack Compose + Room + NfcAdapter). **Bukan** WebView / bukan web yang dibungkus.
NFC dibaca langsung oleh sistem Android, sehingga **UID semua kartu 13,56 MHz terbaca** — termasuk **MIFARE Classic**
(kartu pelajar pada umumnya) yang tidak mungkin dibaca browser.

## Fitur inti (native)

| Modul | Keterangan |
|---|---|
| NFC | Baca UID MIFARE/NTAG/DESFire, tulis kartu NTAG (NDEF) |
| Santri | Daftar santri + saldo masing-masing |
| Kartu | Pasangkan kartu ke santri, blokir kartu |
| Saldo | Ledger (before/after), saldo dihitung dari ledger — tidak bisa diedit bebas |
| Top Up | Scan kartu → nominal → tercatat di ledger |
| POS | Keranjang, bayar dengan saldo NFC / tunai, stok berkurang |

> Port modul lengkap (laundry, perpustakaan, akademik, dll.) mengikuti pola yang sama:
> tambah `@Entity` + `@Dao` di `data/`, tambah logika di `Repo`, tambah layar Compose.

## Prasyarat

1. **Android Studio** (Hedgehog / Ladybug atau lebih baru) — https://developer.android.com/studio
2. **JDK 17** (biasanya sudah ter-bundle di Android Studio)
3. Android SDK 35 (diunduh otomatis oleh Android Studio)

## Langkah build

1. Buka **Android Studio** → **Open** → pilih folder `android-native/` ini.
2. Tunggu **Gradle sync** selesai (unduh dependensi, bisa beberapa menit pertama kali).
   - Jika diminta membuat Gradle Wrapper, izinkan.
3. Sambungkan HP Android (USB debugging aktif) atau jalankan Emulator **dengan NFC**.
4. Klik **Run ▶** (atau `Shift+F10`). APK terpasang di HP.

> Build APK manual: menu **Build → Build App Bundle(s)/APK(s) → Build APK(s)**,
> hasilnya di `app/build/outputs/apk/debug/app-debug.apk`.

## Cara pakai NFC di HP

1. Pastikan **NFC HP menyala** (Settings → Connected devices → NFC).
2. Buka aplikasi.
3. Di menu **Kartu NFC**: pilih santri → pilih mode **Pasangkan** → tempel kartu → UID terbaca & terikat.
   - Kartu NTAG kosong juga bisa **ditulis** identitas santri.
4. Di **Top Up** / **POS**: tempel kartu → santri dikenali → proses.
5. Saldo **tidak hilang** saat kartu diganti — saldo ada di ledger, kartu hanya identitas.

## Arsitektur

```
app/src/main/java/com/pesantren/onesystem/
  PesantrenApp.kt        # Application + singleton Room DB + seed
  MainActivity.kt        # Navigasi Compose + foreground-dispatch NFC
  data/
    Database.kt          # @Entity, @Dao, @Database (Room)
    Seed.kt              # Repo: ledger, pair/block kartu, checkout (transaksi atomik)
  nfc/
    NfcManager.kt        # NfcAdapter asli: baca UID + tulis NDEF + event bus
  ui/
    theme/Theme.kt       # Material 3 (navy + gold)
    Components.kt        # StatCard, Avatar, SantriRow, format Rupiah
    Screens.kt           # Home, Santri, Kartu
    FinanceScreens.kt    # TopUp, POS
```

## Prinsip keamanan yang dipertahankan

- Saldo selalu dihitung dari **ledger** (`balanceAfter` baris terakhir), bukan field bebas.
- Semua operasi finansial dijalankan dalam **transaksi Room** (`withTransaction`) — atomik.
- Validasi saldo & penolakan kartu tidak aktif dilakukan di `Repo` (bukan di UI).
- UID yang sudah aktif dipakai santri lain **ditolak** saat pemasangan.

## Catatan

- `minSdk = 26` (Android 8.0) agar adaptive-icon & API modern aman.
- Untuk rilis ke Play Store, buat signing key & naikkan `versionCode`.
- Data demo (5 santri, 2 kartu, 4 produk, saldo awal) dibuat otomatis saat pertama dibuka.
