# Doma iOS app

A native SwiftUI app for iPhone and iPad (iOS 27 or newer). It is an independent
Xcode project, not a pnpm workspace package or a Vercel deployment zone. So far it
covers sign-in, the Home noticeboard and Lists, in two tabs; it opens on Home. Lists covers: create, rename, delete and reorder lists (each person keeps their own
order), set the default list and the Groceries list (where recipe ingredients and Paprika items go; until one is
chosen, the shared list named "Shopping list"), add, check off, reorder and delete items, clear completed ones, and edit an item's title, notes
and property values, with changes arriving live from Convex. Active items can be grouped by a
property (saved per person, as on the web), Auto Categorise sorts Unassigned items, and pasting
several lines into Add an item previews them before adding them all. Submitting text with commas
or line breaks adds one item for each. Each person can connect their own Paprika account (More > Paprika): Doma keeps
Paprika's sign-in token on the server, never the password, and remembers which Paprika grocery list
to bring items from. Once connected, the Groceries list shows Get Paprika Items: one read of
Paprika lists the items still to buy, grouped by recipe, and the ticked ones are added with a
small basket mark and the recipe in their notes. Remove from Paprika is off by default; when turned
on, the imported items are removed from Paprika. Doma remembers every Paprika item it has imported, so none is added twice, even if removing it
from Paprika failed, unless the person shows the items already brought in that are still in Paprika
and ticks one to add it again. Property definitions and AI
categorisation setup are still managed on the web. Destructive actions ask for confirmation, unlike the web app, because the
app writes to the household's real lists. Face ID (or the device passcode) unlocks it on
every cold launch and after 5 minutes in the background. The lock covers the
interface only: the Clerk session stays stored while locked, and after the first unlock the
app stays alive underneath, so an open sheet keeps its unsaved edits. Those edits are lost if iOS
closes the app or its window; they are never written to disk. The lock and the app switcher cover
sit in their own window (`SceneCover`) because sheets present above the app's view tree. While
covered, the app's window is transparent over a backdrop window, because the iPad simulator fades in a
capture of it on return, under the cover. A view added to that window does not stop this. This has
not been checked on a physical iPad. A device
without a passcode cannot authenticate, so the app does not lock there. It reopens on the last list
opened, and iPhone keeps Lists one step back. Lists sit under a dark header, as on the web, with a
Shared / Personal filter; items are added from a capsule at the foot of the list.

## Home noticeboard

Home shows the household board from `home/activeBoard`, as the web Home does: Today's briefing,
Today's Meals, shared notes and forwarded-email and spending notices. Each card shows a little and
opens a detail sheet with the rest. Today is hidden when there is no briefing and nothing later
today, and Meals when neither meal is planned. Notes can be added and edited (they cannot be
deleted), and any card can be archived, which hides it for the whole household. iPad lays the cards
out as a bento with the web board's flex weights and its 1120 px breakpoint (`BoardBentoLayout`), but with
narrower Today and spending cards, so any two share a row on an 11-inch iPad in landscape.
The server reads the clock when the query runs, so the app passes the current minute as `refreshToken` every minute
and on return to the app, so it never reuses a result cached for an older token. Saving a note replaces its title, detail and due date together, as on the
web, so two people editing different fields of one note at once keep only the last save.
Settings, from the Home header, holds Sign out; Lists keeps its own Sign out and Paprika.

## Layout

- `Doma/`: the app target (SwiftUI views and the session that links Clerk to Convex).
  `DomaColor` names each colour role and reads its light and dark values from `DomaTokens`,
  generated from `packages/tokens` (`pnpm --filter @repo/tokens generate`) and compiled into the app
  and the widget from `packages/tokens/generated/ios/`. `DomaFont` and `DomaTheme` are hand-written.
  `Assets.xcassets` holds the app icon and launch assets.
- `Doma/Fonts/`: TTF versions of the web fonts in `packages/tokens/fonts/`, because iOS
  cannot bundle `.woff2`. They are Latin subsets, so other scripts fall back to the system
  font. Merriweather is unpacked unchanged because the OFL reserves its name, so
  `DomaFont` uses its original PostScript names.
- `DomaKit/`: local Swift package with `DomaClerkConvexAuthProvider`,
  `DomaListsClient` (the typed wrappers for the Convex Lists functions), `DomaHomeClient` (the board,
  notes and archive), `DomaConfiguration`
  and `DomaConvexHTTPQuery`, which runs one query over HTTP for the widget.
