# List overview and access

Help someone identify a list, read its active items, understand access and continue in the right native interface. Shopping is one use of Lists, not a separate capability.

## When to use

Use this pattern for an overview of a reusable checklist and its next action. It fits the editable Lists screen and a read-only launcher widget. Use a local alternative for a transaction table, calendar or recipe: those have different identities, ordering and actions. Record the reason when departing from shared guidance.

## Structure and composition

Put list identity before active content. Keep status near that content and make the continuation action understandable in context. A generic example is **Shopping**, with active items **Apples** and **Rice**. These names illustrate content; this page does not embed an interactive native renderer.

The web screen owns selection, item details, completion, properties and editing. Active items use manual order unless the user selects grouping by a list property; completed items stay separately visible until cleared. Do not copy the widget's bullet presentation into an editable checklist. The widget owns a compact saved snapshot: list name, active count, last successful refresh, active items in returned snapshot order, and an **Open list ↗** action. Tapping an item also opens that list. It does not complete or edit the item, reproduce web grouping or show completed items.

## Access, failure and recovery

On web, a selected list whose real response is null and is no longer loading replaces the detail view with **This list is unavailable.** The branch has no recovery button within it; use application navigation to choose another list. Do not show the old selected list as though access remained. Initial loading uses the existing loading presentation with **Loading lists...** and **Bringing your saved lists and recent items into view.** A list-load error has an error message; item mutation errors stay with the editing experience. The development offline demo is explicitly labelled and is not a production cache contract.

On Android, invalid access clears the saved snapshot and associated widget selections for the list, and marks the affected widgets unavailable. They display **List unavailable.** rather than the previous items. A transient refresh failure leaves the saved snapshot and its last-success time intact. The widget shows an age such as **updated 5m ago**, not a claim of a successful current refresh. There is no separate transient-error banner in the current widget. If there is no snapshot, the widget says **Choose a list in Doma.**; that also covers the initial configured-but-not-yet-loaded condition. The unavailable and choose-list messages currently contain no action. Reconfigure in the Doma app; do not promise an inline retry.

A web list with neither active nor completed items says **No items yet.** and retains the add-item affordance. A completed-only list keeps its completed rows and shows no empty-message copy. An empty saved widget shows the list identity, **0 active**, freshness and Open list action with no item rows; it has no special empty-message copy. Empty, unavailable and a failed refresh are different states.

## Accessibility

Keep list and item names readable, and give completion, deletion and continuation controls meaningful names. Web currently labels actions such as **Mark Apples complete**, **Mark Apples active**, **Delete Apples** and **Open Shopping list**. The row opens details with Enter or Space. This is source inspection, not a keyboard pass: its button-role wrapper contains buttons, so keyboard event bubbling and nested interaction semantics need review before promotion. Drag handles and focus visibility also need native verification.

For Glance, check TalkBack reading order, the list name, item titles, last-success age and the Open list target in a launcher. Text assertions do not establish those results. Current launch parameters carry the selected list identity and slug. Verify the actual route and action labels at the native seam before declaring accessibility or continuation proven.

## Platform values and visual guidance

The two candidate roles are primary active-item text and the gap from the leading affordance or marker to its title. Web preserves its current primary text and 8px row gap; that gap also separates adjacent row children. Android preserves a different primary text and 7dp marker-to-title start padding. Matching meaning does not require matching values or identical row structures. The foundations page lists the canonical variants and conversion policy.

Native token adoption is pending RAY-228. Annotated populated and unavailable compositions will live in the dedicated **design/design-system.pen** in RAY-229. Existing design.pen and v2.pen remain separate; no current Pencil nodes or exports are claimed here.

## Evidence and limits

The generated mappings below distinguish supported source behaviour from exclusions and known gaps. Source and test references are navigation evidence, not passing-test reports. The existing web suite exercises details, completion and grouping; its unavailable regression is pending. The Glance suite checks a saved list and item text; state-reducer tests check selection isolation, and widget tests check freshness and deep-link construction. Snapshot clearing and transient-failure retention are source-inspected, with regression evidence still pending. Full populated/unavailable rendering, keyboard, TalkBack and token propagation evidence belongs to the next slices.

This pattern remains **proposed**. Architecture approval and a working documentation site do not promote it. Shared promotion requires maintainer review of contracts, native behaviour, accessibility, tokens and affected Pencil evidence.
