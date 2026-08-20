package com.pesantren.onesystem.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pesantren.onesystem.ui.theme.Gold400
import com.pesantren.onesystem.ui.theme.Navy800
import com.pesantren.onesystem.ui.theme.TextMute
import java.text.NumberFormat
import java.util.Locale

val idr: NumberFormat = NumberFormat.getNumberInstance(Locale("id", "ID"))

fun rp(n: Long): String = (if (n < 0) "-" else "") + "Rp" + idr.format(kotlin.math.abs(n))

fun initials(name: String): String =
    name.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }

/** Kartu statistik di dashboard. */
@Composable
fun StatCard(label: String, value: String, tint: Color, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    Modifier
                        .size(8.dp)
                        .background(tint, CircleShape)
                )
                Text(label, color = TextMute, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Text(
                value,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 19.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 6.dp)
            )
        }
    }
}

/** Avatar inisial dengan warna navy. */
@Composable
fun Avatar(name: String, size: Int = 38) {
    Box(
        Modifier
            .size(size.dp)
            .background(Navy800, CircleShape)
            .border(1.dp, Gold400.copy(alpha = 0.35f), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(
            initials(name),
            color = Gold400,
            fontSize = (size * 0.36).sp,
            fontWeight = FontWeight.Bold
        )
    }
}

/** Baris santri dengan avatar + nama + sub. */
@Composable
fun SantriRow(name: String, sub: String, trailing: @Composable (() -> Unit)? = null, onClick: (() -> Unit)? = null) {
    val base = Modifier
        .fillMaxWidth()
        .padding(vertical = 6.dp)
    Row(
        modifier = if (onClick != null) base.then(androidx.compose.foundation.clickable { onClick() }) else base,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Avatar(name)
        Column(Modifier.weight(1f)) {
            Text(name, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(sub, color = TextMute, fontSize = 11.sp)
        }
        trailing?.invoke()
    }
}

/** Judul seksi kecil. */
@Composable
fun SectionTitle(text: String) {
    Text(
        text.uppercase(),
        color = TextMute,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.2.sp,
        modifier = Modifier.padding(top = 18.dp, bottom = 8.dp)
    )
}

/** Kotak kosong dengan pesan. */
@Composable
fun EmptyBox(message: String) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp)
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(message, color = TextMute, fontSize = 12.sp, modifier = Modifier.padding(16.dp))
    }
}
