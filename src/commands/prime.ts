import { cwd } from "node:process";
import type { Command } from "commander";
import { readEvents } from "../storage/events.ts";
import { readHandoffs } from "../storage/handoffs.ts";
import { listPlans } from "../storage/plans.ts";
import { listSpecs } from "../storage/specs.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, parseInteger } from "../system/utils.ts";
import type { HandoffRecord, PlanRecord, SpecRecord } from "../types.ts";

const DEFAULT_STATUSES = ["draft", "active", "blocked"] as const;
const DEFAULT_HANDOFF_LIMIT = 10;

export interface PrimeOptions {
	full?: boolean;
	compact?: boolean;
	budget?: number;
	since?: string;
	status?: string;
	limit?: number;
}

export interface PrimePayload {
	generatedAt: string;
	specs: SpecRecord[];
	plans: PlanRecord[];
	blocked: Array<{ plan: PlanRecord; reason: string | null }>;
	handoffs: HandoffRecord[];
	truncated: { handoffs: boolean; stepNotes: boolean };
}

/**
 * Parse a --since value: ISO timestamp or relative ("7d", "24h", "30m", "45s").
 * Returns an ISO string or null on unparseable input.
 */
export function parseSince(value: string, now: Date = new Date()): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const relative = /^(\d+)\s*([smhd])$/i.exec(trimmed);
	if (relative) {
		const qty = Number(relative[1]);
		const unit = relative[2]?.toLowerCase();
		const ms =
			unit === "s"
				? qty * 1000
				: unit === "m"
					? qty * 60_000
					: unit === "h"
						? qty * 3_600_000
						: qty * 86_400_000;
		return new Date(now.getTime() - ms).toISOString();
	}
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString();
}

