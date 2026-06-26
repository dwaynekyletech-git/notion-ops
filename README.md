# notion-ops

Dwayne Joseph's dedicated workspace for forward-deployed AI enablement work on
the Notion Developer Platform — Notion Worker, Notion Agent, automations, and
data pipelines — for AGI Ventures Canada.

This repo is the home for **scripts, workers, sync jobs, and runbooks** that
operate on the AGIVC Notion workspace. It complements the interactive Notion
MCP tools (used inside Cursor/Claude) with reproducible, version-controlled
command-line and worker-based operations.

---

## What this workspace is for

Per the Internal Contractor Agreement (effective June 17, 2026), the scope of
work centers on:

- **Building on the Notion Developer Platform** — Notion Worker and related
  automations.
- **Data pipelines** between Notion and external systems (Snowflake, Salesforce,
  Gmail, Google Workspace, etc.).
- **Automating internal workflows** using Notion, Notion Agent, Notion Worker,
  and related tooling so the AGIVC team operates efficiently.
- **Forward-deployed AI enablement** for customers — hands-on implementation,
  strategy, and education.
- **Educational content** — e.g. a video explaining how to use Notion Worker to
  build a data sync between an external system and Notion.
- **Technical documentation, implementation notes, and enablement materials**
  to support deliverables.

> **IP & confidentiality note (from the contract):** Deliverables and
> Company Pre-Existing IP belong to AGI Ventures Canada. Do **not** commit
> client Confidential Information, raw CRM exports containing personal data,
> credentials, or third-party IP to this repo. Keep this repo to **tooling,
> code, and runbooks** — not data. See `docs/compliance.md`.

---

## Tooling: three layers of Notion access

This workspace uses three complementary ways to reach Notion. Pick the right
layer for the job.

| Layer | Tool | Best for |
| --- | --- | --- |
| **Interactive (in-editor)** | Notion MCP server + biz-ops skills | Ad-hoc reads/writes, page edits, CRM lookups while pairing in Cursor |
| **Command line** | Notion CLI (`ntn`) | Scripted bulk ops, CI, file uploads, raw API calls, worker management |
| **Always-on automation** | Notion Workers (`ntn workers`) | Scheduled syncs, event-driven automations, deployed capabilities |

### 1. Notion MCP (interactive)

The Notion MCP server is enabled in Cursor and exposes tools like
`notion-fetch`, `notion-search`, `notion-create-pages`, `notion-update-page`,
`notion-move-pages`, `notion-query-data-sources`, and `notion-update-data-source`.

Best practices and gotchas (serialization bug, fetch-before-each-update,
`collection://` vs raw UUID, etc.) are documented in:
`~/.claude/skills/notion-mcp/SKILL.md`.

The biz-ops **skills** layer sits on top of the MCP server:

| Skill | Purpose |
| --- | --- |
| `find` | Locate pages/databases by title keywords (precise matches) |
| `search` | Keyword/natural-language search across the workspace |
| `create-database-row` | Insert a DB row from natural-language property values |
| `create-task` | Create a task in the Notion tasks DB with sensible defaults |
| `create-page` | Create a page, structured by type (meeting notes, project, etc.) |
| `knowledge-capture` | Turn a conversation into a structured Notion doc |
| `meeting-intelligence` | Gather context, enrich, produce pre-read + agenda in Notion |
| `research-documentation` | Synthesize findings across Notion into cited docs |
| `spec-to-implementation` | Break a spec into Notion tasks with acceptance criteria |
| `tasks-build` | Build a task from a Notion URL (fetch → implement → update status) |
| `tasks-plan` | Implementation plan from a Notion task/spec |
| `tasks-setup` | Set up a Notion task board (template or existing) |
| `tasks-explain-diff` | Generate a Notion doc explaining code changes |

### 2. Notion CLI — `ntn` (command line)

`ntn` is installed at `~/.local/bin/ntn` (v0.17.x) and authenticated to
**Codename Dwayne's Workspace** (default workspace). Verify any time:

```bash
ntn doctor        # health + auth check
ntn whoami        # authenticated user/bot + workspace
```

Why use `ntn` over MCP for scripted work:

- Reproducible commands you can put in a script or cron job.
- **File uploads** (`ntn files`) — not exposed by MCP.
- **Worker management** (`ntn workers`) — deploy, run, sync, env, OAuth.
- **Direct API access** (`ntn api`) — every public endpoint, with inline
  query/body syntax and `--docs`/`--spec` lookups.
- Markdown-first page read/write (`ntn pages get/create/edit`).

**MCP ↔ `ntn` ID format gotcha:** MCP and the CRM reference tables use
`collection://UUID`. `ntn` expects the raw UUID (drop the `collection://`
prefix). To resolve a database ID to its data source ID:

```bash
ntn datasources resolve <database-id> --json
ntn datasources query <data-source-id> --limit 50 --json
```

Full CLI guidance: `~/.claude/plugins/.../skills/notion-cli/SKILL.md` (also
referenced from `docs/ntn-cheatsheet.md` here).

### 3. Notion Workers — `ntn workers` (deployed automation)

Workers are the always-on layer — scheduled or event-driven capabilities
deployed to Notion's runtime. This is the core of the "build on the Notion
Developer Platform" scope.

