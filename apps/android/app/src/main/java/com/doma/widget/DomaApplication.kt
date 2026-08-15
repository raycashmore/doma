package com.doma.widget

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.clerk.api.Clerk
import com.google.firebase.FirebaseApp
import java.util.concurrent.TimeUnit

class DomaApplication : Application() {
    lateinit var configuration: DomaConfiguration
        private set

    lateinit var widgetStateStore: WidgetStateStore
        private set

    val convexClient by lazy { DomaConvexClient.create(configuration) }

    val widgetSnapshotRepository by lazy { WidgetSnapshotRepository(this) }

    val widgetRefreshCoordinator by lazy { WidgetRefreshCoordinator(this) }

    override fun onCreate() {
        super.onCreate()

        configuration = DomaConfiguration.fromBuildConfig()
        widgetStateStore = WidgetStateStore(this)

        if (configuration.isConfigured) {
            Clerk.initialize(this, publishableKey = configuration.clerkPublishableKey)
        }

        if (configuration.firebase.isConfigured) {
            FirebaseApp.initializeApp(this, configuration.firebase.firebaseOptions())
        }

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            WIDGET_REFRESH_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES).build(),
        )
    }

    private companion object {
        const val WIDGET_REFRESH_WORK_NAME = "doma-widget-refresh"
    }
}
