// Helpers for reading Notion pages via the PAT client: extract the title from a
// page regardless of the title property's name, and flatten a page's block tree
// into markdown text to feed to the Cursor agent.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PatNotion } from "./pat-notion.js";

// Find the value of the title-typed property on a page object.
export function extractPageTitle(page: any, fallbackProp?: string | null): string {
	const props = page?.properties ?? {};
	if (fallbackProp && props[fallbackProp]?.title) {
		return richTextToString(props[fallbackProp].title);
	}
	for (const key of Object.keys(props)) {
		const prop = props[key];
		if (prop?.type === "title" && Array.isArray(prop.title)) {
			return richTextToString(prop.title);
		}
	}
	return page?.url ?? "Untitled meeting";
}

export function richTextToString(richText: any[]): string {
	if (!Array.isArray(richText)) return "";
	return richText
		.map((rt) => rt?.plain_text ?? rt?.text?.content ?? "")
		.join("");
}

// Recursively fetch all blocks under a page/block and convert to markdown.
// Depth and total length are bounded so a huge meeting can't blow the prompt.
export async function pageToMarkdown(
	notion: PatNotion,
	pageId: string,
	maxBlocks = 200,
): Promise<string> {
	const parts: string[] = [];
	await walkBlocks(notion, pageId, parts, 0, maxBlocks);
	return parts.join("\n").trim();
}

async function walkBlocks(
	notion: PatNotion,
	blockId: string,
	out: string[],
	depth: number,
	maxBlocks: number,
): Promise<void> {
	if (out.length > maxBlocks) return;
	let cursor: string | undefined;
	do {
		const res = await notion.listBlockChildren(blockId, cursor);
		for (const block of res.results ?? []) {
			if (out.length > maxBlocks) return;
			const line = blockToMarkdown(block, depth);
			if (line) out.push(line);
			if (block.has_children) {
				await walkBlocks(notion, block.id, out, depth + 1, maxBlocks);
			}
		}
		cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
	} while (cursor);
}

function blockToMarkdown(block: any, depth: number): string {
	const type = block?.type;
	if (!type) return "";
	const data = block[type] ?? {};
	const indent = "  ".repeat(depth);
	const text = richTextToString(data.rich_text ?? data.text ?? []);

	switch (type) {
		case "paragraph":
			return text ? `${indent}${text}` : "";
		case "heading_1":
			return `${indent}# ${text}`;
		case "heading_2":
			return `${indent}## ${text}`;
		case "heading_3":
			return `${indent}### ${text}`;
		case "bulleted_list_item":
			return `${indent}- ${text}`;
		case "numbered_list_item":
			return `${indent}1. ${text}`;
		case "to_do":
			return `${indent}- [${data.checked ? "x" : " "}] ${text}`;
		case "callout":
			return `${indent}> ${text}`;
		case "quote":
			return `${indent}> ${text}`;
		case "toggle":
			return `${indent}<details>${text}`;
		case "code":
			return `${indent}\`\`\`\n${text}\n\`\`\``;
		case "divider":
			return `${indent}---`;
		case "image":
			return `${indent}[image]`;
		case "child_page":
			return `${indent}## ${block.child_page?.title ?? ""}`;
		default:
			return text ? `${indent}${text}` : "";
	}
}
