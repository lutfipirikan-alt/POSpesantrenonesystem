package com.pesantren.onesystem.nfc

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import kotlinx.coroutines.flow.MutableSharedFlow

/**
 * Bus event NFC — layar (Composable) meng-collect flow ini untuk menerima UID.
 */
object NfcBus {
    val uid = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val writeResult = MutableSharedFlow<Boolean>(extraBufferCapacity = 1)
}

/**
 * NfcManager — akses NFC Android ASLI (NfcAdapter), bukan WebView.
 *  - Membaca UID semua kartu 13,56 MHz: MIFARE Classic, NTAG, DESFire, ISO-DEP.
 *  - Menulis identitas (URL) ke kartu NTAG kosong via NDEF.
 *  - Foreground dispatch memastikan tag masuk ke aplikasi ini, bukan aplikasi lain.
 */
class NfcManager(private val activity: Activity) {

    private val adapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)

    /** Jika bukan null, tag berikutnya akan DITULIS (bukan dibaca). */
    @Volatile
    var pendingWrite: String? = null

    val available: Boolean get() = adapter != null
    val enabled: Boolean get() = adapter?.isEnabled == true

    fun enableDispatch() {
        val a = adapter ?: return
        val intent = Intent(activity, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val flags = PendingIntent.FLAG_MUTABLE
        val pi = PendingIntent.getActivity(activity, 0, intent, flags)
        val tech = IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED)
        val ndef = IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED).apply {
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        val disc = IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
        a.enableForegroundDispatch(activity, pi, arrayOf(tech, ndef, disc), null)
    }

    fun disableDispatch() {
        adapter?.disableForegroundDispatch(activity)
    }

    /** Dipanggil dari MainActivity.handleIntent / onNewIntent. */
    fun handleIntent(intent: Intent) {
        if (intent.action !in listOf(
                NfcAdapter.ACTION_TAG_DISCOVERED,
                NfcAdapter.ACTION_TECH_DISCOVERED,
                NfcAdapter.ACTION_NDEF_DISCOVERED
            )
        ) return

        val tag: Tag = if (android.os.Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java) ?: return
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(NfcAdapter.EXTRA_TAG) ?: return
        }

        val uid = tag.id.joinToString(":") { String.format("%02X", it) }

        pendingWrite?.let { text ->
            val ok = writeNdef(tag, text)
            pendingWrite = null
            NfcBus.writeResult.tryEmit(ok)
            return
        }

        NfcBus.uid.tryEmit(uid)
    }

    private fun writeNdef(tag: Tag, url: String): Boolean {
        val msg = NdefMessage(arrayOf(NdefRecord.createUri(url)))
        return try {
            Ndef.get(tag)?.use { ndef ->
                ndef.connect()
                if (ndef.isWritable && ndef.maxSize >= msg.toByteArray().size) {
                    ndef.writeNdefMessage(msg)
                    true
                } else false
            } ?: NdefFormatable.get(tag)?.use { fmt ->
                fmt.connect()
                fmt.format(msg)
                true
            } ?: false
        } catch (e: Exception) {
            false
        }
    }
}