function parseStatusList(value: string | undefined): string[] {
	if (!value) return [...DEFAULT_STATUSES];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

async function collectHandoffs(root: string, plans: PlanRecord[]): Promise<HandoffRecord[]> {
	const nested = await Promise.all(plans.map((plan) => readHandoffs(root, plan.id)));
	return nested.flat().sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

async function latestBlockReasons(
	root: string,
	blockedPlans: PlanRecord[],
): Promise<Map<string, string>> {
	if (blockedPlans.length === 0) return new Map();
	const events = await readEvents(root);
	const ids = new Set(blockedPlans.map((plan) => plan.id));
	const reasons = new Map<string, string>();
	for (const event of events) {
		if (
			event.type === "plan.transition" &&
			event.toStatus === "blocked" &&
			event.artifactId &&
			ids.has(event.artifactId) &&
			event.summary
		) {
			reasons.set(event.artifactId, event.summary);
		}
	}
	return reasons;
}

export async function buildPrimePayload(
	root: string,
	options: PrimeOptions = {},
): Promise<PrimePayload> {
	const statuses = parseStatusList(options.status);
	const sinceIso = options.since ? parseSince(options.since) : null;

	const [allSpecs, allPlans] = await Promise.all([listSpecs(root), listPlans(root)]);
	const specs = allSpecs.filter((spec) => statuses.includes(spec.status));
	const plans = allPlans.filter((plan) => statuses.includes(plan.status));
	const blockedPlans = allPlans.filter((plan) => plan.status === "blocked");

	const reasonMap = await latestBlockReasons(root, blockedPlans);
	const blocked = blockedPlans.map((plan) => ({
		plan,
		reason: reasonMap.get(plan.id) ?? null,
	}));

	let handoffs = await collectHandoffs(root, allPlans);
	if (sinceIso) {
		handoffs = handoffs.filter((record) => record.timestamp >= sinceIso);
	}

	const handoffCap = options.limit ?? DEFAULT_HANDOFF_LIMIT;
	const handoffTruncated = handoffs.length > handoffCap;
	handoffs = handoffs.slice(-handoffCap);

	const truncated = { handoffs: handoffTruncated, stepNotes: false };

	if (options.budget && options.budget > 0) {
		const enforced = enforceBudget(
			{ specs, plans, blocked, handoffs },
			options.budget,
			Boolean(options.full),
		);
		return {
			generatedAt: new Date().toISOString(),
			...enforced,
			truncated: {
				handoffs: truncated.handoffs || enforced.truncated.handoffs,
				stepNotes: enforced.truncated.stepNotes,
			},
		};
	}

	return {
		generatedAt: new Date().toISOString(),
		specs,
		plans,
		blocked,
		handoffs,
		truncated,
	};
}

interface BudgetInput {
	specs: SpecRecord[];
	plans: PlanRecord[];
	blocked: Array<{ plan: PlanRecord; reason: string | null }>;
	handoffs: HandoffRecord[];
}

function approxTokens(value: string): number {
	return Math.ceil(value.length / 4);
}

function payloadTokens(input: BudgetInput, full: boolean): number {
	return approxTokens(renderMarkdown(input, full));
}

/**
 * Drop content in priority order: oldest handoffs → step notes → handoffs entirely.
 */
function enforceBudget(
	input: BudgetInput,
	budget: number,
	full: boolean,
): BudgetInput & { truncated: { handoffs: boolean; stepNotes: boolean } } {
	let { specs, plans, blocked, handoffs } = input;
	let handoffsTruncated = false;
	let stepNotesTruncated = false;

	while (payloadTokens({ specs, plans, blocked, handoffs }, full) > budget && handoffs.length > 0) {
		handoffs = handoffs.slice(1);
		handoffsTruncated = true;
	}

	if (payloadTokens({ specs, plans, blocked, handoffs }, full) > budget && full) {
		full = false;
		stepNotesTruncated = true;
	}

	if (payloadTokens({ specs, plans, blocked, handoffs }, full) > budget && handoffs.length > 0) {
		handoffs = [];
		handoffsTruncated = true;
	}

	return {
		specs,
		plans,
		blocked,
		handoffs,
		truncated: { handoffs: handoffsTruncated, stepNotes: stepNotesTruncated },
	};
}

export function renderMarkdown(
	input: Pick<PrimePayload, "specs" | "plans" | "blocked" | "handoffs">,
	full: boolean,
): string {
	const lines: string[] = [];
	lines.push("# Trellis — prime");
	lines.push("");

	lines.push(`## Specs (${input.specs.length})`);
	if (input.specs.length === 0) {
		lines.push("_none_");
	} else {
		for (const spec of input.specs) {
			const seed = spec.seed ? ` seed=${spec.seed}` : "";
			lines.push(`- \`${spec.id}\` [${spec.status}]${seed} — ${spec.title}`);
		}
	}
	lines.push("");

	lines.push(`## Plans (${input.plans.length})`);
	if (input.plans.length === 0) {
		lines.push("_none_");
	} else {
		for (const plan of input.plans) {
			const spec = plan.spec ? ` spec=${plan.spec}` : "";
			const seed = plan.seed ? ` seed=${plan.seed}` : "";
			lines.push(
				`- \`${plan.id}\` [${plan.status}]${spec}${seed} — ${plan.title} (${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"})`,
			);
			if (full && plan.steps.length > 0) {
				for (const step of plan.steps) {
					lines.push(`  - ${step}`);
				}
			}
		}
	}
	lines.push("");

	lines.push(`## Blocked (${input.blocked.length})`);
	if (input.blocked.length === 0) {
		lines.push("_none_");
	} else {
		for (const entry of input.blocked) {
			const reason = entry.reason ?? "no reason recorded";
			lines.push(`- \`${entry.plan.id}\` — ${reason}`);
		}
	}
	lines.push("");

	lines.push(`## Recent handoffs (${input.handoffs.length})`);
	if (input.handoffs.length === 0) {
		lines.push("_none_");
	} else {
		for (const handoff of input.handoffs) {
			const summary = full ? handoff.summary : truncate(handoff.summary, 120);
			lines.push(
				`- ${handoff.timestamp} \`${handoff.plan}\` ${handoff.from} → ${handoff.to}: ${summary}`,
			);
		}
	}

	return lines.join("\n");
}

function truncate(value: string, max: number): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max - 1)}…`;
}

/**
 * Register the 'prime' top-level command.
 */
export function register(program: Command): void {
	program
		.command("prime")
		.description("Emit a compact summary of active trellis state for agent priming")
		.option("--full", "Include plan step notes and full handoff summaries")
		.option("--compact", "Compact output (default)")
		.option("--budget <tokens>", "Soft token cap (approximate)", parseInteger)
		.option("--since <iso|relative>", "Only handoffs at or after this point (e.g. 24h, 7d, ISO)")
		.option(
			"--status <list>",
			"Comma-separated statuses to treat as active",
			DEFAULT_STATUSES.join(","),
		)
		.option("--limit <count>", "Cap on handoffs included (default 10)", parseInteger)
		.action(async (opts: PrimeOptions) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				if (opts.since && !parseSince(opts.since)) {
					throw new Error(`--since '${opts.since}' is not a valid ISO or relative value`);
				}
				const payload = await buildPrimePayload(cwd(), opts);
				if (global.json) {
					jsonOutput("prime", payload as unknown as Record<string, unknown>);
					return;
				}
				console.log(renderMarkdown(payload, Boolean(opts.full)));
			} catch (error) {
				handleCommandError("prime", error, global.json);
			}
		});
}
