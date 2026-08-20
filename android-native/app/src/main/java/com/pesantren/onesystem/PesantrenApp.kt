package com.pesantren.onesystem

import android.app.Application
import androidx.room.Room
import com.pesantren.onesystem.data.AppDatabase
import com.pesantren.onesystem.data.Repo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Application — memegang singleton database Room.
 * Seed data demo dijalankan sekali di background saat aplikasi pertama dibuka.
 */
class PesantrenApp : Application() {

    lateinit var db: AppDatabase
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        db = Room.databaseBuilder(this, AppDatabase::class.java, "pesantren-one.db")
            .fallbackToDestructiveMigration()
            .build()
        CoroutineScope(Dispatchers.IO).launch { Repo.ensureSeed() }
    }

    companion object {
        lateinit var instance: PesantrenApp
            private set
    }
}
