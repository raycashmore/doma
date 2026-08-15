package com.doma.widget

import android.app.Application
import com.clerk.api.Clerk

class DomaApplication : Application() {
    lateinit var configuration: DomaConfiguration
        private set

    lateinit var widgetStateStore: WidgetStateStore
        private set

    val convexClient by lazy { DomaConvexClient.create(configuration) }

    val widgetSnapshotRepository by lazy { WidgetSnapshotRepository(this) }

    override fun onCreate() {
        super.onCreate()

        configuration = DomaConfiguration.fromBuildConfig()
        widgetStateStore = WidgetStateStore(this)

        if (configuration.isConfigured) {
            Clerk.initialize(this, publishableKey = configuration.clerkPublishableKey)
        }
    }
}
