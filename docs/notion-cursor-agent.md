# Building a Notion agent that runs on Cursor credits

Research summary for "create an agent in Notion that watches meeting notes and
takes action, built in Cursor so it spends Cursor credits." The buildable
result lives in `workers/meeting-actions/`.

## TL;DR

There is **no literal "import a Cursor agent into Notion" button**. Instead,
Notion's Developer Platform (launched May 13, 2026) exposes an **External Agents
API** that lists **Cursor as a named partner** — so an agent built on Cursor can
be surfaced in Notion as a first-class participant, and the reasoning runs on
your Cursor credits. Today that API is **private beta (waitlist)**, so we built
the equivalent bridge with public-beta tooling: a **Notion Worker** that polls
meeting notes and calls the **Cursor Cloud Agents API** for the heavy lifting.

## The Notion building blocks (from developers.notion.com)

| Capability | Status | What it's for here |
| --- | --- | --- |
| **Custom Agents** | GA | Native in-Notion agents with triggers. Runs on Notion credits. Not the path we took — we want Cursor credits. |
| **Workers** (`ntn workers`) | Public beta (free until Aug 11 2026, then Notion credits) | TypeScript hosted by Notion. Supports `worker.sync` (scheduled), `worker.tool` (Custom-Agent-callable), `worker.webhook`. This is our glue. |
| **External Agents API** | **Private beta (waitlist)** | Brings an external agent (Claude, Codex, **Cursor**, Decagon, or your own) into Notion as a named participant you can chat with / assign. |
| Agent SDK | Private alpha | Reverse direction (Notion agents inside other apps). Not needed. |

Key docs read:
- `developers.notion.com/workers/get-started/overview` — Workers overview.
- `developers.notion.com/workers/guides/syncs` — syncs, schedules, modes, pacers.
- `developers.notion.com/workers/guides/tools` — `context.notion` preauthenticated client, `j` schema builder, `readOnlyHint`.
- `notion.com/help/what-is-the-notion-developer-platform` — External Agents API is private beta; Cursor is a partner.

Important sync semantics that shaped the design:
- Syncs **manage their own databases** (syncing to an existing DB is "coming soon"). So writing into your *existing* Tasks/Decisions DBs is done via `context.notion` API calls inside `execute`, **not** via the sync's change emission. The sync's emitted upserts populate a managed **log** DB only.
- `mode: "incremental"` keeps state across runs and doesn't delete unmentioned rows — right for a processing log.
- Schedules: min `5m`, max `7d`, plus `manual`.

## The Cursor building blocks (from cursor.com/docs)

- **Cloud Agents API v1** (`api.cursor.com/v1/agents`) — public beta, Basic/Bearer auth with a Cursor API key. Create a durable agent + initial run with one `POST /v1/agents`; poll `GET /v1/agents/{id}/runs/{runId}` (or stream SSE) for the terminal `result`; runs are billed to your Cursor credits.
- **Cursor SDK** (`@cursor/sdk` / `cursor-sdk`) — public beta, programmatic wrapper over the same API. Supports inline MCP servers, env vars, repos, subagents. (We call the REST API directly from the Worker to avoid bundling the SDK, but the SDK is the better choice if you later build the orchestrator outside Notion.)
- A "no-repo" agent (omit `repos` and `env`) is a pure reasoning call — exactly what we need for structured extraction. You can also pass inline `mcpServers` (e.g. the Notion MCP) if you'd rather have Cursor write back to Notion itself instead of the Worker doing it.

## Two architectures

### Option A — Worker + Cursor Cloud Agents API (built, no waitlist)

```
Notion Meeting Notes (checkbox filter) ─▶ Worker sync (15m)
   Worker ─▶ POST /v1/agents (Cursor, no repo) ─▶ poll run ─▶ JSON
   Worker ─▶ PAT-backed Notion API: create Tasks, append summary, set checkbox
   Worker ─▶ managed "Meeting Actions Log" DB row
```

Why this works today: Workers and the Cloud Agents API are both public beta.
Billing: Cursor credits for reasoning; Notion credits only for the thin Worker
glue (and free during the Workers beta).

### Option A2 — Notion Custom Agent trigger + Worker tool (current agent path)

```
Notion Custom Agent trigger on Meeting Notes ─▶ processMeetingNote tool
   Tool ─▶ POST /v1/agents (Cursor, no repo) ─▶ poll run ─▶ JSON
   Tool ─▶ PAT-backed Notion API: create Tasks, append summary, set checkbox
```

This keeps the agent in charge of deciding when to invoke the workflow while the
worker performs the bounded writes. The agent should not directly create tasks
or edit the meeting note; it should call `processMeetingNote` with the triggered
page ID.

### Option B — External Agents API native integration (waitlisted)

When you get off the External Agents API waitlist:
1. Notion → Settings → Integrations → External Agents → connect Cursor (OAuth).
2. Cursor appears in your workspace as a named participant.
3. A Notion Custom Agent trigger (or an @-mention) hands a meeting note to the
   Cursor participant; Cursor runs on Cursor credits and writes back into
   Notion as a first-class member.

This is the cleanest UX and removes the need for the Worker to call the Cursor
API, but is gated today. Join the waitlist from the Notion Developer Platform
page so you can migrate later.

## Why we used a checkbox filter, not "edited since" polling

A `last_edited_time > cursor` filter would re-process every meeting the moment
the Worker appends its summary block (that edit bumps `last_edited_time`) — an
infinite loop. Filtering on an **"Actions Processed" checkbox = false** and
setting it true as the final step is stable: edits to the page no longer
re-trigger processing unless a human unchecks the box.

## Open questions / next steps

- Confirm the exact property names of your Tasks and Decisions databases and set
  the `TASK_*` / `DECISION_*` env overrides accordingly.
- Decide whether assignee capture is worth it (requires the assignee's email to
  be resolvable via `notion.users.list`, or accept best-effort skip).
- If you want Cursor to also push to external systems (GitHub, Linear, Slack),
  pass those as inline `mcpServers` in the Cursor create call and let the agent
  act, instead of (or in addition to) the Worker writing to Notion.
- Join the External Agents API waitlist for the Option B upgrade path.
