import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { listPlans } from "../storage/plans.ts";
import { listSpecs } from "../storage/specs.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError } from "../system/utils.ts";
import type { PlanRecord, SpecRecord } from "../types.ts";

export interface ReadyOptions {
	agent?: string;
}

export interface ReadyPayload {
	plans: PlanRecord[];
	specsAwaitingPlan: SpecRecord[];
}

/**
 * Ready work:
 * - plans in draft or active (not blocked, not done)
 * - specs in active with no linked plan
 */
export async function buildReadyPayload(root: string): Promise<ReadyPayload> {
	const [specs, plans] = await Promise.all([listSpecs(root), listPlans(root)]);

	const readyPlans = plans
		.filter((plan) => plan.status === "draft" || plan.status === "active")
		.sort((left, right) => left.id.localeCompare(right.id));

	const specIdsWithPlans = new Set(
		plans.filter((plan) => plan.spec && plan.status !== "done").map((plan) => plan.spec as string),
	);
	const specsAwaitingPlan = specs
		.filter((spec) => spec.status === "active" && !specIdsWithPlans.has(spec.id))
		.sort((left, right) => left.id.localeCompare(right.id));

	return { plans: readyPlans, specsAwaitingPlan };
}

/**
 * Register the top-level 'ready' command.
 */
export function register(program: Command): void {
	program
		.command("ready")
		.description("List work an agent can act on now (unblocked plans, specs missing a plan)")
		.option("--agent <name>", "Reserved for handoff filtering (currently unused)")
		.action(async (_opts: ReadyOptions) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const payload = await buildReadyPayload(cwd());
				if (global.json) {
					jsonOutput("ready", {
						plans: payload.plans,
						specsAwaitingPlan: payload.specsAwaitingPlan,
						count: payload.plans.length + payload.specsAwaitingPlan.length,
					});
					return;
				}
				if (payload.plans.length === 0 && payload.specsAwaitingPlan.length === 0) {
					console.log("nothing ready");
					return;
				}
				if (payload.plans.length > 0) {
					console.log(chalk.bold("Ready plans:"));
					for (const plan of payload.plans) {
						const spec = plan.spec ? ` spec=${plan.spec}` : "";
						console.log(
							`  ${chalk.cyan(plan.id)} [${plan.status}]${spec} ${plan.title} (${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"})`,
						);
					}
				}
				if (payload.specsAwaitingPlan.length > 0) {
					console.log(chalk.bold("Specs awaiting a plan:"));
					for (const spec of payload.specsAwaitingPlan) {
						console.log(`  ${chalk.cyan(spec.id)} ${spec.title}`);
					}
				}
			} catch (error) {
				handleCommandError("ready", error, global.json);
			}
		});
}
