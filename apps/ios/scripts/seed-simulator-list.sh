#!/usr/bin/env bash
# Creates a made-up personal list on the local Convex backend for checking Lists in the simulator:
# a select property with AI categorisation set up, a date and a checkbox property, and items with
# and without values. Property definitions are web-only, so the app cannot make this list itself.
# Refuses anything but a local backend. Needs `pnpm convex` running. Prints the list's name.
set -euo pipefail

scripts_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$scripts_dir/../../.." && pwd)"
convex_url="$(grep -E '^VITE_CONVEX_URL=' "$repo_root/.env.local" | head -1 | cut -d= -f2-)"

if [[ "$convex_url" != http://127.0.0.1:* && "$convex_url" != http://localhost:* ]]; then
  echo "Refusing: VITE_CONVEX_URL in .env.local is not a local Convex backend." >&2
  exit 1
fi

identity="{\"subject\":\"$("$scripts_dir/dev-test-user-id.sh")\",\"issuer\":\"dev\"}"
name="Simulator list $(date +%H%M%S)"

cd "$repo_root/packages/convex"
run() { npx convex run --identity "$identity" "$1" "$2" 2>/dev/null; }
field() { python3 -c "import json,sys; print(json.load(sys.stdin)$1)"; }

list="$(run lists/mutations:createList "{\"name\":\"$name\",\"visibility\":\"personal\"}" | field "['publicId']")"
property() { run lists/mutations:createListProperty "{\"listPublicId\":\"$list\",$1}" | field "['_id']"; }
section="$(property '"name":"Section","type":"select","options":[{"id":"produce","label":"Produce"},{"id":"dairy","label":"Dairy"},{"id":"bakery","label":"Bakery"}]')"
due="$(property '"name":"Needed by","type":"date"')"
urgent="$(property '"name":"Urgent","type":"checkbox"')"
run lists/mutations:setListPropertyCategorisation \
  "{\"propertyId\":\"$section\",\"instruction\":\"Sort groceries by supermarket section\"}" >/dev/null

run lists/mutations:createListItems \
  "{\"listPublicId\":\"$list\",\"titles\":[\"Carrots\",\"Milk\",\"Sourdough\",\"Bananas\",\"Yoghurt\",\"Batteries\"]}" >/dev/null
ids=($(run lists/queries:getVisibleListItemsByPublicId "{\"publicId\":\"$list\"}" |
  python3 -c "import json,sys; print(' '.join(i['_id'] for i in json.load(sys.stdin)['activeItems']))"))

set_value() {
  run lists/mutations:setListItemPropertyValue "{\"itemId\":\"$1\",\"propertyId\":\"$2\",\"value\":$3}" >/dev/null
}
tomorrow=$(( ($(date +%s) + 86400) * 1000 ))
set_value "${ids[0]}" "$section" '{"type":"select","optionId":"produce"}'
set_value "${ids[1]}" "$section" '{"type":"select","optionId":"dairy"}'
set_value "${ids[2]}" "$section" '{"type":"select","optionId":"bakery"}'
set_value "${ids[3]}" "$section" '{"type":"select","optionId":"produce"}'
set_value "${ids[1]}" "$due" "{\"type\":\"date\",\"date\":$tomorrow}"
set_value "${ids[1]}" "$urgent" '{"type":"checkbox","checked":true}'
set_value "${ids[2]}" "$urgent" '{"type":"checkbox","checked":false}'

echo "$name"
