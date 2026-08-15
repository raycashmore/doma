package com.doma.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetStateReducerTest {
    @Test
    fun `each widget retains its own selected list`() {
        val firstWidget = WidgetListSelection(appWidgetId = 4, listPublicId = "shopping")
        val secondWidget = WidgetListSelection(appWidgetId = 9, listPublicId = "household")

        val selections = selectWidgetList(selectWidgetList(emptyList(), firstWidget), secondWidget)

        assertEquals(listOf(firstWidget, secondWidget), selections)
    }

    @Test
    fun `changing one widget selection leaves other widgets untouched`() {
        val firstWidget = WidgetListSelection(appWidgetId = 4, listPublicId = "shopping")
        val secondWidget = WidgetListSelection(appWidgetId = 9, listPublicId = "household")
        val replacement = WidgetListSelection(appWidgetId = 4, listPublicId = "garden")

        val selections = selectWidgetList(listOf(firstWidget, secondWidget), replacement)

        assertEquals(listOf(secondWidget, replacement), selections)
    }

    @Test
    fun `removing a widget leaves other widget selections intact`() {
        val firstWidget = WidgetListSelection(appWidgetId = 4, listPublicId = "shopping")
        val secondWidget = WidgetListSelection(appWidgetId = 9, listPublicId = "household")

        val selections = removeWidgetList(listOf(firstWidget, secondWidget), appWidgetId = 4)

        assertEquals(listOf(secondWidget), selections)
    }
}
