package com.pesantren.onesystem

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.pesantren.onesystem.data.Repo
import com.pesantren.onesystem.nfc.NfcManager
import com.pesantren.onesystem.ui.CardScreen
import com.pesantren.onesystem.ui.HomeScreen
import com.pesantren.onesystem.ui.PosScreen
import com.pesantren.onesystem.ui.SantriScreen
import com.pesantren.onesystem.ui.TopUpScreen
import com.pesantren.onesystem.ui.theme.PesantrenTheme

class MainActivity : ComponentActivity() {

    private lateinit var nfc: NfcManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfc = NfcManager(this)
        handleIntent(intent)

        setContent {
            PesantrenTheme {
                val db = (application as PesantrenApp).db
                val santri by db.santri().all().collectAsState(initial = emptyList())
                val products by db.product().all().collectAsState(initial = emptyList())
                val nav = rememberNavController()

                var balances by remember { mutableStateOf<Map<String, Long>>(emptyMap()) }
                LaunchedEffect(santri) {
                    balances = santri.associate { it.id to Repo.balance(it.id) }
                }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    containerColor = androidx.compose.material3.MaterialTheme.colorScheme.background
                ) { padding ->
                    NavHost(
                        navController = nav,
                        startDestination = "home",
                        modifier = Modifier.padding(padding)
                    ) {
                        composable("home") {
                            HomeScreen(santriCount = santri.size) { nav.navigate(it) }
                        }
                        composable("santri") { SantriScreen(santri, balances) }
                        composable("card") { CardScreen(santri) }
                        composable("topup") { TopUpScreen() }
                        composable("pos") { PosScreen(products) }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (nfc.available && nfc.enabled) nfc.enableDispatch()
    }

    override fun onPause() {
        super.onPause()
        nfc.disableDispatch()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        nfc.handleIntent(intent)
    }
}
