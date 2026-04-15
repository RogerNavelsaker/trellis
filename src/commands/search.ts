import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { readHandoffs } from "../storage/handoffs.ts";
import { listPlans } from "../storage/plans.ts";
import { listSpecs } from "../storage/specs.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, parseInteger } from "../system/utils.ts";

export type SearchKind = "spec" | "plan" | "handoff";

export interface SearchHit {
	kind: SearchKind;
	id: string;
	field: string;
	snippet: string;
	score: number;
}

export interface SearchOptions {
	type?: "spec" | "plan" | "handoff" | "all";
	limit?: number;
}

function matchField(field: string, value: string | undefined, needle: string): string | null {
	if (!value) return null;
	const lower = value.toLowerCase();
	const idx = lower.indexOf(needle);
	if (idx === -1) return null;
	const start = Math.max(0, idx - 20);
	const end = Math.min(value.length, idx + needle.length + 40);
	const prefix = start > 0 ? "…" : "";
	const suffix = end < value.length ? "…" : "";
	void field;
	return `${prefix}${value.slice(start, end)}${suffix}`;
}

export async function searchArtifacts(
	root: string,
	query: string,
	options: SearchOptions = {},
): Promise<SearchHit[]> {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const type = options.type ?? "all";
	const hits: SearchHit[] = [];

	if (type === "spec" || type === "all") {
		const specs = await listSpecs(root);
		for (const spec of specs) {
			for (const [field, value] of [
				["title", spec.title],
				["objective", spec.objective],
				["id", spec.id],
			] as const) {
				const snippet = matchField(field, value, needle);
				if (snippet !== null) {
					hits.push({
						kind: "spec",
						id: spec.id,
						field,
						snippet,
						score: field === "title" ? 2 : 1,
					});
					break;
				}
			}
		}
	}

	if (type === "plan" || type === "all") {
		const plans = await listPlans(root);
		for (const plan of plans) {
			const candidates: Array<[string, string | undefined]> = [
				["title", plan.title],
				["summary", plan.summary],
				["id", plan.id],
			];
			let matched = false;
			for (const [field, value] of candidates) {
				const snippet = matchField(field, value, needle);
				if (snippet !== null) {
					hits.push({
						kind: "plan",
						id: plan.id,
						field,
						snippet,
						score: field === "title" ? 2 : 1,
					});
					matched = true;
					break;
				}
			}
			if (matched) continue;
			for (const [idx, step] of plan.steps.entries()) {
				const snippet = matchField("step", step, needle);
				if (snippet !== null) {
					hits.push({
						kind: "plan",
						id: plan.id,
						field: `steps[${idx}]`,
						snippet,
						score: 1,
					});
					break;
				}
			}
		}
	}

	if (type === "handoff" || type === "all") {
		const planIds = (await listPlans(root)).map((plan) => plan.id);
		const nested = await Promise.all(planIds.map((planId) => readHandoffs(root, planId)));
		for (const handoff of nested.flat()) {
			const snippet = matchField("summary", handoff.summary, needle);
			if (snippet !== null) {
				hits.push({
					kind: "handoff",
					id: `${handoff.plan}@${handoff.timestamp}`,
					field: "summary",
					snippet,
					score: 1,
				});
			}
		}
	}

	hits.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
	if (options.limit && options.limit > 0) return hits.slice(0, options.limit);
	return hits;
}

/**
 * Register the top-level 'search' command.
 */
export function register(program: Command): void {
	program
		.command("search")
		.argument("<query>", "Substring to search for (case-insensitive)")
		.description("Substring search across specs, plans, and handoffs")
		.option("--type <kind>", "spec | plan | handoff | all (default all)", "all")
		.option("--limit <count>", "Cap total matches", parseInteger)
		.action(async (query: string, opts: SearchOptions) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				if (opts.type && !["spec", "plan", "handoff", "all"].includes(opts.type)) {
					throw new Error(`--type must be one of spec|plan|handoff|all, got '${opts.type}'`);
				}
				const hits = await searchArtifacts(cwd(), query, opts);
				if (global.json) {
					jsonOutput("search", { hits, count: hits.length, query });
					return;
				}
				if (hits.length === 0) {
					console.log("no matches");
					return;
				}
				for (const hit of hits) {
					console.log(`${chalk.cyan(hit.id)} ${hit.kind}:${hit.field} — ${hit.snippet}`);
				}
			} catch (error) {
				handleCommandError("search", error, global.json);
			}
		});
}
