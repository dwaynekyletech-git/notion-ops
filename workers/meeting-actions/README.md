# Meeting Actions Worker

Watches a Notion **Meeting Notes** database and turns each meeting into action:

1. A scheduled sync polls for meeting notes where the **"Actions Processed"**
   checkbox is unchecked.
2. The note's content is sent to a **Cursor Cloud Agent** (running on your
   Cursor API credits — no Notion AI credits used for reasoning) which returns
   structured JSON: a summary, action items, and decisions.
3. The worker writes the results back to Notion via its preauthenticated
   `context.notion` client:
   - one row per action item in your **Tasks** database,
   - one row per decision in a **Decisions** database (optional),
   - a summary block appended to the meeting note,
   - the meeting's "Actions Processed" checkbox flipped to `true`.
4. Every run is recorded in a managed **"Meeting Actions Log"** database for
   observability.

This is **Option A** from the research: the Worker is thin glue (cheap, runs on
Notion credits only during the free beta), and all the expensive reasoning runs
in Cursor on your Cursor credits. If you later get access to Notion's
**External Agents API** (private beta), Cursor can be registered as a
first-class participant in Notion for an even cleaner UX — see
`../../docs/notion-cursor-agent.md`.

## Architecture

```
Notion Meeting Notes DB ──(scheduled poll, every 15m)──▶ Worker execute()
                                                              │
                         ┌────────────────────────────────────┘
                         ▼
              pageToMarkdown(notion, pageId)
                         │
                         ▼
              Cursor Cloud Agents API  POST /v1/agents   (Cursor credits)
                         │  poll GET /runs/{id} until FINISHED
                         ▼
              parse JSON { summary, actionItems[], decisions[] }
                         │
              ┌──────────┼──────────────┐
              ▼          ▼              ▼
       createTask()  createDecision()  appendSummary + set checkbox=true
              (context.notion writes into your existing Tasks / Decisions DBs)
```

## One-time Notion setup

1. **Share databases with the worker integration.** The worker's integration
   needs access to the Meeting Notes, Tasks, and (optional) Decisions
   databases. In each database: `•••` → **Connections** → add the worker's
   integration (created automatically on first `ntn workers deploy`). After
   deploying once you may need to re-share. (Same flow as the "Notion CLI"
   integration described in the root README.)
2. **Add an "Actions Processed" checkbox property** to your Meeting Notes
   database (type: Checkbox). This is the de-duplication key — a meeting is
   only processed once. The property name is configurable via
   `MEETING_PROCESSED_PROP` but defaults to `Actions Processed`.
3. **Collect the raw UUIDs** of your Meeting Notes, Tasks, and Decisions
   databases (drop any `collection://` prefix).

## Configuration (worker secrets)

Set each via `ntn workers env set KEY=value` from inside this folder, then
`ntn workers env push` (or redeploy). Required keys are marked **(req)**.

### Cursor

| Key | Default | Purpose |
| --- | --- | --- |
| `CURSOR_API_KEY` **(req)** | — | Cursor API key (Dashboard → API Keys). The reasoning runs against this key's credits. |
| `CURSOR_MODEL` | `composer-2` | Any model id from `GET /v1/models`. `composer-2` is cheap; `claude-4.6-sonnet-thinking` for harder extraction. |
| `CURSOR_FAST` | `true` | `true`/`false` — fast mode for the model. |
| `CURSOR_TIMEOUT_MS` | `240000` | Per-meeting run timeout (we cancel the run if exceeded). |

### Notion sources/targets

