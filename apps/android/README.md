# Doma Android companion

This is an independent Kotlin/Gradle Android project. It intentionally is not a
pnpm workspace package or a Vercel deployment zone.

## Local configuration

Copy `config.example.properties` to `local.properties` and supply the Doma
Convex deployment URL, Clerk publishable key, and the production Lists PWA base
URL (for example, `https://doma.example.com/lists`). Do not commit
`local.properties`, `google-services.json`, signing keys, or service-account
credentials. Firebase configuration is also local: application ID, project ID,
Web API key, and sender ID. These are public client identifiers, unlike the
Firebase service account used by Convex.

The companion requires JDK 17, Android SDK platform 37, and Android API 26 or
newer. Use the checked-in Gradle wrapper from this directory:

```sh
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
```

The release artifact is unsigned until the later sideload-release work adds the
local signing configuration.

## Widget setup

Add the **Doma list** widget from the Android launcher. Its configuration flow
uses the native Google account prompt, then presents only the Lists visible to
that Doma account. Each widget instance stores an independent list selection and
an encrypted last successful snapshot. The rendered widget shows the list name,
active count, ordered active titles, and a compact freshness label; it is
resizable and scrollable. Tapping it opens the selected list in the configured
Lists PWA.

The native Google prompt requires the Android application's Google client to be
registered in the Clerk Dashboard before the first real-device sign-in. Keep
Clerk restricted to approved accounts; the companion calls the non-transferable
sign-in flow and does not offer sign-up.

## Refresh

After the first configured widget, the companion registers its encrypted
installation ID and current FCM token with Convex. An opaque FCM invalidation
refreshes all configured snapshots; a 15-minute WorkManager job is the fallback
when delivery is delayed. Neither message contains list content or an
identifier. The last successful encrypted snapshot remains visible while an
ordinary refresh fails.

## Authentication

`DomaClerkConvexAuthProvider` is the narrow Convex `AuthProvider` adapter. It
requests Clerk tokens using Doma's explicit `convex` JWT template and never
persists or logs a token. Before a release, sign into Doma staging and call
`lists/widget:getSnapshot` to prove the configured Clerk issuer and audience are
accepted.
