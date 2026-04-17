import { cwd } from "node:process";
import type { Command } from "commander";
import { createPlan, listPlans, readPlan, updatePlan } from "../storage/plans.ts";
import { jsonOutput } from "../system/json.ts";
import {
	collectValues,
	formatPlanSummary,
	handleCommandError,
	hasExplicitArrayOption,
	printSuccess,
	printWarning,
	serializeForDisplay,
} from "../system/utils.ts";
import { transitionPlan } from "../workflow/transitions.ts";

/**
 * Register 'plan' subcommands.
 */
export function register(program: Command): void {
	const plan = program.command("plan").description("Manage Trellis plans");

	plan
		.command("create")
		.description("Create a new execution plan")
		.argument("<id>", "Plan identifier")
		.requiredOption("--title <title>", "Plan title")
		.option("--seed <seed>", "Linked Seeds issue ID")
		.option("--spec <spec>", "Linked Trellis spec ID")
		.option("--status <status>", "draft | active | blocked | done", "draft")
		.option("--summary <text>", "Plan summary", "")
		.option("--step <text>", "Plan step", collectValues, [])
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const record = await createPlan(cwd(), {
					id,
					title: opts.title,
					seed: opts.seed,
					spec: opts.spec,
					status: opts.status,
					summary: opts.summary,
					steps: opts.step,
				});
				if (global.json) {
					jsonOutput("plan create", { plan: record });
					return;
				}
				printSuccess(`Created plan ${record.id}`);
			} catch (error) {
				handleCommandError("plan create", error, global.json);
			}
		});

	plan
		.command("show")
		.description("Show plan details")
		.argument("<id>", "Plan identifier")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const record = await readPlan(cwd(), id);
				if (global.json) {
					jsonOutput("plan show", { plan: record });
					return;
				}
				console.log(serializeForDisplay(record));
			} catch (error) {
				handleCommandError("plan show", error, global.json);
			}
		});

	plan
		.command("update")
		.description("Update plan fields")
		.argument("<id>", "Plan identifier")
		.option("--title <title>", "Plan title")
		.option("--seed <seed>", "Linked Seeds issue ID")
		.option("--spec <spec>", "Linked Trellis spec ID")
		.option("--status <status>", "draft | active | blocked | done")
		.option("--summary <text>", "Plan summary")
		.option("--step <text>", "Replace steps with repeated values", collectValues, [])
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const patch = {
					title: opts.title,
					seed: opts.seed,
					spec: opts.spec,
					status: opts.status,
					summary: opts.summary,
					steps: hasExplicitArrayOption(opts.step) ? opts.step : undefined,
				};
				const record = await updatePlan(cwd(), id, patch);
				if (global.json) {
					jsonOutput("plan update", { plan: record });
					return;
				}
				printSuccess(`Updated plan ${record.id}`);
			} catch (error) {
				handleCommandError("plan update", error, global.json);
			}
		});

	plan
		.command("start")
		.argument("<id>", "Plan identifier")
		.description("Transition a plan into active work")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const plan = await transitionPlan(cwd(), id, "active");
				if (global.json) {
					jsonOutput("plan start", { plan });
					return;
				}
				printSuccess(`Started plan ${plan.id}`);
			} catch (error) {
				handleCommandError("plan start", error, global.json);
			}
		});

	plan
		.command("block")
		.argument("<id>", "Plan identifier")
		.requiredOption("--reason <text>", "Why the plan is blocked")
		.option("--from <name>", "Actor recording the block")
		.option("--to <name>", "Who should receive the handoff")
		.description("Block a plan and optionally record a handoff reason")
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const plan = await transitionPlan(cwd(), id, "blocked", {
					reason: opts.reason,
					actor: opts.from,
					to: opts.to,
				});
				if (global.json) {
					jsonOutput("plan block", { plan });
					return;
				}
				printWarning(`Blocked plan ${plan.id}`);
			} catch (error) {
				handleCommandError("plan block", error, global.json);
			}
		});

	plan
		.command("resume")
		.argument("<id>", "Plan identifier")
		.description("Resume a blocked plan back to active")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const plan = await transitionPlan(cwd(), id, "active");
				if (global.json) {
					jsonOutput("plan resume", { plan });
					return;
				}
				printSuccess(`Resumed plan ${plan.id}`);
			} catch (error) {
				handleCommandError("plan resume", error, global.json);
			}
		});

	plan
		.command("complete")
		.argument("<id>", "Plan identifier")
		.requiredOption("--summary <text>", "Outcome summary for the completed plan")
		.option("--from <name>", "Actor recording completion")
		.option("--to <name>", "Optional recipient for completion handoff")
		.description("Transition a plan into done")
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const plan = await transitionPlan(cwd(), id, "done", {
					summary: opts.summary,
					actor: opts.from,
					to: opts.to,
				});
				if (global.json) {
					jsonOutput("plan complete", { plan });
					return;
				}
				printSuccess(`Completed plan ${plan.id}`);
			} catch (error) {
				handleCommandError("plan complete", error, global.json);
			}
		});

	plan
		.command("list")
		.description("List plans with filters")
		.option("--status <status>", "Filter by status")
		.option("--seed <seed>", "Filter by Seeds issue ID")
		.option("--spec <spec>", "Filter by linked spec ID")
		.action(async (opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const filters = {
					status: opts.status,
					seed: opts.seed,
					spec: opts.spec,
				};
				const records = await listPlans(cwd(), filters);
				if (global.json) {
					jsonOutput("plan list", {
						plans: records,
						count: records.length,
						filters,
					});
					return;
				}
				for (const record of records) {
					console.log(formatPlanSummary(record));
				}
			} catch (error) {
				handleCommandError("plan list", error, global.json);
			}
		});
}
