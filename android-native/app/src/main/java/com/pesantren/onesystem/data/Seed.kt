package com.pesantren.onesystem.data

import androidx.room.withTransaction
import com.pesantren.onesystem.PesantrenApp
import java.util.UUID

/**
 * Repository — satu-satunya tempat aturan bisnis.
 * Semua operasi finansial dijalankan dalam transaksi Room (atomik, konsisten).
 * Saldo SELALU dihitung dari ledger, bukan dari angka yang bisa diedit bebas.
 */
object Repo {

    private val db get() = PesantrenApp.instance.db

    /* ---------- saldo & ledger ---------- */

    suspend fun balance(sid: String): Long =
        db.wallet().last(sid)?.balanceAfter ?: 0L

    suspend fun postLedger(
        sid: String, type: String, amount: Long,
        refType: String, refId: String, desc: String
    ): WalletTx = db.withTransaction {
        val before = balance(sid)
        if (amount < 0 && before + amount < 0)
            throw IllegalStateException("Saldo tidak mencukupi")
        val tx = WalletTx(
            id = UUID.randomUUID().toString(),
            santriId = sid, type = type, amount = amount,
            balanceBefore = before, balanceAfter = before + amount,
            refType = refType, refId = refId, description = desc,
            createdAt = System.currentTimeMillis()
        )
        db.wallet().insert(tx)
        tx
    }

    /* ---------- kartu NFC ---------- */

    suspend fun pairCard(uid: String, santriId: String): Card = db.withTransaction {
        val existing = db.card().byUid(uid)
        if (existing != null && existing.status == "ACTIVE" && existing.santriId != santriId)
            throw IllegalStateException("UID sudah dipakai santri lain")
        db.card().replaceAll(santriId)
        val card = Card(uid = uid, santriId = santriId, status = "ACTIVE", issuedAt = System.currentTimeMillis())
        db.card().upsert(card)
        card
    }

    suspend fun blockCard(uid: String): Unit = db.withTransaction {
        db.card().block(uid)
    }

    suspend fun resolveCard(uid: String): Pair<Card, Santri> {
        val card = db.card().byUid(uid) ?: throw IllegalStateException("Kartu tidak terdaftar")
        if (card.status != "ACTIVE") throw IllegalStateException("Kartu ${card.status} — ditolak")
        val santri = db.santri().byId(card.santriId) ?: throw IllegalStateException("Santri tidak ditemukan")
        return card to santri
    }

    /* ---------- POS ---------- */

    suspend fun checkout(
        santriId: String?,
        items: List<Pair<Product, Int>>,
        method: String
    ): Sale = db.withTransaction {
        if (items.isEmpty()) throw IllegalStateException("Keranjang kosong")
        val total = items.sumOf { it.first.price * it.second }

        if (method == "SALDO_NFC") {
            val sid = santriId ?: throw IllegalStateException("Scan kartu santri dulu")
            val bal = balance(sid)
            if (bal < total) throw IllegalStateException("Saldo tidak mencukupi")
            postLedger(sid, "PURCHASE", -total, "SALE", "pos", "Transaksi POS")
        }

        val sale = Sale(
            id = UUID.randomUUID().toString(),
            number = "TRX-" + (System.currentTimeMillis() % 100000),
            santriId = santriId, total = total, method = method,
            createdAt = System.currentTimeMillis()
        )
        db.sale().insertSale(sale)
        items.forEach { (p, q) ->
            db.sale().insertItem(
                SaleItem(
                    id = UUID.randomUUID().toString(), saleId = sale.id,
                    productId = p.id, name = p.name, price = p.price,
                    qty = q, total = p.price * q
                )
            )
            if (p.stock < 500) db.product().decStock(p.id, q)
        }
        sale
    }

    /* ---------- seed data demo ---------- */

    suspend fun ensureSeed() {
        if (db.santri().byId("SAN-001") != null) return

        listOf(
            Santri("SAN-001", "202600123", "Muhammad Ahmad", "L", "VIII A", "aktif"),
            Santri("SAN-002", "202600124", "Muhammad Fauzi", "L", "VIII A", "aktif"),
            Santri("SAN-003", "202600125", "Ali Akbar", "L", "VII B", "aktif"),
            Santri("SAN-004", "202600126", "Hasan Basri", "L", "IX A", "aktif"),
            Santri("SAN-005", "202600127", "Fatimah Azzahra", "P", "VIII B", "aktif")
        ).forEach { db.santri().upsert(it) }

        // kartu demo (UID sama dengan versi web agar konsisten)
        db.card().upsert(Card("04:A1:B2:C3:D4:E5:F6", "SAN-001", "ACTIVE", System.currentTimeMillis()))
        db.card().upsert(Card("04:B1:C2:D3:E4:F5:A6", "SAN-002", "ACTIVE", System.currentTimeMillis()))

        // saldo awal lewat ledger
        postLedger("SAN-001", "TOP_UP", 150_000, "MANUAL", "seed", "Saldo awal demo")
        postLedger("SAN-002", "TOP_UP", 100_000, "MANUAL", "seed", "Saldo awal demo")
        postLedger("SAN-003", "TOP_UP", 75_000, "MANUAL", "seed", "Saldo awal demo")

        listOf(
            Product("PRD-01", "Air Mineral", 3_000, 2_000, 60, "Minuman"),
            Product("PRD-02", "Roti", 5_000, 3_000, 40, "Makanan"),
            Product("PRD-03", "Nasi", 10_000, 7_000, 25, "Makanan"),
            Product("PRD-04", "Es Teh", 3_000, 1_500, 50, "Minuman")
        ).forEach { db.product().upsert(it) }
    }
}
