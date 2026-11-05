#!/usr/bin/env bash
# Leaves a 10-minute development sign-in ticket for the next simulator launch of a Debug build.
# The app reads and removes it when no session exists. See "Checking the UI in the simulator".
set -euo pipefail

scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ticket_path=/tmp/doma-ios-sign-in-ticket

"$scripts_dir/check-simulator-target.sh"

(umask 077 && "$scripts_dir/mint-test-sign-in-ticket.sh" >"$ticket_path")
echo "Ticket ready for the next simulator launch."
