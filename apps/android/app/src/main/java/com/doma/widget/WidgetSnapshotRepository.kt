package com.doma.widget

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.Serializable

@Serializable
data class WidgetVisibleList(
    val publicId: String,
    val name: String,
    val slug: String,
)

sealed interface SnapshotRefreshResult {
    data class Available(val snapshot: WidgetSnapshot) : SnapshotRefreshResult
    data object Unavailable : SnapshotRefreshResult
    data object TransientFailure : SnapshotRefreshResult
}

class WidgetSnapshotRepository(
    private val application: DomaApplication,
) {
    suspend fun visibleLists(): Result<List<WidgetVisibleList>> = runCatching {
        withTimeout(SUBSCRIPTION_TIMEOUT_MS) {
            application.convexClient
                .subscribe<List<WidgetVisibleList>>("lists/queries:listVisibleToMe")
                .first()
                .getOrThrow()
                .sortedBy { list -> list.name.lowercase() }
        }
    }

    suspend fun refreshList(listPublicId: String): SnapshotRefreshResult = try {
        val snapshot = withTimeout(SUBSCRIPTION_TIMEOUT_MS) {
            application.convexClient
                .subscribe<WidgetSnapshotProjection?>(
                    name = "lists/widget:getSnapshot",
                    args = mapOf("publicId" to listPublicId),
                )
                .first()
                .getOrThrow()
        }

        if (snapshot == null) {
            application.widgetStateStore.clearUnavailableList(listPublicId)
            SnapshotRefreshResult.Unavailable
        } else {
            val savedSnapshot = snapshot.toStoredSnapshot(refreshedAt = System.currentTimeMillis())
            application.widgetStateStore.saveSnapshot(savedSnapshot)
            SnapshotRefreshResult.Available(savedSnapshot)
        }
    } catch (_: Exception) {
        SnapshotRefreshResult.TransientFailure
    }

    private companion object {
        const val SUBSCRIPTION_TIMEOUT_MS = 10_000L
    }
}
