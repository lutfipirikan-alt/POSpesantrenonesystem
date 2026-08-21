package com.pesantren.onesystem.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Navy950 = Color(0xFF06152B)
val Navy900 = Color(0xFF0A1F3E)
val Navy800 = Color(0xFF0E2B54)
val Navy700 = Color(0xFF143A6C)
val Navy600 = Color(0xFF1F4B85)
val Navy400 = Color(0xFF5D87B8)
val Navy300 = Color(0xFF8FAED1)
val Navy100 = Color(0xFFDCE6F3)
val Navy50 = Color(0xFFEEF3FA)

val Gold500 = Color(0xFFC9922B)
val Gold400 = Color(0xFFDBA63E)
val Gold300 = Color(0xFFE3BA63)

val OkGreen = Color(0xFF17835A)
val DangerRed = Color(0xFFC24545)
val WarnAmber = Color(0xFFA26A10)
val InfoBlue = Color(0xFF2C6FB0)

val TextLight = Color(0xFFF1F4F8)
val TextMute = Color(0xFF9FB0C9)

private val DarkColors = darkColorScheme(
    primary = Gold400,
    onPrimary = Navy950,
    secondary = Navy300,
    onSecondary = Navy950,
    background = Navy950,
    onBackground = TextLight,
    surface = Navy900,
    onSurface = TextLight,
    surfaceVariant = Navy800,
    onSurfaceVariant = Navy300,
    outline = Navy700
)

@Composable
fun PesantrenTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
