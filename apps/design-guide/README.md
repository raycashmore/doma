# Doma pattern guide

A thin VitePress 1.6.4 site consumes the design-system package's composed Markdown. It uses the default theme and local full-text search. It imports no application renderer, backend data or analytics.

From the repository root:

```sh
pnpm --filter design-guide dev
pnpm --filter design-guide build
pnpm --filter design-guide preview
```

Browse <http://127.0.0.1:3007>. The stable pattern path is `/patterns/list-overview-and-access.html`. Development binds to loopback and refuses a conflicting port. Restart development after editing canonical sources. Build output is ignored at `.vitepress/dist`; source pages are ignored at `packages/design-system/dist/guide`. VitePress checks internal links during build.

Build/dev derive the checkout revision before invoking the dependency graph. A supplied `DESIGN_GUIDE_REVISION` must match. Both assembly and rendering are noncached so revision changes and references outside package boundaries are always checked. Turbo builds await dependency assembly through the graph; standalone build/dev commands assemble their own dependencies once. Dirty drafts display local source paths; clean builds link to the represented commit. Revision metadata never enters committed catalogs. The graph is guide → design-system → tokens; the first slice consumes token data only.

No hosted URL exists yet. RAY-230 owns the separate protected Vercel project, exact alias, signed-out page/asset/preview checks and owner usefulness exercise after publication authorization. Noindex is indexing guidance, not access control. The guide has no Home rewrite, Clerk integration, navigation registry entry or PWA service worker.

## Browser smoke checks

After building, run `pnpm --filter design-guide test:browser`. Install Chromium once with `pnpm --filter design-guide exec playwright install chromium` (included by `pnpm ci:local`). The suite owns a separate strict loopback preview on port 3407; it never reuses the owner's port 3007. It checks routes, keyboard search/recovery navigation, Escape, occupied-port rejection and refusal of non-loopback connections. A non-loopback IPv4 interface is required for the binding check. CI installs Chromium and its Linux dependencies, then runs the suite after the static build. Traces from failures stay in ignored `test-results/`.

`pnpm --filter design-guide preview` still uses port 3007; an optional port argument, for example `preview 3407`, serves the same build. Preview uses Vite's supported API with a fixed loopback host and strict port selection.