- `DomaWidget/`: the widget extension, with the Home and List widgets. It shares the app's Clerk session
  through the keychain access group in `Config/Doma.entitlements`, so it needs no sign-in of its
  own, and reads Convex with `DomaConvexHTTPQuery`. `Config/Signed.xcconfig` applies the
  entitlements to the app and the widget. It compiles `DomaColor`, `DomaFont` and the fonts from
  `Doma/` through a membership exception in the project file.
- `DomaTests/`: app-hosted tests. They need the app host because Clerk stores its
  session in the keychain, which plain package tests in the simulator cannot reach.
- `Config/`: build settings. Public client values go in the ignored `Local.xcconfig`
  (simulator) and `Device.xcconfig` (physical devices).

## Home widget

Small, medium and Lock Screen sizes show the Board from `home/widgetSummary`: today's next timed event
(clock time first, then a live countdown), the rest of this week as many rows as fit (today's by
time, later ones by day name, so titles keep the room), the Groceries list's count and the top note. A tile with nothing to say hides and the others
take its space; with nothing at all it says "All clear". `DomaHomeWidgetBoard` decides which tiles
show in each size. Next and This week open Apple Calendar (a widget link always opens Doma, so it links to `com.doma.app://calendar` and Doma passes that on); the list opens
that list, and the note opens its card on Home (`com.doma.app://home/<board item id>`).

One fetch makes a timeline with an entry at each event's start and end and at each midnight, so
finished events leave and tomorrow's first event becomes Next without another fetch. It refreshes like the List
widget below. A rejected sign-in shows "Signed out" and forgets the last summary; only a network
failure reuses it.

Widget gotchas, each learned in the simulator:

- A live countdown is `Text(.currentDate, format: .reference(to: start, allowedFields: [.hour, .minute]))`.
  With the dates the other way round, `Text(start, format: .reference(to: .now))` reads "2 hours ago".
  `.reference` rounds to one unit with long names ("in 1 hour"), and `.offset` gives
  "1 hour, 20 minutes" or "10 hours, 0 minutes"; neither can say "1 hr 20". To see a format's
  output without a build, print `SystemFormatStyle.DateReference(...).format(.now)` with `swift` on
  the Mac.
- `.fixedSize()` on that live Text renders the whole widget black, with no error in the log. Beside
  other views in an `HStack` it takes the full width, so join it into one interpolated `Text`
  instead. Interpolation capitalises it ("In 1 hour · Dancing"); `Text + Text` is deprecated, and
  CI fails on the warning.
- Tiles inset inside the widget use `ContainerRelativeShape`, so their corners stay concentric with
  the widget's on every device; `scripts/check-theme.sh` rejects a fixed `cornerRadius` in
  `DomaWidget/`.

To look at a widget, run `pnpm convex` and `pnpm --filter @repo/convex seed:home` for a busy
week of placeholder events, sign the simulator in (see "Checking the UI in the simulator"), then
place the widget once: long-press an empty part of the Home Screen, press Edit, then Add Widget,
press the "Doma" cell, swipe to the size, press Add Widget, then Done, and leave that page showing.
After each change,
`AGENT_DEVICE=<agent-device command> scripts/widget-shot.sh <bundle id> <out.png>` builds,
installs, waits for the widgets to redraw and takes a screenshot. `agent-device` cannot lock the
simulator, so check Lock Screen sizes on a device.

## List widget

Small, medium and large Home Screen sizes show one list: the default list unless the widget is
edited to choose another. Widgets cannot scroll, so it shows as many active items as fit and then
how many more there are; tapping opens the list in the app (`com.doma.app://lists/<publicId>`).

`DomaWidgetContent` decides what it shows. A sign-in that Clerk or Convex rejects shows "Signed
out" and forgets every list the widgets showed, so an old list never returns. Only a network
failure keeps the last list, marked "Updated … ago"; a list also marks its age once 30 minutes pass
without a refresh.

iOS decides when widgets refresh. The widget asks for one every 15 minutes. The app asks for a
redraw when it leaves the foreground and on sign-out; iOS holds redraw requests made while the app
is open ("Throttling additional refresh request while foreground" in the `chronod` log), so the app
does not follow lists live for the widget. Changes made elsewhere while Doma is closed reach the
widget only on its own refresh until push updates (RAY-258) arrive with the paid developer program.

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

