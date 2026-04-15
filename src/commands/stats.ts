import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { readHandoffs } from "../storage/handoffs.ts";
import { listPlans } from "../storage/plans.ts";
import { listSpecs } from "../storage/specs.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError } from "../system/utils.ts";
import { auditOrphaned } from "../workflow/audit.ts";

export interface StatsPayload {
	specs: Record<string, number>;
	plans: Record<string, number>;
	planSteps: { active: number; done: number };
	handoffs: { total: number; last7d: number; last30d: number };
	orphans: {
		specsWithoutPlans: number;
		plansWithMissingSpecs: number;
		handoffsForMissingPlans: number;
	};
}

export async function buildStatsPayload(
	root: string,
	now: Date = new Date(),
): Promise<StatsPayload> {
	const [specs, plans, orphans] = await Promise.all([
		listSpecs(root),
		listPlans(root),
		auditOrphaned(root),
	]);

	const specCounts: Record<string, number> = { draft: 0, active: 0, done: 0 };
	for (const spec of specs) specCounts[spec.status] = (specCounts[spec.status] ?? 0) + 1;

	const planCounts: Record<string, number> = { draft: 0, active: 0, blocked: 0, done: 0 };
	let stepsActive = 0;
	let stepsDone = 0;
	for (const plan of plans) {
		planCounts[plan.status] = (planCounts[plan.status] ?? 0) + 1;
		if (plan.status === "done") stepsDone += plan.steps.length;
		else stepsActive += plan.steps.length;
	}

	const nested = await Promise.all(plans.map((plan) => readHandoffs(root, plan.id)));
	const handoffs = nested.flat();
	const nowMs = now.getTime();
	const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
	const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
	let last7d = 0;
	let last30d = 0;
	for (const handoff of handoffs) {
		const ageMs = nowMs - new Date(handoff.timestamp).getTime();
		if (ageMs <= sevenDaysMs) last7d += 1;
		if (ageMs <= thirtyDaysMs) last30d += 1;
	}

	return {
		specs: specCounts,
		plans: planCounts,
		planSteps: { active: stepsActive, done: stepsDone },
		handoffs: { total: handoffs.length, last7d, last30d },
		orphans: {
			specsWithoutPlans: orphans.specsWithoutPlans.length,
			plansWithMissingSpecs: orphans.plansWithMissingSpecs.length,
			handoffsForMissingPlans: orphans.handoffsForMissingPlans.length,
		},
	};
}

function renderStats(payload: StatsPayload): string {
	const lines: string[] = [];
	lines.push(chalk.bold("Specs"));
	lines.push(
		`  draft=${payload.specs.draft ?? 0}  active=${payload.specs.active ?? 0}  done=${payload.specs.done ?? 0}`,
	);
	lines.push(chalk.bold("Plans"));
	lines.push(
		`  draft=${payload.plans.draft ?? 0}  active=${payload.plans.active ?? 0}  blocked=${payload.plans.blocked ?? 0}  done=${payload.plans.done ?? 0}`,
	);
	lines.push(`  steps: active=${payload.planSteps.active}  done=${payload.planSteps.done}`);
	lines.push(chalk.bold("Handoffs"));
	lines.push(
		`  total=${payload.handoffs.total}  last7d=${payload.handoffs.last7d}  last30d=${payload.handoffs.last30d}`,
	);
	lines.push(chalk.bold("Orphans"));
	lines.push(
		`  specs-without-plans=${payload.orphans.specsWithoutPlans}  plans-missing-spec=${payload.orphans.plansWithMissingSpecs}  handoffs-missing-plan=${payload.orphans.handoffsForMissingPlans}`,
	);
	return lines.join("\n");
}

/**
 * Register the top-level 'stats' command.
 */
export function register(program: Command): void {
	program
		.command("stats")
		.description("Aggregate counts across specs, plans, handoffs, and orphans")
		.action(async () => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const payload = await buildStatsPayload(cwd());
				if (global.json) {
					jsonOutput("stats", payload as unknown as Record<string, unknown>);
					return;
				}
				console.log(renderStats(payload));
			} catch (error) {
				handleCommandError("stats", error, global.json);
			}
		});
}
