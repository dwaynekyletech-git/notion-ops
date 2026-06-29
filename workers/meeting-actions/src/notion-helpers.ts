// Notion read/write helpers executed through the worker's preauthenticated
// `context.notion` client (same permissions as the worker's integration).
// All target databases (Meetings, Tasks, Decisions) must be shared with the
// worker integration, and property names are configurable via env.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadConfig } from "./config.js";
import { extractPageTitle, richTextToString } from "./extract.js";
import type { ActionItem, Decision, MeetingExtraction } from "./cursor.js";

type NotionClient = any;

export interface MeetingRow {
	id: string;
	title: string;
	url?: string;
}

export async function listUnprocessedMeetings(
	notion: NotionClient,
): Promise<MeetingRow[]> {
	const cfg = loadConfig();
	const res = await notion.databases.query({
		database_id: cfg.meetingsDatabaseId,
		filter: {
			property: cfg.meetingProcessedProp,
			checkbox: { equals: false },
		},
		page_size: cfg.maxMeetingsPerCycle,
	});
	return (res.results ?? []).map((page: any) => ({
		id: page.id,
		title: extractPageTitle(page, cfg.meetingTitleProp),
		url: page.url,
	}));
}

export async function createTask(
	notion: NotionClient,
	item: ActionItem,
	meetingTitle: string,
	meetingUrl: string | undefined,
	meetingId: string,
): Promise<string> {
	const cfg = loadConfig();
	const props: Record<string, any> = {};
	props[cfg.taskTitleProp] = {
		title: [{ text: { content: item.title } }],
	};

	if (cfg.taskStatusProp) {
		props[cfg.taskStatusProp] = { status: { name: cfg.taskStatusNew } };
	}
	if (cfg.taskDueProp && item.due) {
		const { start } = toDateValue(item.due);
		if (start) props[cfg.taskDueProp] = { date: { start } };
	}
	if (cfg.taskPriorityProp && item.priority) {
		props[cfg.taskPriorityProp] = { select: { name: item.priority } };
	}
	if (cfg.taskAssigneeProp && item.assignee) {
		const people = await resolvePeople(notion, item.assignee);
		if (people.length) props[cfg.taskAssigneeProp] = { people };
	}
	if (cfg.taskMeetingRelationProp) {
		props[cfg.taskMeetingRelationProp] = { relation: [{ page_id: meetingId }] };
	}

	const page = await notion.pages.create({
		parent: { database_id: cfg.tasksDatabaseId },
		properties: props,
		children: [
			{
				object: "block",
				type: "paragraph",
				paragraph: {
					rich_text: [
						{
							type: "text",
							text: {
								content: `From meeting: ${meetingTitle}${meetingUrl ? ` — ${meetingUrl}` : ""}`,
								link: meetingUrl ? { url: meetingUrl } : undefined,
							},
						},
					],
				},
			},
		],
	});
	return page.id;
}

export async function createDecision(
	notion: NotionClient,
	decision: Decision,
	meetingTitle: string,
	meetingUrl: string | undefined,
): Promise<string | null> {
	const cfg = loadConfig();
	if (!cfg.decisionsDatabaseId) return null;

	const props: Record<string, any> = {};
	props[cfg.decisionTitleProp] = {
		title: [{ text: { content: decision.title } }],
	};
	if (cfg.decisionContextProp && decision.context) {
		props[cfg.decisionContextProp] = {
			rich_text: [{ text: { content: decision.context } }],
		};
	}

	const page = await notion.pages.create({
		parent: { database_id: cfg.decisionsDatabaseId },
		properties: props,
		children: [
			{
				object: "block",
				type: "paragraph",
				paragraph: {
					rich_text: [
						{
							type: "text",
							text: {
								content: `Decided in: ${meetingTitle}`,
								link: meetingUrl ? { url: meetingUrl } : undefined,
							},
						},
					],
				},
			},
		],
	});
	return page.id;
}

export async function appendSummaryAndMarkProcessed(
	notion: NotionClient,
	meeting: MeetingRow,
	extraction: MeetingExtraction,
	taskIds: string[],
	decisionIds: string[],
): Promise<void> {
	const cfg = loadConfig();

	const lines: Array<{ type: string; text: string }> = [
		{
			type: "callout",
			text: `🤖 Meeting processed — ${extraction.actionItems.length} task(s) created, ${extraction.decisions.length} decision(s) recorded.`,
		},
		{ type: "heading_3", text: "Summary" },
		{ type: "paragraph", text: extraction.summary || "—" },
	];
	if (extraction.actionItems.length) {
		lines.push({ type: "heading_3", text: "Action items" });
		for (const a of extraction.actionItems) {
			const bits = [a.title];
			if (a.assignee) bits.push(`@${a.assignee}`);
			if (a.due) bits.push(`due ${a.due}`);
			if (a.priority) bits.push(`[${a.priority}]`);
			lines.push({ type: "bulleted_list_item", text: bits.join(" — ") });
		}
	}
	if (extraction.decisions.length) {
		lines.push({ type: "heading_3", text: "Decisions" });
		for (const d of extraction.decisions) {
			lines.push({ type: "bulleted_list_item", text: d.title });
		}
	}

	const children = lines.map((l) => ({
		object: "block",
		type: l.type,
		[l.type]: {
			rich_text: [{ type: "text", text: { content: l.text } }],
			...(l.type === "callout" ? { icon: { type: "emoji", emoji: "🤖" } } : {}),
		},
	}));

	await notion.blocks.children.append({
		block_id: meeting.id,
		children,
	});

	// Mark the meeting processed so it isn't picked up again. This is what
	// prevents the reprocessing loop (appending blocks edits the page, but the
	// checkbox now excludes it from the filter).
	await notion.pages.update({
		page_id: meeting.id,
		properties: {
			[cfg.meetingProcessedProp]: { checkbox: true },
		},
	});
}

// Resolve an assignee string (email or name) to Notion people property entries.
// Email is the reliable path; names are best-effort and may return no match.
async function resolvePeople(
	notion: NotionClient,
	assignee: string,
): Promise<any[]> {
	const value = assignee.trim();
	if (!value) return [];
	if (value.includes("@")) {
		try {
			const res = await notion.users.list();
			const match = (res.results ?? []).find(
				(u: any) => u.person?.email?.toLowerCase() === value.toLowerCase(),
			);
			if (match) return [{ id: match.id }];
		} catch {
			// fall through
		}
		return [{ email: value }];
	}
	return [];
}

function toDateValue(input: string): { start: string | null } {
	const s = input.trim();
	if (!s) return { start: null };
	// Accept full ISO datetime or plain date.
	const iso = /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(s) ? s : null;
	return { start: iso };
}

// Re-exported for callers that only import from this module.
export { richTextToString };
