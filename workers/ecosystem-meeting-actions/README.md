# Ecosystem Meeting Actions Worker

Watches the **Ecosystem Notes** database (in the Ecosystem teamspace) for
meeting notes and turns each into action items in the **Ecosystem Tasks**
database, with reasoning billed to your **Cursor credits**.

## How it works

1. A scheduled sync polls Ecosystem Notes for rows where `Type = "Meeting Notes"`
   **and** the **"Actions Processed"** checkbox is unchecked.
2. The note's content is sent to a **Cursor Cloud Agent** (no repo, no MCP —
   pure reasoning, **Cursor credits**) which returns structured JSON:
   a summary + action items.
3. The worker writes results back to Notion via **Dwayne's PAT**:
   - one row per action item in Ecosystem Tasks (`Task name`, `Assignee`,
     `Due`, `Status = Not Started`),
   - a summary block appended to the meeting note,
   - the note's "Actions Processed" checkbox flipped to `true`.
4. Every run is recorded in a managed **"Ecosystem Meeting Actions Log"**
   database (created by the worker integration **outside** Ecosystem).

The same worker also exposes a Custom-Agent-callable tool:

- `processMeetingNote({ meetingPageId, dryRun?, force? })`
- The Notion Agent should call this tool instead of creating tasks or editing
  Ecosystem pages directly.
- `dryRun: true` returns proposed actions without writing.
- `force: true` reprocesses a page even when `Actions Processed` is already
  checked.

## Why the PAT, not `context.notion`

The Ecosystem teamspace **blocks integrations**, so the worker's own
integration cannot read or write anything in Ecosystem. Dwayne's **personal
access token acts as the user** and bypasses that block (read + write
confirmed 2026-06-29 against both the Ecosystem Notes and Ecosystem Tasks DBs).
The PAT is stored as a **worker secret** via `ntn workers env set` — set it
**once**, not on every deploy or agent run. Secrets persist on the deployed
worker until you rotate or delete them (your existing `NOTION_API_TOKEN`,
`CURSOR_API_KEY`, etc. were set on 2026-06-29 and are still there).

We use two env var names for the same PAT value:

| Var | Used by | Why separate |
| --- | --- | --- |
| `NOTION_API_TOKEN` | Scheduled sync | You set this yourself; Notion does not overwrite it during sync runs. |
| `ECOSYSTEM_NOTION_PAT` | Agent tool calls | When a Custom Agent invokes a worker tool, Notion **auto-injects** `NOTION_API_TOKEN` with the agent bot's limited token. A custom secret name avoids that overwrite. |

Set both to the **same PAT value**, once:

```bash
ntn workers env set NOTION_API_TOKEN=ntn_...      # if not already set (sync)
ntn workers env set ECOSYSTEM_NOTION_PAT=ntn_...  # same value (agent tool)
```

No redeploy is required after `env set` — the remote worker picks up new secrets
immediately. Redeploy only when you change worker **code**.

All Notion calls go through `src/pat-notion.ts` (a `fetch` wrapper with a hard
30s timeout).

> Security note: the PAT makes the worker act as Dwayne with the PAT's full
> reach. Fine for an internal tool you own. Rotate the PAT if it expires
> (the worker will start 401-ing).

## Databases (confirmed 2026-06-29)

| Role | Database | ID | Key properties |
| --- | --- | --- | --- |
| Meeting notes source | Ecosystem Notes | `2dbffe5c-4f74-81ba-992e-fcd07648104b` | `Type` (select: `Meeting Notes`), `Status`, `Involved`, `Date`, `AI summary`, **`Actions Processed`** (checkbox — added by this setup) |
| Tasks target | Ecosystem Tasks | `306ffe5c-4f74-8169-9349-eebfecaf9d8c` | `Task name` (title), `Assignee`, `Due`, `Status` (`Not Started`/…), `Tags`, `Project` |

Location of Ecosystem Tasks: Ecosystem → Initiatives & Programs → Ecosystem Projects.

## One-time setup (already done during this build)

- ✅ Added an **"Actions Processed"** checkbox to the Ecosystem Notes DB via
  `ntn api -X PATCH v1/databases/2dbffe5c-4f74-81ba-992e-fcd07648104b -d '{"properties":{"Actions Processed":{"checkbox":{}}}}'`.
- No sharing needed for the setup command: Ecosystem is reached via your
  user-level Notion API credentials, not the worker integration.

## Configuration (worker secrets)

Set each via `ntn workers env set KEY=value` from inside this folder.
Required keys are **(req)**.

### Cursor

| Key | Default | Purpose |
| --- | --- | --- |
| `CURSOR_API_KEY` **(req)** | — | Cursor API key (Dashboard → API Keys). Reasoning runs on this key's credits. |
| `CURSOR_MODEL` | `composer-2` | Model id from `GET /v1/models`. |
| `CURSOR_FAST` | `true` | `true`/`false` fast mode. |
| `CURSOR_TIMEOUT_MS` | `240000` | Per-meeting run timeout (we cancel the run if exceeded). |

### Notion (PAT)

| Key | Default | Purpose |
| --- | --- | --- |
| `ECOSYSTEM_NOTION_PAT` **(req for agent tool)** | — | Dwayne's PAT. Reaches Ecosystem as the user. Use this for Custom Agent tool calls. |
| `NOTION_API_TOKEN` **(fallback)** | — | Backwards-compatible fallback for sync-only deploys. Do not rely on this for agent tools. |
| `NOTION_VERSION` | `2022-06-28` | Notion API version header. |

### Sources / targets

