# Doma token proof

Canonical values live in `source/`; `profile.json` selects explicit web/Android sets and the two adopted roles. The [vendored DTCG 2025.10 schema](schema/README.md), Ajv and the narrower profile reject unsupported types/conversions, alias errors and identifier collisions before Style Dictionary 5.7.1 resolves aliases. Custom adapters produce resolved CSS/sRGB, Kotlin/ARGB and the desired Pencil variable manifest. CSS aliases are resolved, so no emitted variable depends on an absent foundation.

```sh
pnpm --filter @repo/tokens generate
pnpm --filter @repo/tokens check
pnpm --filter @repo/tokens test
```

Only `generate` writes committed outputs. `check` and `build` render expected contents in memory and compare every allowlisted file and directory, without repairing stale/missing/extra artifacts. Generation also refuses unexpected artifacts. Tests use disposable canonical storage to demonstrate independent web/Android color and gap propagation, desired Pencil changes, and an unchanged real baseline.

`tokens.css` imports the additive generated CSS. Existing exports and handwritten variables retain their meanings and values. Only active item title color and row gap in Svelte Lists consume the new variables. Web gap also separates adjacent row children. Glance consumes committed Kotlin scalars through a Gradle source set, with conversion to Color and dp at the native boundary. Only item title color and marker-to-title start padding adopt them; Gradle never invokes Node. Android px-to-dp is logical layout policy, not physical device pixels or typography sizing.

`generated/pencil/variables.json` lists managed names/types/values, source role and platform, and the dedicated target document. It is desired state only. The installed Pen 1.2.20 adapter has now demonstrated live apply/save/reopen, preserved unrelated data, independent platform changes and restored values. `pencil:prepare` prints a supported API snippet; it does not apply, save or export by itself. See [Pencil proof maintenance](../../design/README.md) for the explicit live procedure and evidence boundary. No historical Pencil variables are rebound. The List pattern remains proposed until maintainer review.
