# ntn — Notion CLI cheatsheet

Quick copy-paste recipes. The CLI is self-documenting; when in doubt:

```bash
ntn <command> --help
ntn api ls                       # list every public API endpoint
ntn api <path> --help            # methods + usage for an endpoint
ntn api <path> --docs            # full official docs for an endpoint
ntn api <path> --spec            # reduced OpenAPI fragment (schemas)
```

## Auth & health

```bash
ntn doctor                       # health + auth check (run after install/login)
ntn whoami                       # authenticated user/bot + workspace
ntn login                        # browser-based login (only if no token)
ntn logout
ntn update                       # upgrade ntn to latest
```

Env overrides (rarely needed — keychain auth is used by default):

| Var | Purpose |
| --- | --- |
| `NOTION_API_TOKEN` | Integration token; overrides keychain |
| `NOTION_KEYRING=0` | Use file-based auth (`~/.config/notion/auth.json`) instead of OS keychain |
| `NOTION_WORKSPACE_ID` | Override the default workspace |
| `NOTION_WORKERS_CONFIG_FILE` | Path to a `workers.json` (overrides CWD lookup) |

## Pages (Markdown)

```bash
ntn pages get <page-id>                       # read a page as Markdown (+ frontmatter)
ntn pages get <page-id> --json                # raw JSON (use if Markdown is truncated)
ntn pages create --content '# Title\n\nBody'  # create from inline markdown
ntn pages create --parent page:<id> < page.md # create under a parent page
ntn pages create --parent data-source:<id> < row.md   # create a DB row
ntn pages edit <page-id> --content '...'      # replace page body
ntn pages edit <page-id> < page.md            # replace body from file
ntn pages trash <page-id>                     # trash a page
```

Parent formats: `page:<id>`, `database:<id>`, `data-source:<id>`.
For properties/templates/full surface, use `ntn api v1/pages`.

## Data sources (databases)

> A database can hold multiple data sources. `query` needs a **data source ID**,
> not a database ID.

```bash
ntn datasources resolve <database-id> --json                # DB -> data source IDs
ntn datasources query <data-source-id> --limit 50 --json    # list rows
ntn datasources query <id> --filter '{"property":"Done","checkbox":{"equals":true}}'
```

**MCP ↔ ntn ID format:** CRM reference tables use `collection://UUID`. Strip the
`collection://` prefix for `ntn`.

```bash
# MCP format (from where-to-find-data skill):
collection://2dbffe5c-4f74-81cb-9b53-000b23acf6c0

# ntn format:
ntn datasources query 2dbffe5c-4f74-81cb-9b53-000b23acf6c0 --limit 10 --json
```

## Direct API — `ntn api`

Method is inferred (GET by default, POST when a body is present). Override with
`-X`.

```bash
# GET with query param
ntn api v1/users page_size==100

# POST with inline body fields (path=value / path:=json)
ntn api v1/pages parent[page_id]=abc123
ntn api v1/pages properties[title]=Hello children[][paragraph][rich_text][0][text][content]=Hi

# POST with JSON body
ntn api v1/pages -d '{"parent":{"page_id":"abc123"},"properties":{"title":{"title":[{"text":{"content":"Hi"}}]}}}'

# Search
ntn api v1/search -d '{"query":"Ecosystem","page_size":20}'
```

Input syntax precedence: `path:=json` > `name==value` > `Header:Value` > `path=value`.
Use `:=` for numbers/booleans/arrays/objects/null; use `=` to store a JSON string.

## File uploads

```bash
ntn files create < image.png                                     # upload bytes (multipart)
ntn files create --filename photo.png --content-type image/png < /tmp/blob
ntn files create --external-url https://example.com/photo.png    # external URL upload
ntn files list
ntn files get <upload-id>
```

`files list` currently returns only the first page (no pagination yet).

## Workers

```bash
ntn workers new <dir> --git               # scaffold a new worker project
ntn workers deploy                        # deploy from CWD (create or update)
ntn workers ls                            # list workers in workspace
ntn workers get <id>                      # get a worker by id
ntn workers delete <id>                   # delete a worker (alias: rm)

ntn workers capabilities ls <worker>      # list a worker's capabilities
ntn workers exec <capability-key>         # execute a capability (-d JSON or stdin)
ntn workers exec <key> --stream           # stream output
ntn workers exec <key> --local            # run locally

ntn workers sync status                   # sync states for a worker
ntn workers sync trigger <capability>     # run a scheduled sync now (bypass schedule)
ntn workers sync pause <capability>       # pause / resume / state

ntn workers env set KEY=value             # set env var(s) for a worker
ntn workers env ls                        # list env vars
ntn workers env pull                      # remote env -> local .env
ntn workers env push                      # local .env -> remote env

ntn workers usage                         # current-period AI credit usage
ntn workers oauth                         # manage OAuth connections
ntn workers webhooks                      # manage webhook capabilities
ntn workers runs                          # manage worker runs
ntn workers tui                           # interactive terminal UI
```

A worker project is created with `ntn workers new` and typically contains a
`workers.json` (config + capabilities) and capability source. Use
`--workers-config-file <path>` to target a specific config outside the CWD.
