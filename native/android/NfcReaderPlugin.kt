package com.pesantren.onesystem

/*
 * NfcReaderPlugin — jembatan NFC native untuk Pesantren One System (Capacitor).
 *
 * Kemampuan (yang TIDAK mungkin dilakukan browser):
 *  - Membaca UID SEMUA kartu 13,56 MHz: MIFARE Classic, NTAG, DESFire, ISO-DEP…
 *  - Menulis NDEF (identitas santri) ke kartu NTAG kosong
 *  - Event "cardDetected" { uid, tech } dikirim ke aplikasi web di WebView
 *
 * Instalasi (lihat NATIVE_ANDROID.md):
 *  1. npx cap add android
 *  2. Salin file ini ke android/app/src/main/java/com/pesantren/onesystem/
 *  3. Daftarkan di MainActivity: registerPlugin(NfcReaderPlugin::class.java)
 *  4. Tambahkan permission NFC di AndroidManifest.xml
 */

import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NfcReader")
class NfcReaderPlugin : Plugin() {

    private var adapter: NfcAdapter? = null
    private var scanning = false
    private var pendingWrite: String? = null

    override fun load() {
        adapter = NfcAdapter.getDefaultAdapter(context)
    }

    /* ---------- API untuk aplikasi web ---------- */

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", adapter != null)
        ret.put("enabled", adapter?.isEnabled == true)
        call.resolve(ret)
    }

    @PluginMethod
    fun startScan(call: PluginCall) {
        val a = adapter
        if (a == null) {
            call.reject("Perangkat ini tidak memiliki chip NFC.")
            return
        }
        if (!a.isEnabled) {
            // Bantu user: buka pengaturan NFC
            activity?.startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
            call.reject("NFC belum aktif — nyalakan di pengaturan Android, lalu buka lagi aplikasinya.")
            return
        }
        scanning = true
        enableForegroundDispatch()
        call.resolve()
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        scanning = false
        pendingWrite = null
        disableForegroundDispatch()
        call.resolve()
    }

    /** Menulis identitas (URL pos1s) ke kartu NTAG yang ditempelkan berikutnya. */
    @PluginMethod
    fun writeCard(call: PluginCall) {
        val text = call.getString("text")
        if (text.isNullOrBlank()) {
            call.reject("Isi kartu kosong.")
            return
        }
        pendingWrite = text
        scanning = true
        enableForegroundDispatch()
        val ret = JSObject()
        ret.put("queued", true)
        call.resolve(ret)
    }

    /* ---------- Penerimaan tag dari Android ---------- */

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        if (!scanning && pendingWrite == null) return

        val tag: Tag = if (android.os.Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java) ?: return
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG) ?: return
        }

        val uid = tag.id.joinToString(":") { String.format("%02X", it) }
        val tech = tag.techList.firstOrNull {
            it.contains("Mifare") || it.contains("NfcA") || it.contains("NfcB") ||
                it.contains("NfcF") || it.contains("NfcV") || it.contains("IsoDep")
        } ?: (tag.techList.firstOrNull() ?: "unknown")

        // Mode tulis kartu
        pendingWrite?.let { text ->
            val ok = writeNdef(tag, text)
            pendingWrite = null
            val res = JSObject()
            res.put("success", ok)
            res.put("uid", uid)
            notifyListeners("writeResult", res)
            if (ok) return
        }

        // Mode baca → kirim UID ke aplikasi web
        val obj = JSObject()
        obj.put("uid", uid)
        obj.put("tech", tech.substringAfterLast('.'))
        notifyListeners("cardDetected", obj)
    }

    /* ---------- Foreground dispatch (prioritas tag ke aplikasi ini) ---------- */

    private fun enableForegroundDispatch() {
        val act = activity ?: return
        val a = adapter ?: return
        val flags = if (android.os.Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
        val pi = PendingIntent.getActivity(act, 0, Intent(act, act.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), flags)
        val ndef = IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED).apply { addCategory(Intent.CATEGORY_DEFAULT) }
        val tech = IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)
        val disc = IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
        a.enableForegroundDispatch(act, pi, arrayOf(ndef, tech, disc), null)
    }

    private fun disableForegroundDispatch() {
        adapter?.disableForegroundDispatch(activity)
    }

    /* ---------- Tulis NDEF ke kartu NTAG ---------- */

    private fun writeNdef(tag: Tag, url: String): Boolean {
        val record = NdefRecord.createUri(url)
        val message = NdefMessage(arrayOf(record))
        return try {
            Ndef.get(tag)?.use { ndef ->
                if (!ndef.isWritable) return false
                if (ndef.maxSize < message.toByteArray().size) return false
                ndef.connect()
                ndef.writeNdefMessage(message)
                true
            } ?: run {
                // Kartu NTAG kosong yang belum diformat NDEF
                NdefFormatable.get(tag)?.use { f ->
                    f.connect()
                    f.format(message)
                    true
                } ?: false
            }
        } catch (e: Exception) {
            false
        }
    }
}
