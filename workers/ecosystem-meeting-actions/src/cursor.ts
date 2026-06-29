// Calls the Cursor Cloud Agents API to turn a meeting note into structured JSON.
// The agent is a no-repo, no-MCP "brain" — it only reasons and returns JSON.
// All Notion writes happen back in the Worker via the PAT client, so the heavy
// reasoning runs on Cursor credits while Notion credits only pay for glue.

import { loadConfig } from "./config.js";

const CURSOR_BASE = "https://api.cursor.com";

export interface ActionItem {
	title: string;
	assignee?: string | null; // name or email
	due?: string | null; // ISO date or datetime
	priority?: string | null;
}

export interface Decision {
	title: string;
	context?: string | null;
}

export interface MeetingExtraction {
	summary: string;
	actionItems: ActionItem[];
	decisions: Decision[];
}

const EXTRACTION_PROMPT = `You are an operations assistant that reads meeting notes and extracts structured outputs.

Read the meeting notes below and return ONE JSON object — no prose, no markdown fences — with this exact shape:

{
  "summary": "3-5 sentence summary of the meeting",
  "actionItems": [
    { "title": "Concrete, verb-led action", "assignee": "email or name if stated, else null", "due": "ISO date (YYYY-MM-DD) if stated, else null", "priority": "Low|Medium|High|null" }
  ],
  "decisions": [
    { "title": "Decision that was made", "context": "Why / context, brief" }
  ]
}

Rules:
- Only include real action items someone committed to. Do not invent work.
- If assignee is unknown, use null. If due date is unknown, use null.
- "actionItems" and "decisions" may be empty arrays.
- Output ONLY the JSON object.`;

interface CreateAgentResponse {
	agent: { id: string; latestRunId: string };
	run: { id: string; status: string };
}

interface RunResponse {
	id: string;
	status: string;
	result?: string;
	durationMs?: number;
}

export async function extractMeeting(
	meetingTitle: string,
	meetingContent: string,
): Promise<MeetingExtraction> {
	const cfg = loadConfig();

	const body = {
		name: `Meeting actions: ${meetingTitle}`.slice(0, 100),
		prompt: {
			text: `${EXTRACTION_PROMPT}\n\n--- MEETING NOTES ---\nTitle: ${meetingTitle}\n\n${meetingContent}`,
		},
		model: {
			id: cfg.cursorModel,
			params: [{ id: "fast", value: cfg.cursorFast ? "true" : "false" }],
		},
	};

	const auth = "Basic " + Buffer.from(`${cfg.cursorApiKey}:`).toString("base64");

	const create = await fetch(`${CURSOR_BASE}/v1/agents`, {
		method: "POST",
		headers: {
			Authorization: auth,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!create.ok) {
		const text = await create.text();
		throw new Error(`Cursor create agent failed ${create.status}: ${text}`);
	}

	const created = (await create.json()) as CreateAgentResponse;
	const agentId = created.agent.id;
	const runId = created.agent.latestRunId ?? created.run.id;

	const result = await pollRun(agentId, runId, auth, cfg.cursorTimeoutMs);
	return parseExtraction(result);
}

async function pollRun(
	agentId: string,
	runId: string,
	auth: string,
	timeoutMs: number,
): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	const intervalMs = 5_000;

	for (;;) {
		const res = await fetch(
			`${CURSOR_BASE}/v1/agents/${agentId}/runs/${runId}`,
			{ headers: { Authorization: auth } },
		);
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Cursor get run failed ${res.status}: ${text}`);
		}
		const run = (await res.json()) as RunResponse;

		if (run.status === "FINISHED") {
			return run.result ?? "";
		}
		if (
			run.status === "ERROR" ||
			run.status === "CANCELLED" ||
			run.status === "EXPIRED"
		) {
			throw new Error(`Cursor run ended with status ${run.status}`);
		}

		if (Date.now() > deadline) {
			// Best-effort cancel so we don't keep a run alive on Cursor credits.
			await fetch(`${CURSOR_BASE}/v1/agents/${agentId}/runs/${runId}/cancel`, {
				method: "POST",
				headers: { Authorization: auth },
			}).catch(() => {});
			throw new Error(
				`Cursor run timed out after ${timeoutMs}ms (status ${run.status})`,
			);
		}
		await sleep(intervalMs);
	}
}

function parseExtraction(raw: string): MeetingExtraction {
	const jsonStr = extractJsonObject(raw);
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonStr);
	} catch (e) {
		throw new Error(
			`Could not parse Cursor result as JSON: ${(e as Error).message}\nraw: ${raw.slice(0, 500)}`,
		);
	}

	const obj = parsed as Partial<MeetingExtraction>;
	return {
		summary: typeof obj.summary === "string" ? obj.summary : "",
		actionItems: Array.isArray(obj.actionItems)
			? obj.actionItems.map(normalizeActionItem).filter((a) => a.title)
			: [],
		decisions: Array.isArray(obj.decisions)
			? obj.decisions.map(normalizeDecision).filter((d) => d.title)
			: [],
	};
}

function extractJsonObject(raw: string): string {
	const trimmed = raw.trim();
	// Strip ```json ... ``` fences if present.
	const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = fenceMatch ? fenceMatch[1] : trimmed;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error(`No JSON object found in Cursor result: ${raw.slice(0, 200)}`);
	}
	return candidate.slice(start, end + 1);
}

function normalizeActionItem(a: unknown): ActionItem {
	const o = (a ?? {}) as Record<string, unknown>;
	return {
		title: typeof o.title === "string" ? o.title.trim() : "",
		assignee: typeof o.assignee === "string" && o.assignee ? o.assignee : null,
		due: typeof o.due === "string" && o.due ? o.due : null,
		priority: typeof o.priority === "string" && o.priority ? o.priority : null,
	};
}

function normalizeDecision(d: unknown): Decision {
	const o = (d ?? {}) as Record<string, unknown>;
	return {
		title: typeof o.title === "string" ? o.title.trim() : "",
		context: typeof o.context === "string" && o.context ? o.context : null,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
