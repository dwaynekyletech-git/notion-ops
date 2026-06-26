#!/usr/bin/env bash
# Audit which Notion databases the current integration (NOTION_API_TOKEN / ntn)
# can reach. Prints a table of name | database id | status.
#
# Integrations only see pages/databases explicitly shared with them, AND only
# inside teamspaces that allow integrations. This script probes every database
# listed in docs/data-map.md and reports shared vs not-shared.
#
# Usage:
#   scripts/audit-access.sh                 # load .env automatically if present
#   scripts/audit-access.sh --json          # machine-readable output
#
# Probe: `ntn datasources resolve <db-id>` returns data source IDs when shared,
# and a fast 404 ("shared with your integration ...") when not.

source "$(dirname "$0")/lib/common.sh"

# Load .env if present (gitignored; holds NOTION_API_TOKEN).
if [[ -f "$(dirname "$0")/../.env" ]]; then
  set -a; source "$(dirname "$0")/../.env"; set +a
fi

ntn_ready || die "ntn not ready"

json_mode=0
[[ "${1:-}" == "--json" ]] && json_mode=1

# name|database-id  (from docs/data-map.md / where-to-find-data skill)
DATABASES=(
  "Opportunities|2dbffe5c4f7481b8a0c8ceb7a6d0f30e"
  "Contacts|2dbffe5c4f74812f8711cba5079053a8"
  "Companies|2dbffe5c4f7481d2815cde1959ba73a2"
  "Company Info (AGIVC)|44933df344334963b9842058e9a87be2"
  "Meetings|2e1ffe5c4f7480eca457cd2147a987ba"
  "Lessons Learned|359ffe5c4f7480709eedc6307fe9971e"
  "Docs|2dbffe5c4f74812ca415e1a6f952edeb"
  "Emails|218fa0876eec414ea00b0c31145a3a87"
  "Invoices|bc09dc1adbfa40279ff18beff54bd720"
  "Pitches|2dbffe5c4f7481d5b902dc705ae4fb75"
  "Deliverables|2f4ffe5c4f748080b246f89fa339e991"
  "Contractors|2dbffe5c4f748140990fca536ce6cd57"
  "Contractor Contracts|6118fdc71aae4d3184a32a306239baaa"
  "Applied AI Hours|2f4ffe5c4f74807393e2ebc90348a649"
  "Public Workshops|2dbffe5c4f748165bf3adf7fa0b2063b"
  "Revenue Tasks (FDE)|847aa7ed358d4873a3c1f727b16a8731"
  "Content Calendar|2deffe5c4f74803c9bf1e7403e61b40c"
  "Jobs Description|2feffe5c4f74803fb0a9ee462f3855fb"
  "Candidates|328ffe5c4f74806094c9cb8cd62ba812"
  "Sprints|67e3be48e3b949c49a49e815d4b74861"
  "Product SKUs|2fcffe5c4f748054b992fd61c14c2b9b"
  "Goals|9d114b6cd0e84bd3910c45a0b16fb460"
  "Ideas|2dbffe5c4f7481398ee0f5d86fc3a2cb"
  "Projects|a98ffe5c4f748248b51a81af4141c0b1"
)

probe() {  # <db-id> -> echoes "shared" or "no-access"
  local id="$1" out
  out="$(perl -e 'alarm 20; exec @ARGV' ntn datasources resolve "$id" --json 2>&1 || true)"
  if printf '%s' "$out" | grep -qi 'object_not_found\|shared with your integration\|Could not find'; then
    printf 'no-access'
  else
    printf 'shared'
  fi
}

if [[ $json_mode -eq 1 ]]; then
  printf '['
  first=1
  for row in "${DATABASES[@]}"; do
    name="${row%%|*}"; id="${row##*|}"
    status="$(probe "$id")"
    [[ $first -eq 1 ]] || printf ','
    printf '{"name":"%s","id":"%s","status":"%s"}' "$name" "$id" "$status"
    first=0
  done
  printf ']\n'
else
  printf '%-26s %-40s %s\n' "DATABASE" "ID" "STATUS"
  printf '%-26s %-40s %s\n' "----------" "--" "------"
  shared=0; denied=0
  for row in "${DATABASES[@]}"; do
    name="${row%%|*}"; id="${row##*|}"
    status="$(probe "$id")"
    printf '%-26s %-40s %s\n' "$name" "$id" "$status"
    [[ "$status" == "shared" ]] && shared=$((shared+1)) || denied=$((denied+1))
  done
  echo
  log "shared=$shared  no-access=$denied  total=${#DATABASES[@]}"
fi
