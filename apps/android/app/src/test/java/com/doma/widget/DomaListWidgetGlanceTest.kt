package com.doma.widget

import android.app.Application
import androidx.datastore.preferences.core.Preferences
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.appwidget.testing.unit.runGlanceAppWidgetUnitTest
import androidx.glance.testing.unit.hasText
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

class DomaWidgetTestApplication : Application()

@RunWith(RobolectricTestRunner::class)
@Config(application = DomaWidgetTestApplication::class, sdk = [35])
class DomaListWidgetGlanceTest {
    @Test
    fun `refreshing widget content advances its render revision`() = runBlocking {
        val context = RuntimeEnvironment.getApplication()
        val glanceId = AppWidgetId(17)
        updateAppWidgetState(context, glanceId) { preferences ->
            preferences[WidgetGlanceState.revision] = 0
        }

        advanceDomaWidgetRenderRevision(context, glanceId)

        val state = getAppWidgetState<Preferences>(context, PreferencesGlanceStateDefinition, glanceId)
        assertEquals(1, state[WidgetGlanceState.revision])
    }

    @Test
    fun `configured widget renders its saved list snapshot`() = runGlanceAppWidgetUnitTest {
        val snapshot = WidgetSnapshot(
            list = WidgetSnapshotList(publicId = "shopping", name = "Shopping", slug = "weekly-shop"),
            activeItems = listOf(WidgetSnapshotItem(id = "item_1", title = "Milk")),
            refreshedAt = 42_000,
        )

        provideComposable {
            DomaListWidgetContent(snapshot, unavailable = false)
        }

        onNode(hasText("Shopping")).assertExists()
        onNode(hasText("Milk")).assertExists()
    }
}