| Key | Default | Purpose |
| --- | --- | --- |
| `MEETINGS_DATABASE_ID` **(req)** | — | Ecosystem Notes DB id. |
| `MEETING_TYPE_FILTER` | `Meeting Notes` | Value of the `Type` select to filter on. Set `null` to disable. |
| `MEETING_PROCESSED_PROP` | `Actions Processed` | Checkbox used as the de-dupe filter. |
| `MEETING_TITLE_PROP` | _auto-detect_ | Title prop name on meeting pages (null = auto-detect title-typed prop). |
| `TASKS_DATABASE_ID` **(req)** | — | Ecosystem Tasks DB id. |
| `TASK_TITLE_PROP` | `Task name` | Title property on Ecosystem Tasks. |
| `TASK_ASSIGNEE_PROP` | `Assignee` | People property; `null` to skip. |
| `TASK_DUE_PROP` | `Due` | Date property; `null` to skip. |
| `TASK_STATUS_PROP` | `Status` | Status property; `null` to skip. |
| `TASK_STATUS_NEW` | `Not Started` | Status value for new tasks (must match an existing option). |
| `TASK_PRIORITY_PROP` | _none_ | No Priority property on Ecosystem Tasks; leave unset. |
| `TASK_MEETING_RELATION_PROP` | _none_ | No Meetings relation on Ecosystem Tasks; leave unset. |

### Runtime

| Key | Default | Purpose |
| --- | --- | --- |
| `MAX_MEETINGS_PER_CYCLE` | `3` | Meetings processed per scheduled tick. Keep small — each makes a multi-second Cursor call. |
| `SYNC_SCHEDULE` | `30m` | One of `5m`, `15m`, `30m`, `1h`, `1d`, `manual`. Requires redeploy to change. |

## One-time secrets (do this once, not every deploy)

```bash
cd workers/ecosystem-meeting-actions
ntn workers env set CURSOR_API_KEY=sk-...                                   # (req)
ntn workers env set NOTION_API_TOKEN=ntn_...                                # (req) PAT for scheduled sync
ntn workers env set ECOSYSTEM_NOTION_PAT=ntn_...                            # (req) same PAT — for agent tool calls
ntn workers env set MEETINGS_DATABASE_ID=2dbffe5c-4f74-81ba-992e-fcd07648104b
ntn workers env set TASKS_DATABASE_ID=306ffe5c-4f74-8169-9349-eebfecaf9d8c
ntn workers env ls                                                          # verify keys are present
```

If you already set `NOTION_API_TOKEN` earlier, you only need to add
`ECOSYSTEM_NOTION_PAT` with the same value before connecting the Notion Agent.

## Deploy (when code changes)

```bash
cd workers/ecosystem-meeting-actions
npm install
ntn workers deploy --name ecosystem-meeting-actions
```

## Connect the Notion Agent

In the Notion Custom Agent:

1. Go to **Tools and access**.
2. Add the deployed `ecosystem-meeting-actions` Worker.
3. Enable the `Process Ecosystem Meeting Note` tool.
4. Keep the existing trigger on Ecosystem Notes where:
   - `Type` is `Meeting Notes`
   - `Actions Processed` is unchecked
5. Add this to the agent instructions:

```text
When a triggered Ecosystem meeting note needs action extraction, do not create
tasks, edit the note, or comment directly. Call the Worker tool named
"Process Ecosystem Meeting Note" with:

- meetingPageId: the triggered Notion page ID or URL
- dryRun: false
- force: false

If the tool reports status "skipped", stop. If it reports status "error",
summarize the error for Dwayne and do not retry repeatedly.
```

## Operate

```bash
ntn workers sync status                              # last run / state
ntn workers sync trigger ecosystemMeetingActionsSync --preview  # dry-run, no writes
ntn workers sync trigger ecosystemMeetingActionsSync            # real run
ntn workers runs list
ntn workers runs logs <runId>                        # per-meeting logs / errors
ntn workers sync state reset ecosystemMeetingActionsSync        # only on schema change
```

The managed **Ecosystem Meeting Actions Log** database is created
automatically on first deploy (outside the Ecosystem teamspace, since the
worker integration can't write there). Use it to see per-meeting status
(Processed / No actions / Error), counts, and error text.

## Idempotency

Appending a summary block edits the meeting page, which would normally
re-trigger a "watch edited pages" rule. We avoid the loop by filtering on the
**checkbox**: the sync only reads rows where `Actions Processed = false`, and
the last step of processing sets it to `true`. On error the checkbox is left
unchecked so the next tick retries.

## Decisions

This worker does **not** capture decisions — there is no Decisions database in
the Ecosystem teamspace. If you want decision capture later, point a new
`DECISIONS_DATABASE_ID` at a DB you create (and re-enable the decisions code
path, mirroring `workers/meeting-actions`).

## Cost notes

- **Cursor credits** pay for reasoning (one agent + run per meeting).
- **Notion credits** pay only for the Worker runtime glue (free during the
  Workers beta; on Notion credits from Aug 11 2026). The PAT-based Notion API
  calls themselves are not billed as AI.
- Start with `MAX_MEETINGS_PER_CYCLE=3` and `SYNC_SCHEDULE=30m` until you trust
  the extraction, then tune up.

## Files

| File | Purpose |
| --- | --- |
| `src/config.ts` | env-driven config + required-key validation |
| `src/pat-notion.ts` | PAT-authenticated Notion REST client (fetch, 30s timeout) |
| `src/cursor.ts` | Cursor Cloud Agents API client (create agent, poll run, parse JSON) |
| `src/extract.ts` | page title + block-tree → markdown |
| `src/notion-helpers.ts` | query unprocessed meetings, create tasks, append summary, mark processed |
| `src/index.ts` | worker definition, managed log DB, scheduled sync orchestration |
