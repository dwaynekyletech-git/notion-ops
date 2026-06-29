#!/usr/bin/env bash
# notion-api.sh — curl wrapper for the Notion public API using the PAT.
#
# Why this exists: `ntn api` is preferred for direct API calls on ntn 0.18.1+.
# This helper remains useful for scripts that need the repo `.env` PAT instead
# of the ntn keychain, a hard 30s network timeout, or an explicit curl fallback.
# The old non-interactive `ntn api v1/databases/{id}` hang was reproduced on
# ntn 0.18.0 but was not reproducible after updating to 0.18.1.
#
# Usage:
#   scripts/notion-api.sh <METHOD> <path> [body]
#     METHOD  GET | POST | PATCH | DELETE   (default GET)
#     path    e.g. v1/databases/<id>  (leading slash optional)
#     body    JSON string, or @file to read from a file (omit for GET/DELETE)
#
# Auth: reads NOTION_API_TOKEN from the environment, or from .env in the repo
# root if unset. Token is never printed.
#
# Examples:
#   scripts/notion-api.sh GET v1/databases/306ffe5c-4f74-8169-9349-eebfecaf9d8c
#   scripts/notion-api.sh POST v1/pages '{"parent":{"database_id":"…"},"properties":{…}}'
#   scripts/notion-api.sh POST v1/pages @body.json
#   scripts/notion-api.sh PATCH v1/pages/<id> '{"archived":true}'

set -euo pipefail

METHOD="${1:-GET}"
PATH_ARG="${2:-}"
BODY="${3:-}"

[ -n "$PATH_ARG" ] || { echo "usage: $0 <METHOD> <path> [body]" >&2; exit 2; }
METHOD="$(printf '%s' "$METHOD" | tr '[:lower:]' '[:upper:]')"
PATH_ARG="${PATH_ARG#/}"  # tolerate a leading slash

# Load the PAT from repo-root .env if not already exported.
if [ -z "${NOTION_API_TOKEN:-}" ]; then
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  if [ -f "$REPO_ROOT/.env" ]; then
    while IFS='=' read -r k v; do
      [ -n "${k:-}" ] || continue
      case "$k" in ''|\#*) continue;; esac
      if [ "$k" = "NOTION_API_TOKEN" ]; then export NOTION_API_TOKEN="$v"; fi
    done < "$REPO_ROOT/.env"
  fi
fi
[ -n "${NOTION_API_TOKEN:-}" ] || { echo "error: NOTION_API_TOKEN not set and not found in .env" >&2; exit 1; }

URL="https://api.notion.com/${PATH_ARG}"
HEADERS=(-H "Authorization: Bearer $NOTION_API_TOKEN" -H "Notion-Version: 2022-06-28")

# Body -> stdout (pure JSON, pipeable to jq). HTTP status -> stderr.
run_curl() {
  local body_file code
  body_file="$(mktemp)"
  code=$(curl -sS -m 30 -X "$METHOD" "$URL" "${HEADERS[@]}" "$@" -o "$body_file" -w '%{http_code}' || true)
  cat "$body_file"
  rm -f "$body_file"
  printf 'http=%s\n' "$code" >&2
}

case "$METHOD" in
  GET|DELETE)
    run_curl
    ;;
  POST|PATCH|PUT)
    [ -n "$BODY" ] || { echo "error: $METHOD requires a body (JSON string or @file)" >&2; exit 2; }
    if [ "${BODY:0:1}" = "@" ]; then
      DATA_FILE="${BODY:1}"
      [ -f "$DATA_FILE" ] || { echo "error: body file not found: $DATA_FILE" >&2; exit 1; }
      run_curl -H 'Content-Type: application/json' --data-binary "@$DATA_FILE"
    else
      run_curl -H 'Content-Type: application/json' --data "$BODY"
    fi
    ;;
  *)
    echo "error: unsupported method '$METHOD'" >&2; exit 2 ;;
esac
