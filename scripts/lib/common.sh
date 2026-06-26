#!/usr/bin/env bash
# Shared helpers for notion-ops scripts.
# Source from any script in scripts/:  source "$(dirname "$0")/lib/common.sh"

set -euo pipefail

# --- Preflight --------------------------------------------------------------

require_ntn() {
  if ! command -v ntn >/dev/null 2>&1; then
    echo "error: ntn (Notion CLI) is not installed or not on PATH." >&2
    echo "       install with: curl -fsSL https://ntn.dev | bash" >&2
    return 1
  fi
}

# Bail unless the CLI can reach the workspace. Quiet on success.
ntn_ready() {
  require_ntn || return 1
  ntn doctor >/dev/null 2>&1 || {
    echo "error: 'ntn doctor' failed. Run 'ntn login' or set NOTION_API_TOKEN." >&2
    return 1
  }
}

# --- ID format helpers ------------------------------------------------------

# collection://UUID  ->  UUID   (ntn wants the raw UUID; MCP/CRM uses the prefix)
strip_collection_prefix() {
  local id="${1:-}"
  id="${id#collection://}"
  id="${id#view://}"
  printf '%s' "$id"
}

# --- Logging ----------------------------------------------------------------

log()  { printf '[notion-ops] %s\n' "$*"; }
err()  { printf '[notion-ops] error: %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

# --- Output -----------------------------------------------------------------

# Print a Notion data source query as compact JSON.
query_data_source() {
  local data_source_id="$1"; shift
  local raw_id
  raw_id="$(strip_collection_prefix "$data_source_id")"
  ntn datasources query "$raw_id" "$@" --json
}

# Resolve a Notion database ID to its data source IDs (JSON).
resolve_data_source() {
  local db_id="$1"
  ntn datasources resolve "$db_id" --json
}
