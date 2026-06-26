#!/usr/bin/env bash
# Dump the rows of a CRM data source as JSON.
#
# Usage:
#   scripts/dump-data-source.sh <data-source-id-or-collection-url> [limit]
#
# Example:
#   scripts/dump-data-source.sh collection://2dbffe5c-4f74-81cb-9b53-000b23acf6c0 50
#   scripts/dump-data-source.sh 2dbffe5c-4f74-81cb-9b53-000b23acf6c0 50 > opps.json
#
# Source IDs live in docs/data-map.md and the where-to-find-data skill.

source "$(dirname "$0")/lib/common.sh"

ds_id="${1:-}"
limit="${2:-25}"

[[ -n "$ds_id" ]] || die "usage: $0 <data-source-id-or-collection-url> [limit]"
ntn_ready

raw_id="$(strip_collection_prefix "$ds_id")"
log "querying data source $raw_id (limit=$limit)"
ntn datasources query "$raw_id" --limit "$limit" --json
