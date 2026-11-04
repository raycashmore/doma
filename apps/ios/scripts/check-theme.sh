#!/usr/bin/env bash
# Fails when a screen sets its own font or colour. They belong in DomaFont and DomaColor, so
# Dynamic Type, Bold Text and dark mode stay handled, and generated tokens can replace them.
set -euo pipefail

app="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Doma"

fonts="$(grep -rnE '\.custom\(|UIFont\(name:' "$app" --include='*.swift' --exclude='DomaFont.swift' || true)"
colours="$(grep -rnE '0x[0-9A-Fa-f]{6}\b|"#[0-9A-Fa-f]{6}"|(UI)?Color\(red:' "$app" --include='*.swift' --exclude='DomaColor.swift' || true)"

if [[ -n "$fonts$colours" ]]; then
  echo "Use domaFont(_:) and DomaColor instead of literal fonts and colours:" >&2
  printf '%s\n%s\n' "$fonts" "$colours" | sed '/^$/d' >&2
  exit 1
fi
