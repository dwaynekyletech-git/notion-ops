// Notion read/write helpers for the Ecosystem flow, executed through the PAT
// client (so we can reach the Ecosystem teamspace, which blocks integrations).
// Property names are configurable via env and default to the Ecosystem Notes /
// Ecosystem Tasks DB schemas we confirmed on 2026-06-29.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadConfig } from "./config.js";
import { extractPageTitle, richTextToString } from "./extract.js";
import type { PatNotion } from "./pat-notion.js";
import type { ActionItem, MeetingExtraction } from "./cursor.js";

export interface MeetingRow {
	id: string;
	title: string;
	url?: string;
}

export async function listUnprocessedMeetings(
	notion: PatNotion,
): Promise<MeetingRow[]> {
	const cfg = loadConfig();
	const filter: any = {
		and: [
			{ property: cfg.meetingProcessedProp, checkbox: { equals: false } },
		],
	};
	if (cfg.meetingTypeFilter) {
		filter.and.push({
			property: "Type",
			select: { equals: cfg.meetingTypeFilter },
		});
	}

	const pages = await notion.queryDatabase(cfg.meetingsDatabaseId, {
		filter,
		sorts: [{ property: "Last edited time", direction: "descending" }],
		pageSize: cfg.maxMeetingsPerCycle,
	});
	return pages.map((page: any) => ({
		id: page.id,
		title: extractPageTitle(page, cfg.meetingTitleProp),
		url: page.url,
	}));
}

export async function createTask(
	notion: PatNotion,
	item: ActionItem,
	meeting: MeetingRow,
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
		const start = toDateValue(item.due);
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
		props[cfg.taskMeetingRelationProp] = { relation: [{ page_id: meeting.id }] };
	}

	const children = [
		{
			object: "block",
			type: "paragraph",
			paragraph: {
				rich_text: [
					{
						type: "text",
						text: {
							content: `From meeting: ${meeting.title}${meeting.url ? ` — ${meeting.url}` : ""}`,
							link: meeting.url ? { url: meeting.url } : undefined,
						},
					},
				],
			},
		},
	];

	const page = await notion.createPage(
		{ database_id: cfg.tasksDatabaseId },
		props,
		children,
	);
	return page.id;
}

export async function appendSummaryAndMarkProcessed(
	notion: PatNotion,
	meeting: MeetingRow,
	extraction: MeetingExtraction,
	taskIds: string[],
): Promise<void> {
	const cfg = loadConfig();

	const lines: Array<{ type: string; text: string }> = [
		{
			type: "callout",
			text: `🤖 Meeting processed — ${extraction.actionItems.length} task(s) created in Ecosystem Tasks.`,
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

	const children = lines.map((l) => ({
		object: "block",
		type: l.type,
		[l.type]: {
			rich_text: [{ type: "text", text: { content: l.text } }],
			...(l.type === "callout" ? { icon: { type: "emoji", emoji: "🤖" } } : {}),
		},
	}));

	await notion.appendBlocks(meeting.id, children);

	// Mark processed so it isn't picked up again. This prevents the reprocessing
	// loop (appending blocks edits the page, but the checkbox now excludes it).
	// Also populate the DB's rich_text "AI summary" property so summaries show up
	// in table/gallery views, not just in the page body.
	const updateProps: Record<string, any> = {
		[cfg.meetingProcessedProp]: { checkbox: true },
	};
	if (cfg.meetingSummaryProp) {
		updateProps[cfg.meetingSummaryProp] = {
			rich_text: [{ type: "text", text: { content: (extraction.summary || "").slice(0, 2000) } }],
		};
	}
	await notion.updatePage(meeting.id, updateProps);
}

// Resolve an assignee string (email or name) to Notion people entries.
// Email is the reliable path; names are best-effort and usually return no match.
async function resolvePeople(
	notion: PatNotion,
	assignee: string,
): Promise<any[]> {
	const value = assignee.trim();
	if (!value) return [];
	if (value.includes("@")) {
		try {
			const users = await notion.listUsers();
			const match = users.find(
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

function toDateValue(input: string): string | null {
	const s = input.trim();
	if (!s) return null;
	return /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(s) ? s : null;
}

// Re-exported for callers that only import from this module.
export { richTextToString };
