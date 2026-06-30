// Ecosystem Meeting Actions Worker
//
// Watches the Ecosystem Notes DB (Type = "Meeting Notes") and, for each
// unprocessed note, sends the content to a Cursor Cloud Agent (running on your
// Cursor credits) to extract action items, then writes those back into Notion
// via Dwayne's PAT:
//   - rows in the Ecosystem Tasks DB
//   - a summary block appended to the meeting note
//   - the note's "Actions Processed" checkbox set to true
//
// WHY THE PAT (not context.notion): the Ecosystem teamspace blocks
// integrations, so the worker's own integration cannot read/write Ecosystem.
// Dwayne's PAT acts as the user and bypasses that block (confirmed read+write
// 2026-06-29). Sync uses NOTION_API_TOKEN; agent tool calls use
// ECOSYSTEM_NOTION_PAT (same PAT value, different name — see README).
//
// A managed "Ecosystem Meeting Actions Log" database (created by the worker
// integration OUTSIDE Ecosystem) records every run for observability.

import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";
import { j } from "@notionhq/workers/schema-builder";

import { loadConfig } from "./config.js";
import { extractMeeting } from "./cursor.js";
import { extractPageTitle, pageToMarkdown } from "./extract.js";
import {
	appendSummaryAndMarkProcessed,
	createTask,
	listUnprocessedMeetings,
} from "./notion-helpers.js";
import { patNotion } from "./pat-notion.js";

const worker = new Worker();
export default worker;

// Managed log database — one row per processed meeting. Created by the worker
// integration somewhere it can write (NOT inside Ecosystem, which is blocked).
const ecosystemLog = worker.database("ecosystemActionsLog", {
	type: "managed",
	initialTitle: "Ecosystem Meeting Actions Log",
	primaryKeyProperty: "Meeting ID",
	schema: {
		properties: {
			Meeting: Schema.title(),
			"Meeting ID": Schema.richText(),
			Status: Schema.select([
				{ name: "Processed", color: "green" },
				{ name: "No actions", color: "gray" },
				{ name: "Error", color: "red" },
			]),
			"Actions Created": Schema.number(),
			"Cursor Run": Schema.richText(),
			"Processed At": Schema.date(),
			Error: Schema.richText(),
		},
	},
});

worker.tool("processMeetingNote", {
	title: "Process Ecosystem Meeting Note",
	description:
		"Analyze one Ecosystem meeting note by page ID, then create follow-up tasks and mark the note processed using the Ecosystem PAT-backed Notion client. Use this instead of directly editing Ecosystem databases.",
	schema: j.object({
		meetingPageId: j
			.string()
			.describe("The Notion meeting note page ID or URL to process."),
		dryRun: j
			.boolean()
			.describe("If true, analyze and return proposed actions without writing to Notion.")
			.nullable(),
		force: j
			.boolean()
			.describe("If true, process even when Actions Processed is already checked.")
			.nullable(),
	}),
	execute: async ({ meetingPageId, dryRun, force }): Promise<ToolResult> => {
		// Custom Agent tool calls receive a context.notion client with the agent's
		// permissions, but Ecosystem blocks that bot from writing. Require the
		// explicit PAT secret so this tool uses the same write path as the sync.
		if (!process.env.ECOSYSTEM_NOTION_PAT?.trim()) {
			return {
				status: "error",
				message:
					"Missing worker secret ECOSYSTEM_NOTION_PAT (one-time setup). Run: ntn workers env set ECOSYSTEM_NOTION_PAT=<your PAT> — use the same Notion PAT as NOTION_API_TOKEN. Notion auto-overwrites NOTION_API_TOKEN during agent tool calls, so this separate secret is required.",
			};
		}

		const notion = patNotion();
		const meeting = await getMeetingById(notion, meetingPageId);
		if (meeting.processed && !force) {
			return {
				status: "skipped",
				meetingPageId: meeting.id,
				meetingTitle: meeting.title,
				message:
					"Meeting note is already marked Actions Processed. Pass force=true to reprocess.",
			};
		}

		if (dryRun) {
			const content = await pageToMarkdown(notion, meeting.id);
			if (!content.trim()) {
				return {
					status: "dry_run",
					meetingPageId: meeting.id,
					meetingTitle: meeting.title,
					summary: "",
					actionItems: [],
					decisions: [],
					message: "Meeting body is empty. No writes were made.",
				};
			}
			const extraction = await extractMeeting(meeting.title, content);
			return {
				status: "dry_run",
				meetingPageId: meeting.id,
				meetingTitle: meeting.title,
				summary: extraction.summary,
				actionItems: extraction.actionItems.map((item) => ({
					title: item.title,
					assignee: item.assignee ?? null,
					due: item.due ?? null,
					priority: item.priority ?? null,
				})),
				decisions: extraction.decisions.map((decision) => ({
					title: decision.title,
					context: decision.context ?? null,
				})),
				message: "Dry run only. No writes were made.",
			};
		}

		const outcome = await processMeeting(notion, meeting);
		return {
			status: outcome.status,
			meetingPageId: meeting.id,
			meetingTitle: meeting.title,
			actionsCreated: outcome.actionsCreated,
			error: outcome.error,
		};
	},
});

