package com.doma.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class DomaListWidgetTest {
    @Test
    fun `freshness label is compact for a current snapshot`() {
        assertEquals("updated now", freshnessLabel(refreshedAt = 5_000, now = 59_999))
    }

    @Test
    fun `freshness label reports elapsed minutes`() {
        assertEquals("updated 2m ago", freshnessLabel(refreshedAt = 0, now = 120_000))
    }

    @Test
    fun `PWA handoff targets the exact selected list`() {
        assertEquals(
            "https://doma.example.com/lists/l/shopping/weekly-shop",
            buildListPwaUrl("https://doma.example.com/lists/", "shopping", "weekly-shop"),
        )
    }

    @Test
    fun `server snapshot receives its freshness timestamp locally`() {
        val snapshot = WidgetSnapshotProjection(
            list = WidgetSnapshotList(publicId = "shopping", name = "Shopping", slug = "weekly-shop"),
            activeItems = listOf(WidgetSnapshotItem(id = "item_1", title = "Milk")),
        ).toStoredSnapshot(refreshedAt = 42_000)

        assertEquals(42_000, snapshot.refreshedAt)
    }

    @Test
    fun `missing One Tap configuration is explained without crashing`() {
        assertEquals(
            "Google sign-in is not configured for this Clerk environment.",
            googleSignInErrorMessage(IllegalArgumentException("Google One Tap Client ID is not set.")),
        )
    }
}
