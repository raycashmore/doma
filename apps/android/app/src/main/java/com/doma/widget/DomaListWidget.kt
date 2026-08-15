package com.doma.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
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
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
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
        val selection = stateStore.readSelection(widgetId)
        val snapshot = selection?.let { item -> stateStore.readSnapshot(item.listPublicId) }
        val unavailable = stateStore.isUnavailable(widgetId)

        provideContent {
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

@Composable
private fun DomaListWidgetContent(snapshot: WidgetSnapshot?, unavailable: Boolean) {
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
            .background(Color(0xFF1F1F1F))
            .padding(16.dp),
    ) {
        Text(message, style = TextStyle(color = ColorProvider(Color(0xFFF5F1EA))))
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
            .background(Color(0xFF1F1F1F))
            .padding(12.dp)
            .clickable(action),
    ) {
        Text(
            text = snapshot.list.name,
            style = TextStyle(color = ColorProvider(Color(0xFFF5F1EA)), fontWeight = FontWeight.Bold),
        )
        Text(
            text = "${snapshot.activeItems.size} active · ${freshnessLabel(snapshot.refreshedAt)}",
            style = TextStyle(color = ColorProvider(Color(0xFFCFC8BF))),
        )
        LazyColumn {
            items(snapshot.activeItems) { item ->
                Text(
                    text = item.title,
                    modifier = GlanceModifier
                        .padding(top = 8.dp)
                        .clickable(action),
                    style = TextStyle(color = ColorProvider(Color(0xFFF5F1EA))),
                )
            }
        }
    }
}

fun freshnessLabel(refreshedAt: Long, now: Long = System.currentTimeMillis()): String {
    val elapsedMinutes = ((now - refreshedAt).coerceAtLeast(0) / 60_000).toInt()
    return when (elapsedMinutes) {
        0 -> "updated now"
        1 -> "updated 1m ago"
        else -> "updated ${elapsedMinutes}m ago"
    }
}