type ToolJson = string | number | boolean | null | ToolJson[] | { [key: string]: ToolJson };
type ToolResult = { [key: string]: ToolJson };

interface SyncState {
	lastRunAt?: string;
}

worker.sync("ecosystemMeetingActionsSync", {
	database: ecosystemLog,
	mode: "incremental",
	schedule: (process.env.SYNC_SCHEDULE ?? "30m") as
		| "5m"
		| "15m"
		| "30m"
		| "1h"
		| "1d"
		| "manual",
	execute: async (_state: SyncState | undefined) => {
		const notion = patNotion();
		const meetings = await listUnprocessedMeetings(notion);

		const changes = [];

		for (const meeting of meetings) {
			const outcome = await processMeeting(notion, meeting);
			changes.push({
				type: "upsert" as const,
				key: meeting.id,
				properties: {
					Meeting: Builder.title(meeting.title),
					"Meeting ID": Builder.richText(meeting.id),
					Status: Builder.select(outcome.status),
					"Actions Created": Builder.number(outcome.actionsCreated),
					"Cursor Run": Builder.richText(outcome.cursorRun ?? ""),
					"Processed At": Builder.date(todayISO()),
					Error: Builder.richText(outcome.error ?? ""),
				},
			});
		}

		return {
			changes,
			hasMore: false,
			nextState: { lastRunAt: new Date().toISOString() },
		};
	},
});

interface MeetingOutcome {
	status: "Processed" | "No actions" | "Error";
	actionsCreated: number;
	cursorRun: string | null;
	error: string | null;
}

async function processMeeting(
	notion: ReturnType<typeof patNotion>,
	meeting: { id: string; title: string; url?: string },
): Promise<MeetingOutcome> {
	const base: MeetingOutcome = {
		status: "Error",
		actionsCreated: 0,
		cursorRun: null,
		error: null,
	};

	try {
		const content = await pageToMarkdown(notion, meeting.id);
		if (!content.trim()) {
			return { ...base, status: "No actions", error: "Empty meeting body" };
		}

		const extraction = await extractMeeting(meeting.title, content);
		if (!extraction.actionItems.length) {
			// Still mark processed so we don't re-pay Cursor credits to re-scan it.
			await appendSummaryAndMarkProcessed(notion, meeting, extraction, []);
			return { ...base, status: "No actions", cursorRun: "ok" };
		}

		const taskIds: string[] = [];
		for (const item of extraction.actionItems) {
			const id = await createTask(notion, item, meeting);
			taskIds.push(id);
		}

		await appendSummaryAndMarkProcessed(notion, meeting, extraction, taskIds);

		return {
			status: "Processed",
			actionsCreated: taskIds.length,
			cursorRun: "ok",
			error: null,
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		// Don't mark processed on error — leave the checkbox false so the next
		// cycle retries. Cap error text for the log cell.
		return { ...base, error: msg.slice(0, 1800) };
	}
}

async function getMeetingById(
	notion: ReturnType<typeof patNotion>,
	pageIdOrUrl: string,
): Promise<{ id: string; title: string; url?: string; processed: boolean }> {
	const cfg = loadConfig();
	const pageId = normalizePageId(pageIdOrUrl);
	const page = await notion.retrievePage(pageId);
	return {
		id: page.id,
		title: extractPageTitle(page, cfg.meetingTitleProp),
		url: page.url,
		processed: !!page.properties?.[cfg.meetingProcessedProp]?.checkbox,
	};
}

function normalizePageId(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}/i,
	);
	if (!match) {
		throw new Error(`Could not find a Notion page ID in: ${trimmed.slice(0, 120)}`);
	}
	return match[0];
}

function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}
