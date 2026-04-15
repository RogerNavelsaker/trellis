import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { readHandoffs } from "../storage/handoffs.ts";
import { listPlans } from "../storage/plans.ts";
import { listSpecs } from "../storage/specs.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, parseInteger } from "../system/utils.ts";
import type { HandoffRecord, PlanRecord, SpecRecord } from "../types.ts";
import { parseSince } from "./prime.ts";

export type Kind = "spec" | "plan" | "handoff";

export interface ListRow {
	kind: Kind;
	id: string;
	title: string;
	status: string;
	updatedAt: string;
	spec?: string;
	seed?: string;
	from?: string;
	to?: string;
	summary?: string;
	plan?: string;
}

export interface ListOptions {
	type?: "spec" | "plan" | "handoff" | "all";
	status?: string;
	since?: string;
	plan?: string;
	limit?: number;
}

function specToRow(record: SpecRecord): ListRow {
	return {
		kind: "spec",
		id: record.id,
		title: record.title,
		status: record.status,
		updatedAt: record.updatedAt,
		seed: record.seed,
	};
}

function planToRow(record: PlanRecord): ListRow {
	return {
		kind: "plan",
		id: record.id,
		title: record.title,
		status: record.status,
		updatedAt: record.updatedAt,
		spec: record.spec,
		seed: record.seed,
	};
}

function handoffToRow(record: HandoffRecord): ListRow {
	return {
		kind: "handoff",
		id: `${record.plan}@${record.timestamp}`,
		title: record.summary,
		status: "appended",
		updatedAt: record.timestamp,
		plan: record.plan,
		from: record.from,
		to: record.to,
		summary: record.summary,
		spec: record.spec,
		seed: record.seed,
	};
}

function parseStatusList(value: string | undefined): Set<string> | null {
	if (!value) return null;
	const entries = value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	return entries.length > 0 ? new Set(entries) : null;
}

export async function buildListRows(root: string, options: ListOptions = {}): Promise<ListRow[]> {
	const type = options.type ?? "all";
	const statusFilter = parseStatusList(options.status);
	const sinceIso = options.since ? parseSince(options.since) : null;
	if (options.since && !sinceIso) {
		throw new Error(`--since '${options.since}' is not a valid ISO or relative value`);
	}

	const rows: ListRow[] = [];

	if (type === "spec" || type === "all") {
		const specs = await listSpecs(root);
		for (const spec of specs) {
			if (statusFilter && !statusFilter.has(spec.status)) continue;
			if (sinceIso && spec.updatedAt < sinceIso) continue;
			rows.push(specToRow(spec));
		}
	}

	if (type === "plan" || type === "all") {
		const plans = await listPlans(root);
		for (const plan of plans) {
			if (statusFilter && !statusFilter.has(plan.status)) continue;
			if (sinceIso && plan.updatedAt < sinceIso) continue;
			rows.push(planToRow(plan));
		}
	}

	if (type === "handoff" || type === "all") {
		const plans = options.plan ? [options.plan] : (await listPlans(root)).map((plan) => plan.id);
		const nested = await Promise.all(plans.map((planId) => readHandoffs(root, planId)));
		let handoffs = nested.flat();
		if (sinceIso) handoffs = handoffs.filter((record) => record.timestamp >= sinceIso);
		handoffs.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
		for (const handoff of handoffs) rows.push(handoffToRow(handoff));
	}

	if (options.limit && options.limit > 0) {
		return capPerKind(rows, options.limit);
	}

	return rows.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
}

function capPerKind(rows: ListRow[], limit: number): ListRow[] {
	const byKind = new Map<Kind, ListRow[]>();
	for (const row of rows) {
		const bucket = byKind.get(row.kind) ?? [];
		bucket.push(row);
		byKind.set(row.kind, bucket);
	}
	const capped: ListRow[] = [];
	for (const bucket of byKind.values()) {
		bucket.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
		capped.push(...bucket.slice(-limit));
	}
	return capped.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
}

function formatRow(row: ListRow): string {
	if (row.kind === "handoff") {
		return `${chalk.cyan(row.updatedAt)} handoff ${row.plan} ${row.from} -> ${row.to}: ${row.summary ?? ""}`;
	}
	const link =
		row.kind === "plan"
			? `${row.spec ? ` spec=${row.spec}` : ""}${row.seed ? ` seed=${row.seed}` : ""}`
			: row.seed
				? ` seed=${row.seed}`
				: "";
	return `${chalk.cyan(row.id)} ${row.kind} [${row.status}]${link} ${row.title}`;
}

/**
 * Register the top-level 'list' command.
 */
export function register(program: Command): void {
	program
		.command("list")
		.description("Unified list of specs, plans, and handoffs")
		.option("--type <kind>", "spec | plan | handoff | all (default all)", "all")
		.option("--status <list>", "Comma-separated status filter for specs/plans")
		.option("--since <iso|relative>", "Only include items updated at or after this point")
		.option("--plan <id>", "When listing handoffs, restrict to one plan")
		.option("--limit <count>", "Cap rows per kind", parseInteger)
		.action(async (opts: ListOptions) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				if (opts.type && !["spec", "plan", "handoff", "all"].includes(opts.type)) {
					throw new Error(`--type must be one of spec|plan|handoff|all, got '${opts.type}'`);
				}
				const rows = await buildListRows(cwd(), opts);
				if (global.json) {
					jsonOutput("list", { rows, count: rows.length });
					return;
				}
				for (const row of rows) console.log(formatRow(row));
			} catch (error) {
				handleCommandError("list", error, global.json);
			}
		});
}
