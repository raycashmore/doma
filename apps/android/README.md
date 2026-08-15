# Doma Android companion

This is an independent Kotlin/Gradle Android project. It intentionally is not a
pnpm workspace package or a Vercel deployment zone.

## Local configuration

Copy `config.example.properties` to `local.properties` and supply the Doma
Convex deployment URL and Clerk publishable key. Do not commit
`local.properties`, `google-services.json`, signing keys, or service-account
credentials.

The companion requires JDK 17, Android SDK platform 37, and Android API 26 or
newer. Use the checked-in Gradle wrapper from this directory:

```sh
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
```

The release artifact is unsigned until the later sideload-release work adds the
local signing configuration. The current foundation has no widget UI or Firebase
delivery code.

## Authentication

`DomaClerkConvexAuthProvider` is the narrow Convex `AuthProvider` adapter. It
requests Clerk tokens using Doma's explicit `convex` JWT template and never
persists or logs a token. Before a release, sign into Doma staging and call
`lists/widget:getSnapshot` to prove the configured Clerk issuer and audience are
accepted.
