package com.pesantren.onesystem.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pesantren.onesystem.data.Card
import com.pesantren.onesystem.data.Repo
import com.pesantren.onesystem.data.Santri
import com.pesantren.onesystem.nfc.NfcBus
import com.pesantren.onesystem.ui.theme.Gold400
import com.pesantren.onesystem.ui.theme.InfoBlue
import com.pesantren.onesystem.ui.theme.Navy900
import com.pesantren.onesystem.ui.theme.OkGreen
import com.pesantren.onesystem.ui.theme.TextMute

/* ============ HOME ============ */

@Composable
fun HomeScreen(
    santriCount: Int,
    onNav: (String) -> Unit
) {
    var totalSaldo by remember { mutableStateOf(0L) }
    var santris by remember { mutableStateOf<List<Santri>>(emptyList()) }

    LaunchedEffect(Unit) {
        santris = santriList()
        totalSaldo = santris.sumOf { Repo.balance(it.id) }
    }

    LazyColumn(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(Navy900, RoundedCornerShape(18.dp))
                    .padding(18.dp)
            ) {
                Column {
                    Text("Pesantren One System", color = Gold400, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "NFC native aktif — tempelkan kartu santri ke HP",
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    Text(
                        "Saldo tersimpan aman di perangkat (ledger), kartu hanya identitas.",
                        color = TextMute,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard("Santri Aktif", santriCount.toString(), InfoBlue, Modifier.weight(1f))
                StatCard("Total Saldo", rp(totalSaldo), OkGreen, Modifier.weight(1f))
            }
        }

        item { SectionTitle("Menu") }

        item { MenuButton("Top Up Saldo", "Scan kartu → isi saldo → tercatat di ledger") { onNav("topup") } }
        item { MenuButton("POS Kasir", "Jual produk, bayar dengan saldo NFC") { onNav("pos") } }
        item { MenuButton("Data Santri", "Lihat santri & saldo masing-masing") { onNav("santri") } }
        item { MenuButton("Kartu NFC", "Pasangkan / blokir kartu santri") { onNav("card") } }
    }
}

@Composable
private fun MenuButton(title: String, sub: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(Modifier.weight(1f)) {
                Column(horizontalAlignment = Alignment.Start) {
                    Text(title, color = MaterialTheme.colorScheme.onSurface, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    Text(sub, color = TextMute, fontSize = 11.sp)
                }
            }
            Text("›", color = Gold400, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Baca list santri sekali (bukan Flow) untuk kebutuhan sederhana. */
suspend fun santriList(): List<Santri> =
    com.pesantren.onesystem.PesantrenApp.instance.db.santri().allOnce()

/* ============ SANTRI ============ */

@Composable
fun SantriScreen(santri: List<Santri>, balances: Map<String, Long>) {
    LazyColumn(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        item { SectionTitle("Santri Aktif (${santri.size})") }
        if (santri.isEmpty()) {
            item { EmptyBox("Belum ada santri") }
        } else {
            items(santri) { s ->
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
                    SantriRow(
                        name = s.name,
                        sub = "NIS ${s.nis} · ${s.kelas}",
                        trailing = {
                            Text(
                                rp(balances[s.id] ?: 0L),
                                color = Gold400,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    )
                }
            }
        }
    }
}

/* ============ KARTU NFC ============ */

@Composable
fun CardScreen(santri: List<Santri>) {
    var selected by remember { mutableStateOf(santri.firstOrNull()?.id ?: "") }
    var mode by remember { mutableStateOf("pair") } // pair | block
    var lastUid by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf("Tempelkan kartu ke HP untuk memulai…") }
    var cards by remember { mutableStateOf<List<Card>>(emptyList()) }

    suspend fun refresh() {
        cards = com.pesantren.onesystem.PesantrenApp.instance.db.card().activeCards()
    }

    LaunchedEffect(Unit) {
        refresh()
        NfcBus.uid.collect { uid ->
            lastUid = uid
            try {
                if (mode == "pair") {
                    val card = Repo.pairCard(uid, selected)
                    val s = santri.firstOrNull { it.id == card.santriId }
                    message = "Kartu terpasang ke ${s?.name}\nUID: $uid"
                } else {
                    Repo.blockCard(uid)
                    message = "Kartu diblokir\nUID: $uid"
                }
                refresh()
            } catch (e: Exception) {
                message = "Gagal: ${e.message}"
            }
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(Navy900, RoundedCornerShape(18.dp))
                .padding(18.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                androidx.compose.material3.Icon(
                    Icons.Default.Nfc,
                    contentDescription = null,
                    tint = Gold400,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                Text(message, color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                lastUid?.let {
                    Text(it, color = Gold400, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp), fontWeight = FontWeight.Bold)
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ModeChip("Pasangkan", mode == "pair") { mode = "pair" }
            ModeChip("Blokir", mode == "block") { mode = "block" }
        }

        SectionTitle("Pilih Santri")
        santri.forEach { s ->
            val isSel = selected == s.id
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                color = if (isSel) Gold400.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surface,
                onClick = { selected = s.id }
            ) {
                SantriRow(name = s.name, sub = "NIS ${s.nis} · ${s.kelas}")
            }
        }

        SectionTitle("Kartu Aktif")
        if (cards.isEmpty()) {
            EmptyBox("Belum ada kartu aktif")
        } else {
            cards.forEach { c ->
                val s = santri.firstOrNull { it.id == c.santriId }
                Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surface) {
                    SantriRow(
                        name = s?.name ?: c.santriId,
                        sub = c.uid,
                        trailing = { Text("ACTIVE", color = OkGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ModeChip(label: String, active: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(20.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (active) Gold400 else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Text(
            label,
            color = if (active) com.pesantren.onesystem.ui.theme.Navy950 else TextMute,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp
        )
    }
}
