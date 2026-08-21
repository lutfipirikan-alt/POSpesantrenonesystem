# Aplikasi Android Native — Pesantren One System

Aplikasi ini dibungkus menjadi **APK Android asli** memakai [Capacitor](https://capacitorjs.com):
seluruh antarmuka & logika bisnis tetap sama, namun NFC berjalan lewat **plugin native Kotlin**
(`native/android/NfcReaderPlugin.kt`) sehingga HP dapat:

- ✅ membaca **UID semua kartu 13,56 MHz** — MIFARE Classic, NTAG, DESFire, kartu pelajar pada umumnya
- ✅ **menulis kartu** (stiker NTAG kosong) berisi identitas santri
- ✅ berjalan offline & tampil fullscreen seperti aplikasi biasa

> Browser (termasuk Chrome Android) **tidak akan pernah** bisa membaca UID MIFARE Classic —
> hanya aplikasi native. Itulah mengapa plugin ini ada.

## Prasyarat (di komputer Anda)

1. **Node.js LTS** — [nodejs.org](https://nodejs.org)
2. **Android Studio** (Hedgehog atau lebih baru) — [developer.android.com/studio](https://developer.android.com/studio)
   - Saat pertama dibuka, biarkan menginstal *Android SDK* & *platform-tools*
3. **JDK 17** (biasanya sudah sepaket: Android Studio → Settings → Build Tools → Gradle → Gradle JDK)

## Langkah build

```bash
# 1) masuk folder project
cd pesantren-one-system

# 2) pasang dependensi & build web
npm install
npm run build

# 3) buat project Android (sekali saja)
npx cap add android

# 4) sinkronkan hasil build web ke project Android
npx cap sync android
```

### 5) Pasang plugin NFC native

Salin file plugin ke project Android:

```bash
copy native\android\NfcReaderPlugin.kt android\app\src\main\java\com\pesantren\onesystem\
```

*(jika folder `com\pesantren\onesystem` belum ada, buat dulu. Di Mac/Linux: `cp` dan `/`.)*

### 6) Daftarkan plugin di MainActivity

Buka `android/app/src/main/java/com/pesantren/onesystem/MainActivity.kt`, ganti isinya:

```kotlin
package com.pesantren.onesystem

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NfcReaderPlugin::class.java)   // ← satu baris ini
        super.onCreate(savedInstanceState)
    }
}
```

### 7) Izin NFC di AndroidManifest

Buka `android/app/src/main/AndroidManifest.xml`:

- sebelum `<application>`, tambahkan:

```xml
<uses-permission android:name="android.permission.NFC" />
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

- di dalam `<activity android:name=".MainActivity" …>`, tambahkan:

```xml
<intent-filter>
    <action android:name="android.nfc.action.NDEF_DISCOVERED" />
    <action android:name="android.nfc.action.TECH_DISCOVERED" />
    <action android:name="android.nfc.action.TAG_DISCOVERED" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:scheme="https" android:host="pesantren.one" />
</intent-filter>
```

### 8) Build & pasang ke HP

```bash
npx cap open android
```

Android Studio terbuka. Pilih:

- **Run langsung**: colok HP (aktifkan *USB debugging* di Opsi Pengembang) → tombol ▶ Run 'app'
- **Buat APK**: menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)** →
  file di `android/app/build/outputs/apk/debug/app-debug.apk` → kirim ke HP → instal
  *(izinkan "instal dari sumber tidak dikenal")*

## Memakai NFC di HP

1. Buka aplikasi, pastikan **NFC HP menyala** (quick settings)
2. Dock kanan bawah kini bertanda **NFC · Native**
3. Tempel kartu ke punggung HP → UID terbaca → POS / top up / absensi langsung mengenali santri
4. **Membuat kartu baru**: dock → pilih santri → *Tulis Kartu* → tempel stiker NTAG kosong
5. Kartu yang belum terdaftar di sistem akan **ditolak** — daftarkan lewat menu *Kartu NFC*
   (Pasangkan Kartu → kartu menempel → UID otomatis terisi dari pembacaan HP)

## Mode pengembangan (opsional)

Agar APK mengambil halaman dari server lokal komputer (live reload):

1. `npm run preview -- --host --port 4173`
2. Edit `capacitor.config.ts` → aktifkan `url: 'http://IP-KOMPUTER:4173'` dan `cleartext: true`
3. `npx cap sync android` → Run ulang

## Rilis ke Play Store (kelak)

Build **release AAB** (Build → Generate Signed App Bundle) dengan keystore Anda,
lalu unggah ke Google Play Console. Kapasitas & arsitektur sudah production-ready;
tinggal mengganti persistensi demo dengan API Supabase/PostgreSQL.

## Batasan teknis yang perlu diketahui

| Kemampuan | Browser (web) | APK (native) |
|---|---|---|
| UID kartu NTAG | ✅ (Chrome Android + HTTPS) | ✅ |
| UID MIFARE Classic (kartu pelajar umum) | ❌ mustahil | ✅ |
| Tulis kartu NTAG | ✅ (HTTPS) | ✅ |
| iPhone | ❌ (Safari menutup NFC) | — (butuh versi iOS) |
| Simpan saldo di kartu | ❌ tidak pernah — saldo selalu di server | ❌ (desain: NFC = identitas) |
