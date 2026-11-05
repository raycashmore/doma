# Doma iOS app

A native SwiftUI app for iPhone and iPad (iOS 27 or newer). It is an independent
Xcode project, not a pnpm workspace package or a Vercel deployment zone. So far it
covers sign-in and Lists: create, rename and delete lists, set the default list, add,
check off, reorder and delete items, clear completed ones, and edit an item's title, notes
and property values, with changes arriving live from Convex. Property definitions are
still managed on the web. Destructive actions ask for confirmation, unlike the web app, because the
app writes to the household's real lists. Face ID (or the device passcode) unlocks it on
every cold launch and after 5 minutes in the background. The lock covers the
interface only: the Clerk session stays stored while locked. A device without a
passcode cannot authenticate, so the app does not lock there. It reopens on the last list
opened, and iPhone keeps Lists one step back.

## Layout

- `Doma/`: the app target (SwiftUI views and the session that links Clerk to Convex).
  `DomaColor`, `DomaFont` and `DomaTheme` hold the hand-written theme. `Assets.xcassets`
  holds the app icon and launch assets.
- `Doma/Fonts/`: TTF versions of the web fonts in `packages/tokens/fonts/`, because iOS
  cannot bundle `.woff2`. They are Latin subsets, so other scripts fall back to the system
  font. Merriweather is unpacked unchanged because the OFL reserves its name, so
  `DomaFont` uses its original PostScript names.
- `DomaKit/`: local Swift package with `DomaClerkConvexAuthProvider` and
  `DomaListsClient`, the typed wrappers for the Convex Lists functions.
- `DomaTests/`: app-hosted tests. They need the app host because Clerk stores its
  session in the keychain, which plain package tests in the simulator cannot reach.
- `Config/`: build settings. Public client values go in the ignored `Local.xcconfig`
  (simulator) and `Device.xcconfig` (physical devices).

## Local configuration

Copy `Config/Local.example.xcconfig` to `Config/Local.xcconfig` and supply a
development or staging Convex URL and the matching Clerk publishable key. Never put
a secret key or production values in it. Without it the app shows a "not
configured" screen.

The Clerk instance must allow the redirect URL `com.doma.app://callback` for
Google sign-in. The app signs in only (`transferable: false`), so an unknown Google
account cannot become a sign-up.

Open `Doma.xcodeproj` in Xcode and run the `Doma` scheme on an iOS 27 simulator.

## Install on an iPhone or iPad (free provisioning)

Device builds use the production Convex deployment and the production Clerk
instance. A free Apple ID (personal team) is enough; apps it signs expire after
7 days and must be reinstalled from the Mac.

1. Copy `Config/Device.example.xcconfig` to `Config/Device.xcconfig`. Fill in the
   production Convex URL, the production Clerk publishable key (`pk_live_`), your
   personal team ID and a bundle identifier you own in `DOMA_BUNDLE_ID`
   (`com.doma.app` is not available to a personal team). The Convex and Clerk
   values apply to device builds only; simulator builds keep using `Local.xcconfig`.
   Change these here rather than in Xcode's Signing & Capabilities screen, which
   writes them into the committed project file.
2. Before the first production sign-in, check the production Clerk instance. It
   must allowlist `com.doma.app://callback`; the app always uses this redirect,
   even if `DOMA_BUNDLE_ID` is overridden. Its `convex` JWT template must match the
   production Convex `CLERK_JWT_ISSUER_DOMAIN`, and native applications must be
   enabled for it.
3. In Xcode, add your Apple ID under Settings > Apple Accounts.
4. Connect the device by cable, unlock it and choose Trust This Computer. Turn on
   Settings > Privacy & Security > Developer Mode and restart when asked.
5. Select the device as the run destination and run the `Doma` scheme.
6. On the first install, open Settings > General > VPN & Device Management and
   trust your developer certificate.
7. Repeat step 5 within 7 days to keep the app working.

## Authentication

`DomaClerkConvexAuthProvider` requests tokens from Doma's explicit `convex` Clerk
JWT template, as Android does. `clerk-convex-swift` is not used: it requests the
default session token, which lacks the `aud: convex` claim Doma's Convex auth
config requires. Tokens are never persisted or logged.

## Live contract tests

```sh
apps/ios/scripts/test-live.sh
```

This runs the app-hosted tests in the simulator against the Convex URL in the root
`.env.local` (normally the local `pnpm convex` backend), so contract drift between
Swift and Convex fails a test. It refuses anything but Clerk development keys.
`scripts/mint-test-sign-in-ticket.sh` mints a 10-minute Clerk sign-in ticket for
the development instance's Google-linked user (or `DOMA_IOS_TEST_CLERK_USER_ID`).
The test creates its own personal fixture list, exercises it and deletes it, so
household data is never read into assertions or changed.

Set `DOMA_IOS_DESTINATION` to choose a simulator, for example
`platform=iOS Simulator,name=iPhone 18 Pro,OS=27.2`; otherwise the script picks one.

## Checking the UI in the simulator

Debug simulator builds can reach signed-in screens headlessly; `SimulatorLaunch` is compiled
out of device and release builds. Start `pnpm convex`, then:

1. Run `scripts/simulator-sign-in.sh`, which leaves a one-use development ticket that the next
   launch consumes when no session exists.
2. Launch with the app lock skipped, using one of:

   ```sh
   agent-device open <bundle id> --relaunch --launch-args DOMA_SKIP_APP_LOCK=1
   SIMCTL_CHILD_DOMA_SKIP_APP_LOCK=1 xcrun simctl launch booted <bundle id>
   ```

To exercise the real lock instead, run `agent-device settings faceid enroll` once, then
`agent-device settings faceid match` after launch.

The bundle ID comes from `DOMA_BUNDLE_ID`; `Device.xcconfig` may override it. Confirm the built
app uses a local Convex URL and a `pk_test_` key first, because `Device.xcconfig` also applies
to Debug builds. Reset any changed text size afterwards.

Compile tests with `xcodebuild build-for-testing`: `build` alone skips them. The app target
defaults to main-actor isolation, so tests of its types need `@MainActor`.

## Review standards

- Screens use `domaFont(_:)` and `DomaColor`; `scripts/check-theme.sh` enforces this in iOS CI.
- Text scales with Dynamic Type and honours Bold Text; fixed-size containers around text or
  symbols use `@ScaledMetric`.
- Controls keep a 44 pt tap target. Rows with `listRowBackground` draw their own selected state.
- Session phases pass through `.signedOut` briefly on launch, so sign-out side effects belong
  in `DomaSession`, not on phase changes.
- Clerk reports a session change about once a minute. Anything that rebuilds `ListsView` on
  that event loses open sheets, so `DomaSession.Phase` stays `.signedIn` through a re-login.
- The edit sheet saves one mutation per changed field and only sends what changed there, so a
  failed save can be retried and another person's edit to a different field survives.

## Signing checks

`scripts/check-project-signing.sh` fails if Xcode has written a team, entitlements file
or literal bundle ID into `project.pbxproj`; iOS CI runs it. To learn whether the free
personal team can sign a capability, run `scripts/probe-entitlement.sh` (for example
`app-group group.<bundle id>`) rather than relying on Xcode's capability screen.

ConvexMobile forwards subscription updates through a pass-through publisher:
attach a subscriber before triggering a change, or the update is lost. It also encodes
Swift integers as int64, which `v.number()` rejects, so numeric arguments go as `Double`.
