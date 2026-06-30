// Minimal Notion REST client authenticated with Dwayne's PAT.
// We use this (not the worker's `context.notion` integration) because the
// Ecosystem teamspace blocks integrations, and the PAT acts as the user.
// All methods are bounded by a hard timeout so a stalled call can't hang the
// sync. Responses are JSON; non-2xx responses throw with the body for context.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { loadConfig } from "./config.js";

const NOTION_BASE = "https://api.notion.com";

export class PatNotion {
	private token: string;
	private version: string;

	constructor(token: string, version: string) {
		this.token = token;
		this.version = version;
	}

	private headers(extra: Record<string, string> = {}): Record<string, string> {
		return {
			Authorization: `Bearer ${this.token}`,
			"Notion-Version": this.version,
			...extra,
		};
	}

	private async request(
		method: string,
		path: string,
		body?: unknown,
		timeoutMs = 30_000,
	): Promise<any> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetch(`${NOTION_BASE}/${path.replace(/^\//, "")}`, {
				method,
				headers: this.headers(
					body !== undefined ? { "Content-Type": "application/json" } : {},
				),
				body: body !== undefined ? JSON.stringify(body) : undefined,
				signal: controller.signal,
			});
			const text = await res.text();
			if (!res.ok) {
				throw new Error(`Notion ${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
			}
			return text ? JSON.parse(text) : null;
		} finally {
			clearTimeout(timer);
		}
	}

	// Query a database with optional filter/sorts. Returns page objects.
	// `pageSize` is treated as a hard TOTAL cap (not just per-page size), so
	// callers can limit how many rows a cycle processes.
	async queryDatabase(
		databaseId: string,
		opts: { filter?: any; sorts?: any; pageSize?: number } = {},
	): Promise<any[]> {
		const limit = opts.pageSize;
		const out: any[] = [];
		let startCursor: string | undefined;
		do {
			const res = await this.request("POST", `v1/databases/${databaseId}/query`, {
				filter: opts.filter,
				sorts: opts.sorts,
				page_size: limit ? Math.min(limit, 100) : 100,
				start_cursor: startCursor,
			});
			out.push(...(res.results ?? []));
			startCursor = res.has_more ? res.next_cursor : undefined;
			if (limit && out.length >= limit) break;
		} while (startCursor);
		return limit ? out.slice(0, limit) : out;
	}

	// List a block's children (one page). Caller handles pagination/recursion.
	async listBlockChildren(
		blockId: string,
		startCursor?: string,
	): Promise<{ results: any[]; has_more: boolean; next_cursor: string | null }> {
		const params = new URLSearchParams({ page_size: "100" });
		if (startCursor) params.set("start_cursor", startCursor);
		const res = await this.request(
			"GET",
			`v1/blocks/${blockId}/children?${params.toString()}`,
		);
		return {
			results: res.results ?? [],
			has_more: !!res.has_more,
			next_cursor: res.next_cursor ?? null,
		};
	}

	async retrievePage(pageId: string): Promise<any> {
		return this.request("GET", `v1/pages/${pageId}`);
	}

	async createPage(
		parent: any,
		properties: Record<string, any>,
		children?: any[],
	): Promise<{ id: string; url?: string }> {
		const res = await this.request("POST", "v1/pages", {
			parent,
			properties,
			children: children && children.length ? children : undefined,
		});
		return { id: res.id, url: res.url };
	}

	async updatePage(pageId: string, properties: Record<string, any>): Promise<void> {
		await this.request("PATCH", `v1/pages/${pageId}`, { properties });
	}

	async appendBlocks(blockId: string, children: any[]): Promise<void> {
		if (!children.length) return;
		await this.request("PATCH", `v1/blocks/${blockId}/children`, { children });
	}

	async listUsers(): Promise<any[]> {
		const out: any[] = [];
		let startCursor: string | undefined;
		do {
			const params = new URLSearchParams({ page_size: "100" });
			if (startCursor) params.set("start_cursor", startCursor);
			const res = await this.request("GET", `v1/users?${params.toString()}`);
			out.push(...(res.results ?? []));
			startCursor = res.has_more ? res.next_cursor : undefined;
		} while (startCursor);
		return out;
	}
}

export function patNotion(): PatNotion {
	const cfg = loadConfig();
	return new PatNotion(cfg.notionApiToken, cfg.notionVersion);
}
