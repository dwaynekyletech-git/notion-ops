// Centralised configuration for the Ecosystem meeting-actions worker.
// All values come from worker secrets/env set via `ntn workers env set`.
// Required keys throw a clear error so a misconfigured deploy fails fast.
//
// IMPORTANT: this worker reaches Notion through Dwayne's PAT, not the worker
// integration, because the Ecosystem teamspace blocks integrations. For Custom
// Agent tool calls, set ECOSYSTEM_NOTION_PAT so we don't accidentally use
// Notion's auto-injected agent token from context.notion / NOTION_API_TOKEN.

export interface Config {
	// Cursor (reasoning runs on Cursor credits)
	cursorApiKey: string;
	cursorModel: string;
	cursorFast: boolean;
	cursorTimeoutMs: number;

	// Notion PAT (acts as the user — reaches the Ecosystem teamspace)
	notionApiToken: string;
	notionVersion: string;

	// Meeting notes source = Ecosystem Notes DB
	meetingsDatabaseId: string;
	meetingTypeFilter: string | null; // value of the "Type" select to filter on
	meetingProcessedProp: string; // checkbox used as the de-dupe filter
	meetingTitleProp: string | null; // title prop name (null = auto-detect title-typed prop)
	meetingSummaryProp: string | null; // rich_text prop to also write the summary into (null = skip)

	// Tasks target = Ecosystem Tasks DB
	tasksDatabaseId: string;
	taskTitleProp: string;
	taskAssigneeProp: string | null;
	taskDueProp: string | null;
	taskStatusProp: string | null;
	taskStatusNew: string;
	taskPriorityProp: string | null;
	taskMeetingRelationProp: string | null;

	// Runtime
	maxMeetingsPerCycle: number;
	schedule: string;
}

function req(key: string): string {
	const v = process.env[key];
	if (!v || !v.trim()) {
		throw new Error(
			`Missing required worker secret/env var: ${key}. Set it with: ntn workers env set ${key}=...`,
		);
	}
	return v.trim();
}

function opt(key: string): string | null {
	const v = process.env[key];
	return v && v.trim() ? v.trim() : null;
}

function bool(key: string, def: boolean): boolean {
	const v = process.env[key];
	if (v == null) return def;
	return v.trim().toLowerCase() === "true";
}

function int(key: string, def: number): number {
	const v = process.env[key];
	const n = v ? Number.parseInt(v, 10) : NaN;
	return Number.isFinite(n) ? n : def;
}

let cached: Config | null = null;

export function loadConfig(): Config {
	if (cached) return cached;
	cached = {
		cursorApiKey: req("CURSOR_API_KEY"),
		cursorModel: opt("CURSOR_MODEL") ?? "composer-2.5",
		cursorFast: bool("CURSOR_FAST", true),
		cursorTimeoutMs: int("CURSOR_TIMEOUT_MS", 240_000),

		// Keep NOTION_API_TOKEN as a backwards-compatible fallback for sync-only
		// deploys, but agent tools should set ECOSYSTEM_NOTION_PAT explicitly.
		notionApiToken: opt("ECOSYSTEM_NOTION_PAT") ?? req("NOTION_API_TOKEN"),
		notionVersion: opt("NOTION_VERSION") ?? "2022-06-28",

		meetingsDatabaseId: req("MEETINGS_DATABASE_ID"),
		meetingTypeFilter: opt("MEETING_TYPE_FILTER") ?? "Meeting Notes",
		meetingProcessedProp: opt("MEETING_PROCESSED_PROP") ?? "Actions Processed",
		meetingTitleProp: opt("MEETING_TITLE_PROP") ?? null,
		meetingSummaryProp: opt("MEETING_SUMMARY_PROP") ?? "AI summary",

		tasksDatabaseId: req("TASKS_DATABASE_ID"),
		// Defaults match the Ecosystem "Tasks" DB schema.
		taskTitleProp: opt("TASK_TITLE_PROP") ?? "Task name",
		taskAssigneeProp: opt("TASK_ASSIGNEE_PROP") ?? "Assignee",
		taskDueProp: opt("TASK_DUE_PROP") ?? "Due",
		taskStatusProp: opt("TASK_STATUS_PROP") ?? "Status",
		taskStatusNew: opt("TASK_STATUS_NEW") ?? "Not Started",
		taskPriorityProp: opt("TASK_PRIORITY_PROP") ?? null,
		taskMeetingRelationProp: opt("TASK_MEETING_RELATION_PROP") ?? null,

		maxMeetingsPerCycle: int("MAX_MEETINGS_PER_CYCLE", 3),
		schedule: opt("SYNC_SCHEDULE") ?? "30m",
	};
	return cached;
}
