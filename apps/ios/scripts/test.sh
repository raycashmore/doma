#!/usr/bin/env bash
# Runs the app-hosted tests serially with strict warnings, as CI does, and prints only what needs
# reading: compile errors and warnings, failed tests, test-host crashes and the counts. The full log
# stays on disk. Extra arguments go to xcodebuild, for example -only-testing:DomaTests/HomeWidgetBoardTests.
# Skips LiveListsContractTests (scripts/test-live.sh runs it) and SceneCoverTests, which crashes the
# test host on the local iOS 27.2 simulator but passes in CI (RAY-289).
# Usage: scripts/test.sh [xcodebuild arguments]
set -uo pipefail

ios_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$(mktemp -d "${TMPDIR:-/tmp}/doma-ios-test.XXXXXX")"
log="$out_dir/test.log"
result="$out_dir/tests.xcresult"

cd "$ios_dir"
DOMA_STRICT_WARNINGS=YES xcodebuild test -project Doma.xcodeproj -scheme Doma \
  -destination "${DOMA_IOS_DESTINATION:-$(scripts/simulator-destination.sh)}" \
  -skip-testing:DomaTests/LiveListsContractTests -skip-testing:DomaTests/SceneCoverTests \
  -parallel-testing-enabled NO -resultBundlePath "$result" DOMA_STRICT_WARNINGS=YES "$@" >"$log" 2>&1
status=$?

grep -E 'error:|warning:|✘|Restarting after unexpected exit' "$log" | grep -v '^ld: warning' | sort -u
sed -n '/^Failing tests:/,/^$/p' "$log"
[[ -d "$result" ]] && scripts/report-test-results.py "$result"
echo "Full log: $log"
if [[ $status -eq 0 ]]; then echo "TEST SUCCEEDED"; else echo "TEST FAILED"; fi
exit $status