```bash
ntn workers new my-sync --git            # scaffold a new worker project
cd my-sync && ntn workers deploy         # deploy (create or update)
ntn workers ls                           # list workers in the workspace
ntn workers exec <capability-key>        # execute a capability ad hoc
ntn workers sync status                  # sync states for a worker
ntn workers sync trigger <capability>    # run a scheduled sync now
ntn workers env set KEY=value            # manage worker env vars
ntn workers usage                        # current-period AI credit usage
ntn workers tui                          # interactive terminal UI
```

Standard layout for workers in this repo:

```
workers/
  <worker-name>/        # one folder per worker (created via `ntn workers new`)
    workers.json        # worker config + capabilities
    src/                # capability code
```

---

## Where the data lives (biz-ops map)

**Before querying any Notion database, read the canonical CRM map:**
`~/.claude/plugins/.../skills/where-to-find-data/SKILL.md`.

That skill is the **single source of truth** for database URLs and data source
IDs. Never guess an ID — they look similar but are unique, and guessing
produces "Invalid Data Source URL" failures.

A snapshot of the most-used data sources (always verify against the live skill):

| Database | URL | Data source ID (creation) |
| --- | --- | --- |
| Opportunities | `…/2dbffe5c4f7481b8a0c8ceb7a6d0f30e` | `collection://2dbffe5c-4f74-81cb-9b53-000b23acf6c0` |
| Contacts | `…/2dbffe5c4f74812f8711cba5079053a8` | `collection://2dbffe5c-4f74-8107-aafa-000b3c6b869e` |
| Companies | `…/2dbffe5c4f7481d2815cde1959ba73a2` | `collection://2dbffe5c-4f74-81ce-9ac3-000b96f82073` |
| Meetings | `…/2e1ffe5c4f7480eca457cd2147a987ba` | `collection://2e1ffe5c-4f74-80b7-9128-000b1cf00c30` |
| Deliverables | `…/2f4ffe5c4f748080b246f89fa339e991` | `collection://2f4ffe5c-4f74-804c-9c54-000b4f2052c9` |
| Revenue Tasks (FDE) | `…/847aa7ed358d4873a3c1f727b16a8731` | `collection://702ea0e8-44ff-4f79-9100-835bae9cdeb7` |
| Docs | `…/2dbffe5c4f74812ca415e1a6f952edeb` | `collection://2dbffe5c-4f74-8129-be61-000b55ddacf8` |
| Emails | `…/218fa0876eec414ea00b0c31145a3a87` | `collection://9fda0d3b-8d55-4145-b2d6-478b1cb980b4` |
| Contractor Contracts | `…/6118fdc71aae4d3184a32a306239baaa` | `collection://bd8af39e-2203-4b5e-b2b2-26ff71102094` |

The full list (Lessons Learned, Pitches, Sprints, Goals, Ideas, Product SKUs,
Content Calendar, Candidates, Public Workshops, Projects, etc.) plus the CRM
relationship graph and enrichment guardrails is in the skill and mirrored in
`docs/data-map.md`.

---

## Repository layout

```
notion-ops/
├── README.md              # you are here
├── .gitignore
├── docs/
│   ├── ntn-cheatsheet.md  # copy-paste recipes for the CLI
│   ├── data-map.md        # condensed CRM map (mirror of the live skill)
│   └── compliance.md      # IP / confidentiality / data-handling rules
├── scripts/               # one-off and reusable shell scripts
│   └── lib/               # shared helpers (ID resolution, logging)
└── workers/               # deployed Notion Workers (one folder each)
```

---

## One-time setup

`ntn doctor` confirms the CLI is authenticated, but **each database/page you
want to read or write must also be shared with the "Notion CLI" integration**.
Until a resource is shared, `ntn` returns
`object_not_found / Could not find database … Make sure the relevant pages and
databases are shared with your integration "Notion CLI"`.

To share a database (or page) with the integration:
1. Open it in Notion.
2. `•••` menu → **Connections** → **Add connections** → search **Notion CLI** →
   **Confirm**.
3. Repeat for any parent page whose children you need to enumerate.

Do this once for the CRM databases you'll touch (Opportunities, Contacts,
Companies, Meetings, Deliverables, etc.). Bulk sharing can be done from a
top-level workspace/teamspace page and cascaded to children.

## Quick start

```bash
# 1. Confirm auth
ntn doctor

# 2. Read a page as markdown (page must be shared with the integration)
ntn pages get <page-id>

# 3. Query a CRM data source (remember: raw UUID, no collection:// prefix)
ntn datasources query 2dbffe5c-4f74-81cb-9b53-000b23acf6c0 --limit 10 --json

# 4. Scaffold a worker
ntn workers new workers/gmail-to-notion-sync --git

# 5. Hit any public API endpoint directly
ntn api v1/users page_size==100
ntn api v1/search -d '{"query":"Ecosystem","page_size":20}'
```

---

## Working agreement reminders

- **Timesheet accuracy** is auditable (Section 6). Log time in AGIVC's current
  timesheet software; this repo is not a substitute.
- **Deliverables are owned by AGIVC** (Section 13). Prefer building reusable
  workers/tools here over one-off scripts that can't be handed back.
- **Company Pre-Existing IP** stays AGIVC property — don't fork it into client
  repos. Keep Client Deliverables and Company Pre-Existing IP separated.
- **Confidential Information** must not be committed here. This repo holds
  tooling and runbooks, not data.
- **AI tools** (including this one) must not retain or transmit Confidential
  Information in violation of the agreement — be deliberate about what context
  you paste into agents.
