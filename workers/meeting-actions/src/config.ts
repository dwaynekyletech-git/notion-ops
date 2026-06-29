// Centralised configuration. All values come from worker secrets/env set via
// `ntn workers env set KEY=value`. Required keys throw a clear error so a
// misconfigured deploy fails fast instead of silently no-op'ing.

export interface Config {
	cursorApiKey: string;
	cursorModel: string;
	cursorFast: boolean;
	cursorTimeoutMs: number;

	meetingsDatabaseId: string;
	meetingProcessedProp: string;
	meetingTitleProp: string;

	tasksDatabaseId: string;
	taskTitleProp: string;
	taskAssigneeProp: string | null;
	taskDueProp: string | null;
	taskStatusProp: string | null;
	taskStatusNew: string;
	taskPriorityProp: string | null;
	taskMeetingRelationProp: string | null;

	decisionsDatabaseId: string | null;
	decisionTitleProp: string;
	decisionContextProp: string | null;

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

		meetingsDatabaseId: req("MEETINGS_DATABASE_ID"),
		// This checkbox already exists on the AGIVC Meetings DB — no need to add it.
		meetingProcessedProp:
			opt("MEETING_PROCESSED_PROP") ?? "Is Analyzed by External Agent",
		meetingTitleProp: opt("MEETING_TITLE_PROP") ?? "Name",

		tasksDatabaseId: req("TASKS_DATABASE_ID"),
		// Defaults match the AGIVC "Revenue & FDE Tasks" DB schema.
		taskTitleProp: opt("TASK_TITLE_PROP") ?? "Task Name",
		taskAssigneeProp: opt("TASK_ASSIGNEE_PROP") ?? "Owner",
		taskDueProp: opt("TASK_DUE_PROP") ?? "Due Date",
		taskStatusProp: opt("TASK_STATUS_PROP") ?? "Done",
		taskStatusNew: opt("TASK_STATUS_NEW") ?? "Not started",
		taskPriorityProp: opt("TASK_PRIORITY_PROP") ?? null,
		taskMeetingRelationProp: opt("TASK_MEETING_RELATION_PROP") ?? "Meetings",

		decisionsDatabaseId: opt("DECISIONS_DATABASE_ID"),
		decisionTitleProp: opt("DECISION_TITLE_PROP") ?? "Name",
		decisionContextProp: opt("DECISION_CONTEXT_PROP") ?? "Context",

		maxMeetingsPerCycle: int("MAX_MEETINGS_PER_CYCLE", 3),
		schedule: opt("SYNC_SCHEDULE") ?? "15m",
	};
	return cached;
}