A branch that calls new Convex functions fails on a device until they reach production, and shows
the save-failure alert. Check each new call with `pnpm prod:status <module>.js:<function>` before
installing.

The widget extension needs a second App ID (`<DOMA_BUNDLE_ID>.widget`) under the personal team,
which Xcode registers on the first device build. Builds before the shared keychain group kept the
Clerk session in the app's private keychain, so the first install with it asks for sign-in once.

## Authentication

`DomaClerkConvexAuthProvider` requests tokens from Doma's explicit `convex` Clerk
JWT template, as Android does. `clerk-convex-swift` is not used: it requests the
default session token, which lacks the `aud: convex` claim Doma's Convex auth
config requires. Tokens are never persisted or logged.

## Running the tests

```sh
xcodebuild test -project Doma.xcodeproj -scheme Doma \
  -destination "$(scripts/simulator-destination.sh)" \
  -skip-testing:DomaTests/LiveListsContractTests -parallel-testing-enabled NO
```

Run serially: a parallel run can crash the test host and fail unrelated suites, differently each time.
CI also fails on any Swift warning in Doma's own code. To check locally, prefix the command with
`DOMA_STRICT_WARNINGS=YES` and add `DOMA_STRICT_WARNINGS=YES` as a build setting too: the variable
reaches DomaKit, the setting reaches the app targets.
A failure in a suite you did not touch: compare with `main` (`git stash -u`) before chasing it.

## Live contract tests

```sh
apps/ios/scripts/test-live.sh
```

This runs the app-hosted tests in the simulator against the Convex URL in the root
`.env.local` (normally the local `pnpm convex` backend), so contract drift between
Swift and Convex fails a test. It prints the test counts and fails if any test was skipped. It refuses anything but Clerk development keys.
`scripts/mint-test-sign-in-ticket.sh` mints a 10-minute Clerk sign-in ticket for
the development instance's Google-linked user (or `DOMA_IOS_TEST_CLERK_USER_ID`).
The test creates its own personal fixture list, exercises it and deletes it, so
household data is never read into assertions or changed.

Set `DOMA_IOS_DESTINATION` to choose a simulator, for example
`platform=iOS Simulator,name=iPhone 18 Pro,OS=27.2`; otherwise it uses the iPhone 17e, the
household's phone. Check UI on that simulator too.

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

For a list with properties, values and AI categorisation set up, run `scripts/seed-simulator-list.sh`.
Property definitions are web-only, so the app cannot make one.

To exercise the real lock instead, run `agent-device settings faceid enroll` once, then
`agent-device settings faceid match` after launch.

The bundle ID comes from `DOMA_BUNDLE_ID`; `Device.xcconfig` may override it. Confirm the built
app uses a local Convex URL and a `pk_test_` key first, because `Device.xcconfig` also applies
to Debug builds. Reset any changed text size afterwards.

`simulator-sign-in.sh` runs `scripts/check-simulator-target.sh`, which refuses a build aimed at
production. Hold any new sheet open for 2 minutes with unsaved edits: a timed session event once
closed one, and a short walk-through passes by luck. Treat a failure that comes and goes as timed
until the logs say otherwise, and rule a cause out only after a run longer than the interval:

```sh
xcrun simctl spawn booted log show --last 5m --info --debug --predicate 'subsystem == "com.doma.app"'
```

To check a lock or cover change, open a sheet, type a marker word into it, and leave it unsaved. Then
run this on an iPhone and an iPad simulator:

```sh
AGENT_DEVICE=<agent-device command> apps/ios/scripts/check-lock-return.sh <bundle id> <marker>
```

It waits past the 5-minute lock by default, fails if the app restarted, and reads the recording for
the marker showing before the return and for black frames. `check-return-frames.swift` does that
reading, and was checked against recordings of a real leak. The marker must be readable to the
script as you typed it, so use capitals and hyphens.

`agent-device` gotchas:

- Press a menu `Picker` or a `Toggle` by the control's coordinates; a ref press lands mid-row and does nothing.
- `DEVICE_IN_USE` means another thread's session holds the simulator. Do not close it; check another
  device meanwhile. A simulator made with `simctl create` does not appear in the device tools. Tests
  run on a held simulator fail in every suite, so point `DOMA_IOS_DESTINATION` at an idle one.
