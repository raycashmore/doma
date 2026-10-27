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

    suspend fun refreshList(listPublicId: String): SnapshotRefreshResult = refreshWidgetSnapshot(
        listPublicId = listPublicId,
        load = {
            withTimeout(SUBSCRIPTION_TIMEOUT_MS) {
                application.convexClient
                    .subscribe<WidgetSnapshotProjection?>(
                        name = "lists/widget:getSnapshot",
                        args = mapOf("publicId" to listPublicId),
                    )
                    .first()
                    .getOrThrow()
            }
        },
        save = application.widgetStateStore::saveSnapshot,
        clearUnavailable = application.widgetStateStore::clearUnavailableList,
    )

    private companion object {
        const val SUBSCRIPTION_TIMEOUT_MS = 10_000L
    }
}

internal suspend fun refreshWidgetSnapshot(
    listPublicId: String,
    load: suspend () -> WidgetSnapshotProjection?,
    save: (WidgetSnapshot) -> Unit,
    clearUnavailable: (String) -> Unit,
    now: () -> Long = System::currentTimeMillis,
): SnapshotRefreshResult = try {
    val projection = load()
    if (projection == null) {
        clearUnavailable(listPublicId)
        SnapshotRefreshResult.Unavailable
    } else {
        val snapshot = projection.toStoredSnapshot(refreshedAt = now())
        save(snapshot)
        SnapshotRefreshResult.Available(snapshot)
    }
} catch (_: Exception) {
    SnapshotRefreshResult.TransientFailure
}
