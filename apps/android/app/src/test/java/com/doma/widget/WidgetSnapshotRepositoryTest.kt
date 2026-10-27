package com.doma.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import kotlinx.coroutines.runBlocking

class WidgetSnapshotRepositoryTest {
    @Test
    fun `transient refresh failure retains last successful content and timestamp`() = runBlocking {
        val previous = WidgetSnapshot(
            list = WidgetSnapshotList(publicId = "shopping", name = "Shopping", slug = "weekly-shop"),
            activeItems = listOf(WidgetSnapshotItem(id = "item_1", title = "Apples")),
            refreshedAt = 42_000,
        )
        val saved = mutableMapOf("shopping" to previous)
        val selections = listOf(WidgetListSelection(appWidgetId = 7, listPublicId = "shopping"))

        val result = refreshWidgetSnapshot(
            listPublicId = "shopping",
            load = { error("temporary network failure") },
            save = { snapshot -> saved[snapshot.list.publicId] = snapshot },
            clearUnavailable = { publicId -> saved.remove(publicId) },
        )

        assertEquals(SnapshotRefreshResult.TransientFailure, result)
        assertSame(previous, saved["shopping"])
        assertEquals(42_000, saved.getValue("shopping").refreshedAt)
        assertEquals("shopping", selections.single().listPublicId)
    }

    @Test
    fun `missing remote list clears its saved snapshot and affected widget selections`() = runBlocking {
        val previous = WidgetSnapshot(
            list = WidgetSnapshotList(publicId = "shopping", name = "Shopping", slug = "weekly-shop"),
            activeItems = listOf(WidgetSnapshotItem(id = "item_1", title = "Rice")),
            refreshedAt = 42_000,
        )
        val unrelated = WidgetSnapshot(
            list = WidgetSnapshotList(publicId = "household", name = "Household", slug = "home"),
            activeItems = listOf(WidgetSnapshotItem(id = "item_2", title = "Batteries")),
            refreshedAt = 43_000,
        )
        var saved = listOf(previous, unrelated)
        val selections = mutableListOf(
            WidgetListSelection(appWidgetId = 7, listPublicId = "shopping"),
            WidgetListSelection(appWidgetId = 9, listPublicId = "shopping"),
            WidgetListSelection(appWidgetId = 8, listPublicId = "household"),
        )
        var unavailable = listOf(2)

        val result = refreshWidgetSnapshot(
            listPublicId = "shopping",
            load = { null },
            save = { snapshot ->
                saved = saved.filterNot { it.list.publicId == snapshot.list.publicId } + snapshot
            },
            clearUnavailable = { publicId ->
                val transition = clearUnavailableListState(
                    listPublicId = publicId,
                    selections = selections,
                    snapshots = saved,
                    unavailableWidgetIds = unavailable,
                )
                selections.clear()
                selections.addAll(transition.selections)
                saved = transition.snapshots
                unavailable = transition.unavailableWidgetIds
            },
        )

        assertEquals(SnapshotRefreshResult.Unavailable, result)
        assertEquals(listOf(unrelated), saved)
        assertEquals(listOf(WidgetListSelection(appWidgetId = 8, listPublicId = "household")), selections)
        assertEquals(listOf(2, 7, 9), unavailable)
    }
}
