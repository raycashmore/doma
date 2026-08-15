package com.doma.widget

fun selectWidgetList(
    selections: List<WidgetListSelection>,
    selection: WidgetListSelection,
): List<WidgetListSelection> =
    selections.filterNot { item -> item.appWidgetId == selection.appWidgetId } + selection

fun removeWidgetList(
    selections: List<WidgetListSelection>,
    appWidgetId: Int,
): List<WidgetListSelection> = selections.filterNot { item -> item.appWidgetId == appWidgetId }
