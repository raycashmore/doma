# Hide Mobile Navigation in Installed PWAs

## Goal

Hide Doma's bottom mobile navigation when an app runs as an installed standalone PWA. Keep the navigation visible when the same app runs in a mobile browser.

## Design

Add a shared `mobile-app-nav` class to the React shell's mobile navigation and the Lists app's equivalent Svelte navigation. Each app's global stylesheet will hide that class inside an `@media (display-mode: standalone)` query.

This uses the browser's actual display mode and requires no JavaScript state or installation detection. The existing flex layout will let the main content consume the space released by the hidden navigation.

## Scope

- Update the React navigation used by Home, Budget, and Schedule.
- Update the Svelte navigation used by Lists.
- Add the standalone-mode rule to each app's global stylesheet.
- Preserve the current navigation in browser display mode and at desktop breakpoints.

## Testing

Add focused coverage that verifies each mobile navigation carries the shared selector and each app stylesheet defines the standalone-mode rule. Run the repository's formatting, lint, type-check, and test commands before completion.

## Trade-off

Installed users will lose the bottom cross-app switcher. This is intentional; each zone remains independently scoped and directly launchable as its own installed PWA.
