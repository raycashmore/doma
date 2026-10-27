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

Keep list and item names readable, and give completion, deletion and continuation controls meaningful names. Web currently labels actions such as **Mark Apples complete**, **Mark Apples active**, **Delete Apples** and **Open Shopping list**. The title is a native **Open details for Apples** button; Enter or Space opens details. Completion and deletion are separate sibling buttons, so their keyboard events cannot open details. Browser checks verified completion and detail keyboard actions, unchanged computed title colour/gap and no document overflow at 390px. Delete controls become visible on keyboard focus. Drag-handle focus and screen-reader use still need native assistive-technology review.

For Glance, check TalkBack reading order, the list name, item titles, last-success age and the Open list target in a launcher. Text assertions do not establish those results. Glance tests verify native continuation targets and selected-list identity/slug; route construction has a separate unit test. These checks do not prove a real launcher opens the PWA or that TalkBack announces the action correctly.

## Platform values and visual guidance

The two candidate roles are primary active-item text and the gap from the leading affordance or marker to its title. Web preserves its current primary text and 8px row gap; that gap also separates adjacent row children. Android preserves a different primary text and 7dp marker-to-title start padding. Matching meaning does not require matching values or identical row structures. The foundations page lists the canonical variants and conversion policy.

Native adoption uses generated CSS through the legacy tokens.css entry and committed Kotlin scalars through the Android source set. The token package documents generation and checks; local sources are `packages/tokens/README.md` and `packages/tokens/scripts/tokens.test.ts`. Disposable canonical edits prove web/Android generation changes only the corresponding native output and desired Pencil variables; the changed web CSS was applied to the actual fixture row, and a disposable Android copy compiled and tested changed Color/dp adapter values. The real baseline remains unchanged and checked. Four annotated populated/unavailable compositions now live in **design/design-system.pen**, with stable nodes and exported illustrations below. Pen 1.2.20 applied the generated subset, preserved unrelated annotation variables/bindings and topology, saved and reopened with exact equality across 57 nodes and five variables. Disposable web and Android edits independently changed live bound colour/gap to #336699 and 11.5, leaving the other platform unchanged; baseline was restored and reopened before export. Historical design.pen and v2.pen remain unchanged. See design/README.md for the supported maintenance procedure and evidence limits.

## Evidence and limits

The generated mappings below distinguish supported source behaviour from exclusions and known gaps. Source and test references are navigation evidence, not passing-test reports. The web suite exercises details, completion, grouping and removal of old content on unavailable access. Glance tests cover populated/unavailable content and continuation, while repository/state tests cover cache retention on transient failure and clearing on unavailable access. Widget tests cover freshness and route construction. Token fixtures cover deterministic outputs, stale/missing/extra failures and independent variants. Encrypted on-device persistence and real launcher/TalkBack use remain unproved. No Android device was attached during this review. The four PNG exports were decoded and visually inspected; settled Pen bounds had no clipping. Primary text contrasts against the illustrated native surfaces are 12.72:1 web and 15.14:1 Android; Android freshness is 5.26:1 and the Open list label is 8.50:1. The native coral DOMA LISTS brand is only 3.05:1 at small text size, and the pale web completion border needs contrast review. These existing accessibility gaps prevent a conformance claim; illustrations are not assistive-technology evidence.

Version 0.2.0 adds compatible visual evidence and maintenance guidance; no role, state or behavioural promise changed, and no native migration is required.

This pattern remains **proposed**. Architecture approval and a working documentation site do not promote it. Shared promotion requires maintainer review of contracts, native behaviour, accessibility, tokens and affected Pencil evidence.
