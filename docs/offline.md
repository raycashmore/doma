# Offline data

This monorepo's PWA support today is **shell-only**: each app is installable and its static assets are precached so it boots offline. Convex API calls always go to the network (explicit `NetworkOnly` rule in `apps/budget/vite.config.ts`); there is no offline-write or local-cache layer.

## Why deferred

Real offline data needs an additional layer over Convex:

- **Replicache** — well-trodden CRDT-style mutator/sync model. Pairs with any backend.
- **ElectricSQL** — Postgres-shaped sync engine. Doesn't fit Convex without bridging.
- **Hand-rolled IndexedDB cache + sync** — lightest, most code.

Picking a layer is a per-app decision: not every sub-app needs it.

## Per-app likelihood

| App           | Likely needs offline data?                      |
| ------------- | ----------------------------------------------- |
| Budget        | No — analytics over server data, online is fine |
| Mortgage      | No                                              |
| Schedule      | Maybe — viewing yes, mutating no                |
| Todo list     | Yes — quick captures from anywhere              |
| Shopping list | Yes — supermarket, no signal                    |
| Recipes       | Yes — kitchen, sometimes no signal              |

When the first offline-needing app is built, choose the layer in that PR — not earlier.

## What the PWA shell _does_ give you

- The app launches from the home screen (Add to Home Screen on iOS, Install on Chrome).
- The static shell loads offline; users see the loading state instead of a connection error.
- Service-worker auto-update means new versions ship without users hitting cache-busted blank screens.

## Follow-ups for the PWA shell itself

- **Schedule shell.** The Schedule app has an App Router manifest and 180/192/512 icons for installation on iOS and Android. It intentionally has no service worker yet; offline viewing of live event data is deferred.
- **Per-app theme colors.** Currently all apps use `#f97316` (the orange accent). Once each sub-app gets a real brand mark, give it its own `theme_color` so the installed app's title bar reflects it.
