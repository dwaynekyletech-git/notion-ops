# scripts/

Reusable shell scripts for Notion operations via `ntn`.

## Layout

```
scripts/
├── lib/common.sh            # shared helpers (sourced by other scripts)
├── notion-api.sh            # fallback curl wrapper for PAT + hard-timeout cases
├── dump-data-source.sh      # dump a CRM data source to JSON
└── ...                      # add more here as the work grows
```

## Conventions

- Each script sources `lib/common.sh` for `ntn_ready`, `strip_collection_prefix`,
  `log`/`err`/`die`, and `query_data_source`.
- Scripts accept `collection://UUID` **or** raw UUID inputs (the helper strips
  the prefix) so they work with IDs copied straight from `where-to-find-data`.
- Prefer emitting JSON (`--json`) so output is pipeable into `jq` or files.

## Writing a new script

```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib/common.sh"
ntn_ready

ds="${1:-}"
[[ -n "$ds" ]] || die "usage: $0 <data-source-id>"
query_data_source "$ds" --limit 10
```

## Examples

```bash
# Dump first 50 opportunities to JSON
scripts/dump-data-source.sh collection://2dbffe5c-4f74-81cb-9b53-000b23acf6c0 50 > opps.json

# Resolve a database ID to its data source IDs
ntn datasources resolve 2dbffe5c4f7481b8a0c8ceb7a6d0f30e --json

# Read a page as markdown
ntn pages get <page-id>

# Direct REST API via ntn
ntn api v1/databases/<id> | jq '.properties | keys'
```
