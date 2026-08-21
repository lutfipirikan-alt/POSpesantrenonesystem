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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pesantren.onesystem.data.Product
import com.pesantren.onesystem.data.Repo
import com.pesantren.onesystem.data.Santri
import com.pesantren.onesystem.nfc.NfcBus
import com.pesantren.onesystem.ui.theme.DangerRed
import com.pesantren.onesystem.ui.theme.Gold400
import com.pesantren.onesystem.ui.theme.Navy900
import com.pesantren.onesystem.ui.theme.Navy950
import com.pesantren.onesystem.ui.theme.OkGreen
import com.pesantren.onesystem.ui.theme.TextMute
import kotlinx.coroutines.launch

/* ============ TOP UP ============ */

@Composable
fun TopUpScreen() {
    var santri by remember { mutableStateOf<Santri?>(null) }
    var saldo by remember { mutableStateOf(0L) }
    var amount by remember { mutableStateOf("50000") }
    var message by remember { mutableStateOf("Tempelkan kartu santri ke HP…") }

    suspend fun load(sid: String) {
        saldo = Repo.balance(sid)
    }

    LaunchedEffect(Unit) {
        NfcBus.uid.collect { uid ->
            try {
                val (card, s) = Repo.resolveCard(uid)
                santri = s
                load(s.id)
                message = "Kartu terbaca: ${s.name}\nUID $uid"
            } catch (e: Exception) {
                message = "Kartu ditolak: ${e.message}"
            }
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        NfcPanel(message, santri?.name)

        SectionTitle("Nominal (Rp)")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(10_000L, 20_000L, 50_000L, 100_000L).forEach { v ->
                AmountChip(v, amount == v.toString()) { amount = v.toString() }
            }
        }
        OutlinedTextField(
            value = amount,
            onValueChange = { amount = it.filter { c -> c.isDigit() } },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface
            )
        )

        InfoRow("Saldo saat ini", rp(saldo))
        InfoRow("Setelah top up", rp(saldo + (amount.toLongOrNull() ?: 0L)), Gold400)

        Button(
            onClick = {
                val s = santri ?: run { message = "Scan kartu santri dulu"; return@Button }
                val amt = amount.toLongOrNull() ?: 0L
                if (amt <= 0) {
                    message = "Nominal tidak valid"
                    return@Button
                }
                kotlinx.coroutines.MainScope().launch {
                    try {
                        val tx = Repo.postLedger(s.id, "TOP_UP", amt, "TOPUP", "topup", "Top up saldo")
                        saldo = tx.balanceAfter
                        message = "Top up berhasil!\nSaldo sekarang ${rp(tx.balanceAfter)}"
                    } catch (e: Exception) {
                        message = "Gagal: ${e.message}"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Gold400),
            enabled = santri != null
        ) {
            Text("TOP UP", color = Navy950, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(vertical = 6.dp))
        }
    }
}

@Composable
private fun AmountChip(value: Long, active: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (active) Gold400 else MaterialTheme.colorScheme.surface
        )
    ) {
        Text(
            rp(value),
            color = if (active) Navy950 else MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String, tint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = TextMute, fontSize = 13.sp)
        Text(value, color = tint, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

/* ============ PANEL NFC (dipakai bersama) ============ */

@Composable
fun NfcPanel(message: String, santriName: String?) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(Navy900, RoundedCornerShape(18.dp))
            .padding(18.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                santriName ?: "Belum ada kartu",
                color = Gold400,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                message,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

/* ============ POS ============ */

@Composable
fun PosScreen(products: List<Product>) {
    var santri by remember { mutableStateOf<Santri?>(null) }
    var saldo by remember { mutableStateOf(0L) }
    var cart by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var message by remember { mutableStateOf("Scan kartu santri untuk bayar dengan saldo") }

    LaunchedEffect(Unit) {
        NfcBus.uid.collect { uid ->
            try {
                val (_, s) = Repo.resolveCard(uid)
                santri = s
                saldo = Repo.balance(s.id)
                message = "Kartu: ${s.name} · saldo ${rp(saldo)}"
            } catch (e: Exception) {
                message = "Kartu ditolak: ${e.message}"
            }
        }
    }

    val total = cart.entries.sumOf { e ->
        (products.firstOrNull { it.id == e.key }?.price ?: 0L) * e.value
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        NfcPanel(message, santri?.name)

        LazyColumn(
            Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item { SectionTitle("Produk") }
            items(products) { p ->
                val qty = cart[p.id] ?: 0
                ProductRow(p, qty,
                    onAdd = { cart = cart + (p.id to qty + 1) },
                    onDec = {
                        cart = if (qty <= 1) cart - p.id else cart + (p.id to qty - 1)
                    })
            }
        }

        Surface(shape = RoundedCornerShape(14.dp), color = Navy900) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("TOTAL", color = TextMute, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(rp(total), color = Gold400, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                }
                Button(
                    onClick = {
                        kotlinx.coroutines.MainScope().launch {
                            try {
                                val items = cart.mapNotNull { (id, q) ->
                                    products.firstOrNull { it.id == id }?.let { it to q }
                                }
                                val method = if (santri != null) "SALDO_NFC" else "CASH"
                                val sale = Repo.checkout(santri?.id, items, method)
                                santri?.let { saldo = Repo.balance(it.id) }
                                cart = emptyMap()
                                message = "${sale.number} berhasil · ${rp(sale.total)} (${method})"
                            } catch (e: Exception) {
                                message = "Gagal: ${e.message}"
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = OkGreen)
                ) {
                    Text("BAYAR", fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}

@Composable
private fun ProductRow(p: Product, qty: Int, onAdd: () -> Unit, onDec: () -> Unit) {
    Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Column(Modifier.weight(1f)) {
                Text(p.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text("${rp(p.price)} · stok ${p.stock}", color = TextMute, fontSize = 11.sp)
            }
            Stepper(qty, onAdd, onDec)
        }
    }
}

@Composable
private fun Stepper(qty: Int, onAdd: () -> Unit, onDec: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = onDec,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            enabled = qty > 0
        ) { Text("−", fontWeight = FontWeight.Bold) }
        Text(qty.toString(), color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        Button(
            onClick = onAdd,
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Gold400)
        ) { Text("+", color = Navy950, fontWeight = FontWeight.Bold) }
    }
}