- `keyboard dismiss` is unsupported, and a target behind the keyboard is refused. Scroll it clear first.
- A snapshot can lag the screen, so take a screenshot before believing a stuck state.
- Refs go stale when the screen changes; take a fresh snapshot before pressing one.
- On iPad, `scroll --until` scrolls the detail column. Reach a sidebar row by swiping inside the sidebar.
- Dragging an iPad sidebar row needs a longer hold than iPhone: `gesture drag <from> <to> 1800 1500 600`.
  The 1200 ms hold that works on iPhone leaves the row in place.
- A press while a menu is still closing is lost. Wait about 1.5 seconds before the next one.
- The simulator can restart mid-run. A new process ID after a lock test means a cold launch, not a re-lock.
- After `main thread execution timed out`, queued `home` and `app-switcher` commands can replay and reopen the app. Wait, then leave the app with `open <another bundle id>`.
- `Runner did not accept connection: this Xcode cannot start its simulator service` while Xcode is current: update macOS to match Xcode and restart. That cleared it once, on macOS 27.0.1 with Xcode 27.2.

Compile tests with `xcodebuild build-for-testing`: `build` alone skips them. The app target
defaults to main-actor isolation, so tests of its types need `@MainActor`.

## Review standards

- Screens use `domaFont(_:)` and `DomaColor`; `scripts/check-theme.sh` enforces this in iOS CI.
- Widget tiles that sit side by side in one row share a height, so their edges line up.
- Screens under the dark header use `domaHeaderedSheet(title:)`, which draws the large title itself. iOS 27
  draws a bar's large title inside the scrolling content, where the sheet's mask hides it, and that title
  ignores the `UINavigationBar` appearance. A `toolbarBackground` colour resolves in the bar's dark
  appearance, so the header colour sits behind a clear bar instead.
- Split columns and sheets report a compact size class even on a full-screen iPad. Read `isSplitLayout`,
  set by `ListsView`, to ask whether Lists shows side by side.
- Text scales with Dynamic Type and honours Bold Text; fixed-size containers around text or
  symbols use `@ScaledMetric`.
- Closures UIKit may call off the main thread, such as dynamic colours, are `nonisolated`: the app target defaults
  to main-actor isolation, and a main-actor closure traps when SwiftUI resolves it during a transition.
  A custom `Layout`'s `LayoutValueKey` and its value type are `nonisolated` for the same reason: `Layout`
  reads them off the main actor, so a main-actor conformance does not compile.
- Controls keep a 44 pt tap target. Rows with `listRowBackground` draw their own selected state.
- The iPad sidebar uses the system sidebar list style and draws no row background, so the system shows
  selection and hardware-keyboard focus as one highlight. A custom row background brings back a separate
  focus ring around the whole cell.
- Session phases pass through `.signedOut` briefly on launch, so sign-out side effects belong
  in `DomaSession`, not on phase changes.
- Clerk reports a session change about once a minute. Anything that rebuilds `ListsView` on
  that event loses open sheets, so `DomaSession.Phase` stays `.signedIn` through a re-login.
- The edit sheet saves one mutation per changed field and only sends what changed there, so a
  failed save can be retried and another person's edit to a different field survives.
- Live queries go through `followLiveQuery`, which logs a failed subscription and resubscribes;
  `scripts/check-live-queries.sh` enforces this in iOS CI. Its failure handler runs only before the
  first value, so a dropped connection keeps the last value on screen.
- An optimistic value stays on screen until the live subscription confirms it, not just until
  the mutation returns, and writes to one record wait for the one before, so quick changes land in order.

## Signing checks

`scripts/check-generated-tokens.sh` fails unless the project compiles
`packages/tokens/generated/ios/DomaTokens.swift` into both the app and the widget; iOS CI runs it.

`scripts/check-project-signing.sh` fails if Xcode has written a team, entitlements file
or literal bundle ID into `project.pbxproj`; iOS CI runs it. To learn whether the free
personal team can sign a capability, run `scripts/probe-entitlement.sh` (for example
`app-group group.<bundle id>`) rather than relying on Xcode's capability screen.

ConvexMobile forwards subscription updates through a pass-through publisher:
attach a subscriber before triggering a change, or the update is lost. It also encodes
Swift integers as int64, which `v.number()` rejects, so numeric arguments go as `Double`.
