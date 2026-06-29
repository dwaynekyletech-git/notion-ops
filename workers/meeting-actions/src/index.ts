// Meeting Actions Worker
//
// Watches a Notion "Meeting Notes" database and, for each unprocessed note,
// sends the content to a Cursor Cloud Agent (running on your Cursor credits)
// to extract action items + decisions, then writes those back into Notion:
//   - rows in your Tasks database
//   - rows in a Decisions database (optional)
//   - a summary block appended to the meeting note
//   - the meeting's "Actions Processed" checkbox set to true
//
// A managed "Meeting Actions Log" database records every run for observability.

import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";

import { extractMeeting } from "./cursor.js";
import { pageToMarkdown } from "./extract.js";
import {
	appendSummaryAndMarkProcessed,
	createDecision,
	createTask,
	listUnprocessedMeetings,
} from "./notion-helpers.js";

const worker = new Worker();
export default worker;

// Managed log database — one row per processed meeting.
const meetingActionsLog = worker.database("meetingActionsLog", {
	type: "managed",
	initialTitle: "Meeting Actions Log",
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
			"Decisions Created": Schema.number(),
			"Cursor Run": Schema.richText(),
			"Processed At": Schema.date(),
			Error: Schema.richText(),
		},
	},
});

interface SyncState {
	// Observability only — the checkbox filter is the real de-duplication key.
	lastRunAt?: string;
}

worker.sync("meetingActionsSync", {
	database: meetingActionsLog,
	mode: "incremental",
	schedule: (process.env.SYNC_SCHEDULE ?? "15m") as
		| "5m"
		| "15m"
		| "1h"
		| "1d"
		| "manual",
	execute: async (_state: SyncState | undefined, { notion }: { notion: any }) => {
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
					"Decisions Created": Builder.number(outcome.decisionsCreated),
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
	decisionsCreated: number;
	cursorRun: string | null;
	error: string | null;
}

async function processMeeting(
	notion: any,
	meeting: { id: string; title: string; url?: string },
): Promise<MeetingOutcome> {
	const base: MeetingOutcome = {
		status: "Error",
		actionsCreated: 0,
		decisionsCreated: 0,
		cursorRun: null,
		error: null,
	};

	try {
		const content = await pageToMarkdown(notion, meeting.id);
		if (!content.trim()) {
			return { ...base, status: "No actions", error: "Empty meeting body" };
		}

		const extraction = await extractMeeting(meeting.title, content);
		if (!extraction.actionItems.length && !extraction.decisions.length) {
			// Still mark processed so we don't re-pay Cursor credits to re-scan it.
			await appendSummaryAndMarkProcessed(notion, meeting, extraction, [], []);
			return {
				...base,
				status: "No actions",
				cursorRun: extraction.summary ? "ok" : null,
			};
		}

		const taskIds: string[] = [];
		for (const item of extraction.actionItems) {
			const id = await createTask(notion, item, meeting.title, meeting.url, meeting.id);
			taskIds.push(id);
		}

		const decisionIds: string[] = [];
		for (const dec of extraction.decisions) {
			const id = await createDecision(notion, dec, meeting.title, meeting.url);
			if (id) decisionIds.push(id);
		}

		await appendSummaryAndMarkProcessed(
			notion,
			meeting,
			extraction,
			taskIds,
			decisionIds,
		);

		return {
			status: "Processed",
			actionsCreated: taskIds.length,
			decisionsCreated: decisionIds.length,
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

function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}
