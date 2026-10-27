# Doma pattern guide

A thin VitePress 1.6.4 site consumes the design-system package's composed Markdown. It uses the default theme and local full-text search. It imports no application renderer, backend data or analytics.

From the repository root:

```sh
pnpm --filter design-guide dev
pnpm --filter design-guide build
pnpm --filter design-guide preview
```

Browse <http://127.0.0.1:3007>. The stable pattern path is `/patterns/list-overview-and-access.html`. Development binds to loopback and refuses a conflicting port. Restart development after editing canonical sources. Build output is ignored at `.vitepress/dist`; source pages are ignored at `packages/design-system/dist/guide`. VitePress checks internal links during build.

Build/dev derive the checkout revision before invoking the dependency graph. A supplied `DESIGN_GUIDE_REVISION` must match. Both assembly and rendering are noncached so revision changes and references outside package boundaries are always checked. Dirty drafts display local source paths; clean builds link to the represented commit. Revision metadata never enters committed catalogs. The graph is guide → design-system → tokens; the first slice consumes token data only.

No hosted URL exists yet. RAY-230 owns the separate protected Vercel project, exact alias, signed-out page/asset/preview checks and owner usefulness exercise after publication authorization. Noindex is indexing guidance, not access control. The guide has no Home rewrite, Clerk integration, navigation registry entry or PWA service worker.
