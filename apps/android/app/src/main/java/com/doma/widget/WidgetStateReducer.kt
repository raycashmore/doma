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

internal data class UnavailableListTransition(
    val selections: List<WidgetListSelection>,
    val snapshots: List<WidgetSnapshot>,
    val unavailableWidgetIds: List<Int>,
)

internal fun clearUnavailableListState(
    listPublicId: String,
    selections: List<WidgetListSelection>,
    snapshots: List<WidgetSnapshot>,
    unavailableWidgetIds: List<Int>,
): UnavailableListTransition {
    val affectedWidgetIds = selections
        .filter { selection -> selection.listPublicId == listPublicId }
        .map { selection -> selection.appWidgetId }

    return UnavailableListTransition(
        selections = selections.filterNot { selection -> selection.listPublicId == listPublicId },
        snapshots = snapshots.filterNot { snapshot -> snapshot.list.publicId == listPublicId },
        unavailableWidgetIds = (unavailableWidgetIds + affectedWidgetIds).distinct(),
    )
}
