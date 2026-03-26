import { cwd } from "node:process";
import type { Command } from "commander";
import { createSpec, listSpecs, readSpec, updateSpec } from "../storage/specs.ts";
import { jsonOutput } from "../system/json.ts";
import {
	collectValues,
	formatSpecSummary,
	handleCommandError,
	hasExplicitArrayOption,
	printSuccess,
	serializeForDisplay,
} from "../system/utils.ts";
import { transitionSpec } from "../workflow/transitions.ts";

/**
 * Register 'spec' subcommands.
 */
export function register(program: Command): void {
	const spec = program.command("spec").description("Manage Trellis specs");

	spec
		.command("create")
		.argument("<id>", "Spec identifier")
		.requiredOption("--title <title>", "Spec title")
		.requiredOption("--objective <text>", "Spec objective/body")
		.option("--seed <seed>", "Linked Seeds issue ID")
		.option("--status <status>", "draft | active | done", "draft")
		.option("--constraint <text>", "Constraint line", collectValues, [])
		.option("--acceptance <text>", "Acceptance line", collectValues, [])
		.option("--reference <text>", "Reference path or URL", collectValues, [])
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const record = await createSpec(cwd(), {
					id,
					title: opts.title,
					seed: opts.seed,
					status: opts.status,
					objective: opts.objective,
					constraints: opts.constraint,
					acceptance: opts.acceptance,
					references: opts.reference,
				});
				if (global.json) {
					jsonOutput("spec create", { spec: record });
					return;
				}
				printSuccess(`Created spec ${record.id}`);
			} catch (error) {
				handleCommandError("spec create", error, global.json);
			}
		});

	spec
		.command("show")
		.argument("<id>", "Spec identifier")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const record = await readSpec(cwd(), id);
				if (global.json) {
					jsonOutput("spec show", { spec: record });
					return;
				}
				console.log(serializeForDisplay(record));
			} catch (error) {
				handleCommandError("spec show", error, global.json);
			}
		});

	spec
		.command("update")
		.argument("<id>", "Spec identifier")
		.option("--title <title>", "Spec title")
		.option("--objective <text>", "Spec objective/body")
		.option("--seed <seed>", "Linked Seeds issue ID")
		.option("--status <status>", "draft | active | done")
		.option("--constraint <text>", "Replace constraints with repeated values", collectValues, [])
		.option("--acceptance <text>", "Replace acceptance with repeated values", collectValues, [])
		.option("--reference <text>", "Replace references with repeated values", collectValues, [])
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const patch = {
					title: opts.title,
					objective: opts.objective,
					seed: opts.seed,
					status: opts.status,
					constraints: hasExplicitArrayOption(opts.constraint) ? opts.constraint : undefined,
					acceptance: hasExplicitArrayOption(opts.acceptance) ? opts.acceptance : undefined,
					references: hasExplicitArrayOption(opts.reference) ? opts.reference : undefined,
				};
				const record = await updateSpec(cwd(), id, patch);
				if (global.json) {
					jsonOutput("spec update", { spec: record });
					return;
				}
				printSuccess(`Updated spec ${record.id}`);
			} catch (error) {
				handleCommandError("spec update", error, global.json);
			}
		});

	spec
		.command("start")
		.argument("<id>", "Spec identifier")
		.description("Transition a spec from draft to active")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const spec = await transitionSpec(cwd(), id, "active");
				if (global.json) {
					jsonOutput("spec start", { spec });
					return;
				}
				printSuccess(`Started spec ${spec.id}`);
			} catch (error) {
				handleCommandError("spec start", error, global.json);
			}
		});

	spec
		.command("complete")
		.argument("<id>", "Spec identifier")
		.requiredOption("--summary <text>", "Outcome summary for the completed spec")
		.description("Transition a spec from active to done")
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const spec = await transitionSpec(cwd(), id, "done", {
					summary: opts.summary,
				});
				if (global.json) {
					jsonOutput("spec complete", { spec });
					return;
				}
				printSuccess(`Completed spec ${spec.id}`);
			} catch (error) {
				handleCommandError("spec complete", error, global.json);
			}
		});

	spec
		.command("list")
		.option("--status <status>", "Filter by status")
		.option("--seed <seed>", "Filter by Seeds issue ID")
		.action(async (opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const filters = { status: opts.status, seed: opts.seed };
				const records = await listSpecs(cwd(), filters);
				if (global.json) {
					jsonOutput("spec list", {
						specs: records,
						count: records.length,
						filters,
					});
					return;
				}
				for (const record of records) {
					console.log(formatSpecSummary(record));
				}
			} catch (error) {
				handleCommandError("spec list", error, global.json);
			}
		});
}
