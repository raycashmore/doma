package com.doma.widget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging

class WidgetRefreshCoordinator(
    private val application: DomaApplication,
) {
    suspend fun registerDevice(): Boolean {
        if (!application.configuration.isConfigured || !application.configuration.firebase.isConfigured) return true
        if (application.convexClient.loginFromCache().isFailure) return false
        return registerAuthenticatedDevice()
    }

    private suspend fun registerAuthenticatedDevice(): Boolean {
        val fcmToken = runCatching { Tasks.await(FirebaseMessaging.getInstance().token) }.getOrNull() ?: return false
        return runCatching {
            application.convexClient.mutation(
                name = "lists/widgetDevices:register",
                args = mapOf(
                    "installationId" to application.widgetStateStore.installationId(),
                    "fcmToken" to fcmToken,
                ),
            )
        }.isSuccess
    }

    suspend fun refreshSelectedWidgets(): Boolean {
        if (!application.configuration.isConfigured) return true
        if (application.widgetStateStore.readSelections().isEmpty()) return true
        if (application.convexClient.loginFromCache().isFailure) return false

        var hasTransientFailure = application.configuration.firebase.isConfigured && !registerAuthenticatedDevice()
        application.widgetStateStore.readSelections()
            .map { selection -> selection.listPublicId }
            .distinct()
            .forEach { publicId ->
                if (application.widgetSnapshotRepository.refreshList(publicId) is SnapshotRefreshResult.TransientFailure) {
                    hasTransientFailure = true
                }
            }
        updateAllWidgets()
        return !hasTransientFailure
    }

    private suspend fun updateAllWidgets() {
        val context = application.applicationContext
        val manager = GlanceAppWidgetManager(context)
        manager.getGlanceIds(DomaListWidget::class.java).forEach { glanceId ->
            DomaListWidget().update(context, glanceId)
        }
    }
}
