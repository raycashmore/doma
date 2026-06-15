# Lists picker design

**Status:** grilled design, pre-implementation
**Date:** 2026-06-15

## Goal

Land the first real Lists tracer bullet: a working left-side list picker in the SvelteKit Lists app, backed by Convex, with correct personal/shared visibility rules and shareable deep links for individual lists.

This slice should prove the end-to-end path through SvelteKit, Clerk, Convex, Doma navigation, and the Lists visual language without pulling item editing into scope yet.

## Scope

This slice includes:

- creating a list with a freeform name and `personal` or `shared` visibility
- renaming a visible list
- deleting a visible list
- switching between visible lists in the left picker
- loading a specific list from a shareable URL
- enforcing creator-only access for personal lists
- enforcing household-wide access for shared lists

This slice does not include:

- real list items
- list properties
- item details editing
- search, filters, or saved views
- invites, roles, or per-list membership

## Product Shape

The Lists screen keeps the current three-panel structure from the existing scaffold and the `design/v2.pen` Lists frames:

- left list picker
- central item pane
- right detail pane

Only the left picker becomes fully interactive in this slice. The center and right panes stay mostly presentational, but they should reflect the selected list name and visibility so the screen feels coherent.

The visual direction should stay aligned with the current warm Doma token system already used in `apps/lists`. This is not a redesign.

## Deep Linking

Each list should have a canonical URL with a stable public identifier:

```text
/lists/l/<publicId>/<slug>
```

Examples:

```text
/lists/l/list_9x3k2f/weekend-reset
/lists/l/list_a7m8qd/shared-shopping
```

Rules:

- `publicId` is the authoritative identifier in the route.
- `slug` is derived from the current list name and is only for readability.
- the app loads the list by `publicId`, not by `slug`
- if the slug is stale or missing, the app should normalize the URL to the current canonical path after load
- `/lists` remains the neutral landing route
- when a user visits `/lists`, the app should open the last-opened visible list from local state when possible, otherwise the first visible list
- when a user opens a deep link, the URL selection wins over any local fallback

This route shape supports proper shareable links without coupling the URL to mutable names or Convex document internals.

## Access Model

Use the domain language already defined in `CONTEXT.md`.

- a `personal list` is visible and editable only by its creator
- a `shared list` is visible and editable by every household user
- there are no invites, viewer/editor roles, or household membership records in v1

When a user opens a list URL they cannot access:

- the app should treat it as unavailable
- the UI should not reveal whether the list exists but is forbidden, or does not exist at all
- the response shape should support a single not-found-or-unavailable state

That keeps private list existence from leaking through deep links.

## Data Model

Add a dedicated `lists` table in Convex.

Suggested fields:

```ts
{
  publicId: string;
  name: string;
  slug: string;
  visibility: "personal" | "shared";
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
}
```

Notes:

- `publicId` is a durable external identifier for URLs
- `slug` is stored for easy canonical URL generation
- `createdByUserId` comes from Clerk identity
- timestamps support future ordering and UI polish

Recommended indexes:

- `by_public_id`
- `by_created_by`
- `by_visibility`

If Convex needs a composite access pattern later, we can widen indexes then. For this slice, correctness matters more than aggressive optimization.

## Backend Contract

Add Clerk-gated Lists functions in `packages/convex/convex/lists/`.

Recommended surface:

- `listVisibleToMe`
  - returns every list the current user may see
- `getVisibleListByPublicId`
  - returns a single visible list by `publicId`
- `createList`
  - creates a list for the current user with chosen visibility
- `renameList`
  - updates the name and slug for an editable list
- `deleteList`
  - removes an editable list

Behavior rules:

- personal lists are returned only when `createdByUserId === currentUserId`
- shared lists are returned for every authenticated household user
- rename and delete must reject lists the caller cannot edit
- create, rename, and delete should return enough information for the UI to navigate to the canonical route immediately

The backend should own access checks. The frontend should not reimplement authorization logic beyond presenting states.

## Frontend Behavior

The left picker should:

- render visible lists from Convex instead of fixtures
- show the active state based on the current route
- support create, rename, delete, and switch flows
- update the URL when the active list changes

Suggested UX details:

- creating a list should navigate straight to the new list's canonical URL
- renaming a selected list should keep the same `publicId` and update the slug
- deleting the selected list should navigate to the next sensible visible list, or back to `/lists` if none remain
- empty state should still feel intentional when the user has no visible lists yet

The center pane header should update from the selected list so the deep link feels real even before item work lands.

## Error And Empty States

Support these states explicitly:

- loading visible lists
- no visible lists yet
- selected list unavailable
- create, rename, or delete mutation failure

The unavailable state should use calm product language such as "This list is unavailable" rather than exposing permission details.

## Testing

Treat this as a behavioral feature.

Backend tests should cover:

- unauthenticated access rejection
- personal list visibility for creator only
- shared list visibility for all authenticated users
- personal list deep-link lookup blocked for non-creators
- rename allowed only for editable lists
- delete allowed only for editable lists
- slug regeneration on rename

Browser verification should cover:

- create a personal list
- create a shared list
- switch between lists from the picker
- load a list directly from its canonical URL

Do not add item-level tests in this slice.

## Non-Goals

- using Convex document `_id` as the public route identifier
- query-string-based active list selection
- list item persistence
- property editing
- mobile-specific flow redesign
- cross-household sharing

## Risks And Trade-Offs

The main extra work in this slice is choosing a dedicated `publicId` instead of exposing Convex `_id` in the URL. That is deliberate. It gives Doma a cleaner long-term external contract for list links and reduces future coupling between storage internals and user-facing routes.

The other deliberate choice is keeping the center and right panes mostly static. That keeps the tracer bullet small and preserves room for the next slice to focus on list items and properties without muddying the boundary here.
