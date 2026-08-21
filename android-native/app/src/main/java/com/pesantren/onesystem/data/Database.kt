package com.pesantren.onesystem.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/* ============ Entitas ============ */

@Entity(tableName = "santri")
data class Santri(
    @PrimaryKey val id: String,
    val nis: String,
    val name: String,
    val gender: String,
    val kelas: String,
    val status: String
)

@Entity(
    tableName = "card",
    indices = [Index(value = ["uid"], unique = true)]
)
data class Card(
    @PrimaryKey val uid: String,
    val santriId: String,
    val status: String, // ACTIVE | BLOCKED | REPLACED
    val issuedAt: Long
)

@Entity(tableName = "wallet_tx")
data class WalletTx(
    @PrimaryKey val id: String,
    val santriId: String,
    val type: String,
    val amount: Long,
    val balanceBefore: Long,
    val balanceAfter: Long,
    val refType: String,
    val refId: String,
    val description: String,
    val createdAt: Long
)

@Entity(tableName = "product")
data class Product(
    @PrimaryKey val id: String,
    val name: String,
    val price: Long,
    val cost: Long,
    val stock: Int,
    val category: String
)

@Entity(tableName = "sale")
data class Sale(
    @PrimaryKey val id: String,
    val number: String,
    val santriId: String?,
    val total: Long,
    val method: String,
    val createdAt: Long
)

@Entity(tableName = "sale_item")
data class SaleItem(
    @PrimaryKey val id: String,
    val saleId: String,
    val productId: String,
    val name: String,
    val price: Long,
    val qty: Int,
    val total: Long
)

/* ============ DAO ============ */

@Dao
interface SantriDao {
    @Query("SELECT * FROM santri WHERE status = 'aktif' ORDER BY name")
    fun all(): Flow<List<Santri>>

    @Query("SELECT * FROM santri WHERE status = 'aktif' ORDER BY name")
    suspend fun allOnce(): List<Santri>

    @Query("SELECT * FROM santri WHERE id = :id")
    suspend fun byId(id: String): Santri?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(s: Santri)
}

@Dao
interface CardDao {
    @Query("SELECT * FROM card WHERE uid = :uid")
    suspend fun byUid(uid: String): Card?

    @Query("SELECT * FROM card WHERE santriId = :sid AND status = 'ACTIVE' LIMIT 1")
    suspend fun activeOf(sid: String): Card?

    @Query("SELECT * FROM card WHERE status = 'ACTIVE' ORDER BY issuedAt DESC")
    suspend fun activeCards(): List<Card>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(c: Card)

    @Query("UPDATE card SET status = 'REPLACED' WHERE santriId = :sid AND status = 'ACTIVE'")
    suspend fun replaceAll(sid: String)

    @Query("UPDATE card SET status = 'BLOCKED' WHERE uid = :uid")
    suspend fun block(uid: String)
}

@Dao
interface WalletDao {
    @Query("SELECT * FROM wallet_tx WHERE santriId = :sid ORDER BY createdAt DESC LIMIT 1")
    suspend fun last(sid: String): WalletTx?

    @Insert
    suspend fun insert(t: WalletTx)

    @Query("SELECT * FROM wallet_tx WHERE santriId = :sid ORDER BY createdAt DESC")
    fun history(sid: String): Flow<List<WalletTx>>
}

@Dao
interface ProductDao {
    @Query("SELECT * FROM product ORDER BY name")
    fun all(): Flow<List<Product>>

    @Query("SELECT * FROM product WHERE id = :id")
    suspend fun byId(id: String): Product?

    @Query("UPDATE product SET stock = stock - :q WHERE id = :id")
    suspend fun decStock(id: String, q: Int)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(p: Product)
}

@Dao
interface SaleDao {
    @Insert
    suspend fun insertSale(s: Sale)

    @Insert
    suspend fun insertItem(i: SaleItem)

    @Query("SELECT * FROM sale ORDER BY createdAt DESC LIMIT :limit")
    fun recent(limit: Int): Flow<List<Sale>>
}

/* ============ Database ============ */

@Database(
    entities = [
        Santri::class, Card::class, WalletTx::class,
        Product::class, Sale::class, SaleItem::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun santri(): SantriDao
    abstract fun card(): CardDao
    abstract fun wallet(): WalletDao
    abstract fun product(): ProductDao
    abstract fun sale(): SaleDao
}
