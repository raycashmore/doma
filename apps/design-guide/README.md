# Doma pattern guide

A thin VitePress 1.6.4 site consumes the design-system package's composed Markdown. It uses the default theme and local full-text search. It imports no application renderer, backend data or analytics.

From the repository root:

```sh
pnpm --filter design-guide dev
pnpm --filter design-guide build
pnpm --filter design-guide preview
```

Browse <http://127.0.0.1:3007>. The stable pattern path is `/patterns/list-overview-and-access.html`. Development binds to loopback and refuses a conflicting port. Restart development after editing canonical sources. Build output is ignored at `.vitepress/dist`; source pages are ignored at `packages/design-system/dist/guide`. VitePress checks internal links during build.

Build/dev derive the checkout revision before invoking the dependency graph. A supplied `DESIGN_GUIDE_REVISION` must match. Both assembly and rendering are noncached so revision changes and references outside package boundaries are always checked. Turbo builds await dependency assembly through the graph; standalone build/dev commands assemble their own dependencies once. Dirty drafts display local source paths; clean builds link to the represented commit. Revision metadata never enters committed catalogs. The graph is guide → design-system → tokens; native renderers remain in their applications. Validated Pencil exports are copied into ignored guide public assets and rendered with descriptive alternative text.

The [protected guide](https://doma-design-guide.vercel.app) runs in the separate `doma-design-guide` Vercel project. Ray authorized publication with the pattern still proposed and its device/accessibility gaps visible. RAY-230 records deployment revisions, signed-out page/asset/preview checks and the separate owner usefulness result. Sign in with an authorized Vercel account. Noindex is indexing guidance, not access control. The guide has no Home rewrite, Clerk integration, navigation registry entry or PWA service worker.

## Publication

Build from a clean, reviewed checkout with the command above. Publish only `.vitepress/dist` as static files, with routes for `/`, `/patterns/` and the extensionless guide pages. Preserve the actual build revision. The project has no Git integration or backend environment variables; publishing is an explicit action.

Before uploading, read back the project's Vercel Authentication scope and require **All Deployments** (`ssoProtection.deploymentType: all`). Standard protection leaves production domains public. Check admitted users, protection exceptions and bypass entries; an authentication scope alone does not establish the intended audience. Do not create shareable bypass links or enable a paid protection add-on. Stop if the required protection is unavailable.

After publishing, enumerate the actual aliases. Use a fresh unauthenticated client to check HTML, a direct illustration, JavaScript and the local-search asset on every production, deployment and preview hostname. Each must require authentication. Then verify the guide, search, navigation and images through an authenticated browser. Record the alias, deployment ID and revision in RAY-230; keep owner usefulness and device checks separate. See [Vercel protection scopes](https://vercel.com/docs/deployment-protection) and [pricing](https://vercel.com/docs/deployment-protection/usage-and-pricing) before future releases.

## Browser smoke checks

After building, run `pnpm --filter design-guide test:browser`. Install Chromium once with `pnpm --filter design-guide exec playwright install chromium` (included by `pnpm ci:local`). The suite owns a separate strict loopback preview on port 3407; it never reuses the owner's port 3007. It checks routes, four decodable annotated example images, keyboard search/recovery navigation, Escape, occupied-port rejection and refusal of non-loopback connections. A non-loopback IPv4 interface is required for the binding check. CI installs Chromium and its Linux dependencies, then runs the suite after the static build. Traces from failures stay in ignored `test-results/`.

`pnpm --filter design-guide preview` still uses port 3007; an optional port argument, for example `preview 3407`, serves the same build. Preview uses Vite's supported API with a fixed loopback host and strict port selection.
