# Doma iOS app

A native SwiftUI app for iPhone and iPad (iOS 27 or newer). It is an independent
Xcode project, not a pnpm workspace package or a Vercel deployment zone. So far it
covers sign-in and Lists: see visible lists, open one, check and uncheck items, with
changes arriving live from Convex. Face ID (or the device passcode) unlocks it on
every cold launch and after 5 minutes in the background. The lock covers the
interface only: the Clerk session stays stored while locked. A device without a
passcode cannot authenticate, so the app does not lock there.

## Layout

- `Doma/`: the app target (SwiftUI views and the session that links Clerk to Convex).
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
   production Convex URL, the production Clerk publishable key (`pk_live_`) and your
   personal team ID. These values apply to device builds only; simulator builds
   keep using `Local.xcconfig`.
2. Before the first production sign-in, check the production Clerk instance. It
   must allowlist `com.doma.app://callback`; the app always uses this redirect,
   even if `DOMA_BUNDLE_ID` is overridden. Its `convex` JWT template must match the
   production Convex `CLERK_JWT_ISSUER_DOMAIN`, and native applications must be
   enabled for it.
3. In Xcode, add your Apple ID under Settings > Apple Accounts.
4. Connect the device by cable, unlock it and choose Trust This Computer. Turn on
   Settings > Privacy & Security > Developer Mode and restart when asked.
5. Select the device as the run destination and run the `Doma` scheme. If Xcode
   reports that `com.doma.app` is unavailable to your team, set `DOMA_BUNDLE_ID` in
   `Device.xcconfig` to an identifier you own.
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
`platform=iOS Simulator,name=iPhone 18 Pro,OS=27.2`.

ConvexMobile forwards subscription updates through a pass-through publisher:
attach a subscriber before triggering a change, or the update is lost.
