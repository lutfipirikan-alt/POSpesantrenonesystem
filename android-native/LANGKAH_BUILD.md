# Panduan Build Aplikasi Android Native — Pesantren One System

Panduan ini untuk Anda yang **sudah memasang Android Studio**. Ikuti berurutan.

---

## Ringkasan yang akan Anda dapat

Aplikasi Android **native** (Kotlin + Jetpack Compose + Room), bukan web yang dibungkus:
- Membaca **UID kartu NFC sungguhan** (MIFARE Classic, NTAG, DESFire) lewat `NfcAdapter` Android asli
- Saldo berbasis **ledger** di database Room (atomik, konsisten)
- Fitur: Top Up, POS Kasir, Data Santri, Pasang/Blokir Kartu

---

## PERSIAPAN (sekali saja)

### 1. Siapkan folder project di komputer

Pindahkan folder `android-native` dari project ini ke komputer Anda, misal:

```
C:\Users\user\PesantrenOneNative
```

Di dalamnya harus ada file-file ini (jangan dibuka dari folder parent):

```
PesantrenOneNative/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
└── app/
    ├── build.gradle.kts
    └── src/main/...
```

> **Penting:** yang dibuka di Android Studio adalah folder yang berisi `settings.gradle.kts` (yaitu `PesantrenOneNative`), bukan folder di atasnya.

### 2. Koneksi internet

Build pertama kali akan mengunduh Gradle, Android SDK, dan library (~2–4 GB). Pastikan internet stabil.

### 3. JDK 17

Android Studio modern sudah membawa JDK 17+ (Embedded JDK). Tidak perlu install manual.

---

## LANGKAH DEMI LANGKAH

### Langkah 1 — Buka project

1. Buka **Android Studio**
2. **File → Open…**
3. Pilih folder `PesantrenOneNative` (yang ada `settings.gradle.kts`)
4. Klik **OK** / **Trust Project**

### Langkah 2 — Tunggu Gradle Sync

- Android Studio otomatis menjalankan **Gradle Sync** (lihat progress bar di bawah).
- Pertama kali ini lama (5–30 menit tergantung internet) karena mengunduh semua dependensi.
- Jika muncul dialog **"Install missing SDK"** atau **"Accept licenses"** → klik **Install / Accept**.
- Tunggu sampai muncul pesan: `Gradle sync finished`.

> Jika sync gagal, lihat bagian **Troubleshooting** di bawah.

### Langkah 3 — Siapkan perangkat uji

⚠️ **NFC TIDAK tersedia di emulator.** Untuk menguji NFC Anda **wajib pakai HP Android asli** yang punya NFC.

**Pakai HP asli (disarankan):**
1. Di HP: **Pengaturan → Tentang ponsel** → ketuk **Nomor bentukan (Build number)** 7 kali sampai muncul "Anda sekarang pengembang"
2. **Pengaturan → Opsi pengembang (Developer options)** → aktifkan **USB debugging**
3. Sambungkan HP ke komputer dengan kabel USB
4. Di HP, izinkan prompt **"Izinkan USB debugging?"** (centang "Selalu izinkan")
5. Di Android Studio, HP Anda akan muncul di **device selector** (toolbar atas)

**Pakai emulator (hanya untuk lihat UI, NFC tidak jalan):**
1. **Tools → Device Manager → Create device**
2. Pilih device (mis. Pixel 7) → pilih system image API 35 → Finish
3. Jalankan emulator

### Langkah 4 — Jalankan aplikasi

1. Pilih perangkat (HP Anda) di **device selector** di toolbar atas
2. Klik tombol **Run ▶** (segitiga hijau) atau tekan `Shift + F10`
3. Tunggu build + install selesai
4. Aplikasi **Pesantren One** terbuka di HP Anda

### Langkah 5 — Uji NFC

1. Pastikan **NFC HP menyala** (Settings → Connected devices → NFC, atau quick settings)
2. Buka aplikasi → menu **Kartu NFC** → mode **Pasangkan**
3. Pilih santri → **tempelkan kartu ke punggung HP**
4. UID kartu terbaca dan terpasang ke santri
5. Coba **Top Up**: tempel kartu → isi nominal → saldo bertambah (tercatat di ledger)
6. Coba **POS**: scan kartu, tambah produk, bayar dengan saldo

### Langkah 6 — Build file APK (untuk dibagikan/diinstal manual)

1. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
2. Tunggu selesai, klik notifikasi **"locate"** atau buka:
   ```
   app/build/outputs/apk/debug/app-debug.apk
   ```
3. File `app-debug.apk` bisa dipindah ke HP lalu diinstal (izinkan "instal dari sumber tidak dikenal")

> Untuk APK rilis (signed): **Build → Generate Signed App Bundle / APK**, lalu buat keystore.

---

## TROUBLESHOOTING

| Masalah | Solusi |
|---|---|
| **Gradle sync gagal / timeout** | Cek internet. Lalu **File → Sync Project with Gradle Files**. Bisa juga File → Invalidate Caches / Restart |
| **"SDK location not found"** | File → Settings → Appearance & Behavior → System Settings → **Android SDK** → pastikan SDK path terisi |
| **"Failed to find target android-35"** | Buka **SDK Manager** (ikon di toolbar) → tab **SDK Platforms** → centang **Android 15 (API 35)** → Apply |
| **License belum diterima** | Buka terminal di Android Studio, jalankan: `sdkmanager --licenses` lalu tekan `y` berulang |
| **JDK tidak cocok** | File → Settings → Build, Execution, Deployment → Build Tools → Gradle → **Gradle JDK** → pilih **Embedded JDK** (17+) |
| **HP tidak terdeteksi** | Ganti mode USB di HP jadi **File Transfer (MTP)**, pastikan USB debugging aktif, coba kabel/port lain |
| **NFC tidak membaca kartu** | Pastikan NFC HP menyala. Tempel kartu di area NFC (biasanya punggung atas/tengah). Lepaskan casing tebal |
| **Emulator tidak ada NFC** | Memang tidak didukung. Gunakan HP asli untuk NFC |

---

## Jika ingin mengembangkan lebih lanjut

Struktur kode sengaja dipisah agar mudah diperluas:

```
data/Database.kt   → tambah @Entity & @Dao untuk tabel baru
data/Seed.kt       → tambah aturan bisnis di object Repo
nfc/NfcManager.kt  → logika NFC (jarang perlu diubah)
ui/*.kt            → tambah layar Compose, daftarkan di MainActivity
```

Pola menambah modul baru (mis. Laundry):
1. Tambah `@Entity` + `@Dao` di `Database.kt`, naikkan `version` database
2. Tambah fungsi bisnis di `Repo`
3. Buat `LaundryScreen.kt` di `ui/`
4. Daftarkan rute di `MainActivity` + tombol menu di `HomeScreen`
