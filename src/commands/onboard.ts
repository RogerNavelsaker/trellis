import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import type { Command } from "commander";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, printSuccess } from "../system/utils.ts";

export interface OnboardOptions {
	stdout?: boolean;
	file?: string;
}

export interface OnboardResult {
	action: "printed" | "written" | "updated";
	path?: string;
}

const START_MARKER = "<!-- trellis:start -->";
const END_MARKER = "<!-- trellis:end -->";

export const ONBOARD_SNIPPET = `${START_MARKER}
## Trellis

Trellis stores specs, plans, and handoffs as git-native artifacts under \`.trellis/\`.
Never open the directory directly — use the CLI so events, locks, and validations stay consistent.

- \`tl init\` — scaffold \`.trellis/\` in a repo
- \`tl prime\` — load current specs, plans, and recent handoffs for an agent
- \`tl ready\` — list unblocked work to pick up now
- \`tl spec create <id>\` / \`tl plan create <id>\` — create durable intent and execution artifacts
- \`tl handoff append <plan> --from <role> --to <role> --summary "..."\` — record transfer of control
- \`tl sync\` — stage and commit changes under \`.trellis/\`
${END_MARKER}`;

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

export function applySnippet(
	existing: string,
	snippet: string = ONBOARD_SNIPPET,
): { body: string; replaced: boolean } {
	const startIdx = existing.indexOf(START_MARKER);
	const endIdx = existing.indexOf(END_MARKER);
	if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
		const before = existing.slice(0, startIdx);
		const after = existing.slice(endIdx + END_MARKER.length);
		return { body: `${before.trimEnd()}\n\n${snippet}\n${after.trimStart()}`, replaced: true };
	}
	if (startIdx !== -1 || endIdx !== -1) {
		throw new Error(
			"existing file has an unbalanced trellis marker pair; resolve manually before re-running",
		);
	}
	const trimmed = existing.trimEnd();
	return {
		body: trimmed.length === 0 ? `${snippet}\n` : `${trimmed}\n\n${snippet}\n`,
		replaced: false,
	};
}

async function resolveTarget(root: string, explicit?: string): Promise<string | null> {
	if (explicit) return explicit;
	for (const name of ["CLAUDE.md", "AGENTS.md"]) {
		const path = join(root, name);
		if (await fileExists(path)) return path;
	}
	return null;
}

export async function onboard(root: string, options: OnboardOptions = {}): Promise<OnboardResult> {
	if (options.stdout) {
		return { action: "printed" };
	}
	const target = await resolveTarget(root, options.file);
	if (!target) {
		return { action: "printed" };
	}
	const existing = (await fileExists(target)) ? await readFile(target, "utf8") : "";
	const { body, replaced } = applySnippet(existing);
	await writeFile(target, body, "utf8");
	return { action: replaced ? "updated" : "written", path: target };
}

/**
 * Register the top-level 'onboard' command.
 */
export function register(program: Command): void {
	program
		.command("onboard")
		.description("Write or update the Trellis section in CLAUDE.md / AGENTS.md")
		.option("--stdout", "Print the snippet to stdout without writing any file")
		.option("--file <path>", "Write to a specific file instead of auto-detecting")
		.action(async (opts: OnboardOptions) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const result = await onboard(cwd(), opts);
				if (result.action === "printed") {
					if (global.json) {
						jsonOutput("onboard", { action: "printed", snippet: ONBOARD_SNIPPET });
						return;
					}
					console.log(ONBOARD_SNIPPET);
					return;
				}
				if (global.json) {
					jsonOutput("onboard", { action: result.action, path: result.path });
					return;
				}
				printSuccess(
					`${result.action === "updated" ? "Updated" : "Wrote"} Trellis section in ${result.path}`,
				);
			} catch (error) {
				handleCommandError("onboard", error, global.json);
			}
		});
}
