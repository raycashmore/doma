#!/usr/bin/env python3
"""Prints an xcresult's test counts and fails when nothing ran or anything was skipped.

xcodebuild -quiet prints nothing on success, and the live suite skips itself when its
environment is missing, so exit 0 alone does not prove the live contract was exercised.
"""
import json
import subprocess
import sys

summary = json.loads(
    subprocess.check_output(
        ["xcrun", "xcresulttool", "get", "test-results", "summary", "--path", sys.argv[1]],
        stderr=subprocess.DEVNULL,
    )
)
total = summary.get("totalTestCount", 0)
passed = summary.get("passedTests", 0)
failed = summary.get("failedTests", 0)
skipped = summary.get("skippedTests", 0)
print(f"{total} tests: {passed} passed, {failed} failed, {skipped} skipped")
if total == 0 or skipped > 0:
    sys.exit("Refusing to pass: tests were skipped or none ran.")
