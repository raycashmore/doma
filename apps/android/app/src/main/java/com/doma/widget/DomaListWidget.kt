package com.doma.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.AppWidgetId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

object WidgetActionParameters {
    const val LIST_PUBLIC_ID = "doma_list_public_id"
    const val LIST_SLUG = "doma_list_slug"

    val listPublicId = ActionParameters.Key<String>(LIST_PUBLIC_ID)
    val listSlug = ActionParameters.Key<String>(LIST_SLUG)
}

class DomaListWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(
        setOf(
            DpSize(180.dp, 110.dp),
            DpSize(250.dp, 180.dp),
            DpSize(320.dp, 260.dp),
        ),
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val widgetId = (id as AppWidgetId).appWidgetId
        val stateStore = (context.applicationContext as DomaApplication).widgetStateStore

        provideContent {
            // The encrypted snapshot store is deliberately outside Glance state. This revision
            // makes writes to it observable to an already-running widget composition.
            currentState(WidgetGlanceState.revision)
            val selection = stateStore.readSelection(widgetId)
            val snapshot = selection?.let { item -> stateStore.readSnapshot(item.listPublicId) }
            val unavailable = stateStore.isUnavailable(widgetId)
            DomaListWidgetContent(snapshot = snapshot, unavailable = unavailable)
        }
    }

    override suspend fun onDelete(context: Context, glanceId: GlanceId) {
        (context.applicationContext as DomaApplication).widgetStateStore.clearWidget((glanceId as AppWidgetId).appWidgetId)
        super.onDelete(context, glanceId)
    }
}

class DomaListWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = DomaListWidget()
}

internal object WidgetGlanceState {
    val revision = intPreferencesKey("doma_widget_render_revision")
}

internal suspend fun advanceDomaWidgetRenderRevision(context: Context, glanceId: GlanceId) {
    updateAppWidgetState(context, glanceId) { preferences ->
        preferences[WidgetGlanceState.revision] = (preferences[WidgetGlanceState.revision] ?: 0) + 1
    }
}

suspend fun refreshDomaWidget(context: Context, glanceId: GlanceId) {
    advanceDomaWidgetRenderRevision(context, glanceId)
    DomaListWidget().update(context, glanceId)
}

@Composable
internal fun DomaListWidgetContent(snapshot: WidgetSnapshot?, unavailable: Boolean) {
    when {
        unavailable -> WidgetMessage("List unavailable.")
        snapshot == null -> WidgetMessage("Choose a list in Doma.")
        else -> ListWindow(snapshot)
    }
}

@Composable
private fun WidgetMessage(message: String) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(DomaWidgetColors.surface)
            .cornerRadius(20.dp)
            .padding(16.dp),
    ) {
        Text("DOMA LISTS", style = TextStyle(color = ColorProvider(DomaWidgetColors.coral), fontSize = 10.sp, fontWeight = FontWeight.Bold))
        Text(
            message,
            modifier = GlanceModifier.padding(top = 8.dp),
            style = TextStyle(color = ColorProvider(DomaWidgetColors.espresso), fontSize = 16.sp, fontWeight = FontWeight.Bold),
        )
    }
}

@Composable
private fun ListWindow(snapshot: WidgetSnapshot) {
    val action = actionStartActivity<WidgetLaunchActivity>(
        actionParametersOf(
            WidgetActionParameters.listPublicId to snapshot.list.publicId,
            WidgetActionParameters.listSlug to snapshot.list.slug,
        ),
    )

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(DomaWidgetColors.surface)
            .cornerRadius(20.dp)
            .padding(14.dp),
    ) {
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(
                    text = "DOMA LISTS",
                    style = TextStyle(
                        color = ColorProvider(DomaWidgetColors.coral),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                )
                Text(
                    text = snapshot.list.name,
                    modifier = GlanceModifier.padding(top = 3.dp),
                    style = TextStyle(
                        color = ColorProvider(DomaWidgetColors.espresso),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                )
            }
            Text(
                text = "Open list ↗",
                modifier = GlanceModifier
                    .background(DomaWidgetColors.chocolate)
                    .cornerRadius(12.dp)
                    .padding(8.dp, 6.dp)
                    .clickable(action),
                style = TextStyle(
                    color = ColorProvider(DomaWidgetColors.surface),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }
        Text(
            text = "${snapshot.activeItems.size} active · ${freshnessLabel(snapshot.refreshedAt)}",
            modifier = GlanceModifier.padding(top = 8.dp),
            style = TextStyle(color = ColorProvider(DomaWidgetColors.muted), fontSize = 12.sp),
        )
        LazyColumn {
            items(snapshot.activeItems) { item ->
                Row(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .padding(top = 9.dp)
                        .clickable(action),
                ) {
                    Text(
                        text = "•",
                        style = TextStyle(color = ColorProvider(DomaWidgetColors.coral), fontWeight = FontWeight.Bold),
                    )
                    Text(
                        text = item.title,
                        modifier = GlanceModifier.padding(start = 7.dp),
                        style = TextStyle(color = ColorProvider(DomaWidgetColors.espresso), fontSize = 14.sp),
                    )
                }
            }
        }
    }
}

private object DomaWidgetColors {
    val surface = Color(0xFFFFF8EF)
    val espresso = Color(0xFF2E1E19)
    val coral = Color(0xFFE26D50)
    val muted = Color(0xFF76655D)
    val chocolate = Color(0xFF6C3D2D)
}

fun freshnessLabel(refreshedAt: Long, now: Long = System.currentTimeMillis()): String {
    val elapsedMinutes = ((now - refreshedAt).coerceAtLeast(0) / 60_000).toInt()
    return when (elapsedMinutes) {
        0 -> "updated now"
        1 -> "updated 1m ago"
        else -> "updated ${elapsedMinutes}m ago"
    }
}