| Key | Default | Purpose |
| --- | --- | --- |
| `MEETINGS_DATABASE_ID` **(req)** | — | Raw UUID of the Meeting Notes database. |
| `MEETING_PROCESSED_PROP` | `Actions Processed` | Checkbox property used as the de-dupe filter. |
| `MEETING_TITLE_PROP` | `Name` | Title property name on meeting pages (best-effort; falls back to the title-typed property). |
| `TASKS_DATABASE_ID` **(req)** | — | Raw UUID of the Tasks database to create action items in. |
| `TASK_TITLE_PROP` | `Name` | Title property on the Tasks DB. |
| `TASK_ASSIGNEE_PROP` | `Assignee` | People property; set `null` to skip assignee mapping. |
| `TASK_DUE_PROP` | `Due Date` | Date property; set `null` to skip. |
| `TASK_STATUS_PROP` | `Status` | Status property; set `null` to skip. |
| `TASK_STATUS_NEW` | `Not started` | Status value to set on new tasks. |
| `TASK_PRIORITY_PROP` | `Priority` | Select property; set `null` to skip. |
| `DECISIONS_DATABASE_ID` | _none_ | Optional. Omit to skip decision capture. |
| `DECISION_TITLE_PROP` | `Name` | Title property on the Decisions DB. |
| `DECISION_CONTEXT_PROP` | `Context` | Rich-text property for decision context. |

### Runtime

| Key | Default | Purpose |
| --- | --- | --- |
| `MAX_MEETINGS_PER_CYCLE` | `3` | Meetings processed per scheduled tick. Keep small — each makes a multi-second Cursor call. |
| `SYNC_SCHEDULE` | `15m` | One of `5m`, `15m`, `1h`, `1d`, `manual`. Requires redeploy to change. |

## Deploy

```bash
cd workers/meeting-actions
npm install
ntn workers env set CURSOR_API_KEY=sk-...        # (req)
ntn workers env set MEETINGS_DATABASE_ID=...      # (req)
ntn workers env set TASKS_DATABASE_ID=...         # (req)
ntn workers env set DECISIONS_DATABASE_ID=...     # optional
# ...override any other defaults you need...
ntn workers deploy --name meeting-actions
```

## Operate

```bash
ntn workers sync status                       # see last run / state
ntn workers sync trigger meetingActionsSync   # run now
ntn workers sync trigger meetingActionsSync --preview   # dry-run, no writes
ntn workers runs list
ntn workers runs logs <runId>                 # see per-meeting logs / errors
ntn workers sync state reset meetingActionsSync   # only if you change schema
```

The managed **Meeting Actions Log** database is created automatically in your
workspace on first deploy. Use it to see per-meeting status (Processed / No
actions / Error), counts, and error text.

## How the "watch" stays idempotent

Appending a summary block edits the meeting page, which would normally re-trigger
a "watch edited pages" rule. We avoid that loop by filtering on the **checkbox**:
the sync only reads pages where `Actions Processed = false`, and the very last
step of processing sets that checkbox to `true`. So a page can be edited many
times and will only be reprocessed if a human unchecks the box.

## Failure behaviour

If a meeting fails (Cursor error, parse error, Notion write error) the checkbox
is **left unchecked**, so the next scheduled tick retries it. The error text is
written to the log row's `Error` property and to `ntn workers runs logs`.

## Local testing

```bash
# Exercise the Cursor extraction + parsing in isolation (no Notion writes):
CURSOR_API_KEY=sk-... node --experimental-strip-types -e 'import("./src/cursor.ts").then(m=>m.extractMeeting("Standup","- Discussed pricing\n- Action: Ada to email Q3 numbers by Fri").then(console.log))'
```

(Note: the worker runtime injects `context.notion`; it is not available in a
plain `node` run, so test the Notion-write paths via `ntn workers exec` /
`--preview` after deploy.)

## Cost notes

- **Cursor credits** pay for the reasoning (one agent+run per meeting).
- **Notion credits** pay only for the Worker runtime glue. Workers are free
  during the beta; starting Aug 11 2026 they run on Notion credits. Because the
  Worker is thin glue, Notion spend stays small.
- Tune cost via `MAX_MEETINGS_PER_CYCLE`, `SYNC_SCHEDULE`, and `CURSOR_MODEL`.
