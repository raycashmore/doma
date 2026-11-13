#!/usr/bin/env bash
# Fails unless the app and the widget both compile the generated tokens. DomaColor reads them in
# each, and a dropped build entry shows up only as a build error, or not at all in one target.
set -euo pipefail

project="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Doma.xcodeproj/project.pbxproj"

python3 - "$project" <<'PY'
import re, sys

text = open(sys.argv[1]).read()
reference = re.search(r"(\w+) /\* DomaTokens\.swift \*/ = \{isa = PBXFileReference;[^}]*generated/ios/DomaTokens\.swift", text)
if not reference:
    sys.exit("project.pbxproj has no file reference to packages/tokens/generated/ios/DomaTokens.swift")
build_files = re.findall(r"(\w+) /\* DomaTokens\.swift in Sources \*/ = \{isa = PBXBuildFile; fileRef = " + reference.group(1), text)
for target in ("Doma", "DomaWidget"):
    phase = re.search(r"/\* %s \*/ = \{\s*isa = PBXNativeTarget;.*?buildPhases = \((.*?)\);" % target, text, re.S)
    sources = re.search(r"(\w+) /\* Sources \*/", phase.group(1)) if phase else None
    body = re.search(sources.group(1) + r" /\* Sources \*/ = \{.*?files = \((.*?)\);", text, re.S) if sources else None
    if not body or not any(build_file in body.group(1) for build_file in build_files):
        sys.exit(f"{target} does not compile DomaTokens.swift; add it to the target's Sources phase")
PY
