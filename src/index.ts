#!/usr/bin/env bun

import { dirname, join } from "node:path";
import { cwd, platform } from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { doctorProject } from "./doctor.ts";
import { appendHandoff, readHandoffs } from "./handoffs.ts";
import { initProject } from "./init.ts";
import { jsonError, jsonOutput } from "./json.ts";
import { createPlan, listPlans, readPlan, updatePlan } from "./plans.ts";
import { renderTemplate } from "./render.ts";
import { createSpec, listSpecs, readSpec, updateSpec } from "./specs.ts";
import {
	initTemplates,
	readTemplate,
	TEMPLATE_PLACEHOLDERS,
	type TemplateKind,
} from "./templates.ts";
import { transitionPlan, transitionSpec } from "./transitions.ts";

export const VERSION = "0.1.0";

function packageName(): string {
	return "@os-eco/trellis-cli";
}

function runtimeString(): string {
	return `bun-${platform}`;
}

async function main(): Promise<void> {
	const program = new Command();

	program
		.name("trellis")
		.description(
			"Git-native specs, plans, and handoff artifacts for the os-eco toolchain",
		)
		.option("--json", "Machine-readable JSON output")
		.option("--quiet, -q", "Suppress non-error output")
		.option("--verbose", "Extra diagnostic output")
		.option("--timing", "Print execution time to stderr")
		.version(VERSION, "-v, --version", "Print version")
		.addHelpText(
			"after",
			[
				"",
				"Docs:",
				"  https://github.com/RogerNavelsaker/trellis",
				"",
				"Scope:",
				"  Trellis owns repo-local specs, plans, and handoff artifacts.",
			].join("\n"),
		);

	program
		.command("init")
		.description("Scaffold the managed .trellis/ layout")
		.action(async () => {
			const opts = program.opts<{ json?: boolean }>();
			try {
				await initProject(cwd());
				if (opts.json) {
					jsonOutput("init", {
						root: cwd(),
						trellisDir: join(cwd(), ".trellis"),
					});
					return;
				}
				console.log(chalk.green("Initialized .trellis/"));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (opts.json) {
					jsonError("init", message);
					return;
				}
				console.error(chalk.red(message));
				process.exitCode = 1;
			}
		});

	program
		.command("doctor")
		.description("Validate the managed .trellis/ layout")
		.action(async () => {
			const opts = program.opts<{ json?: boolean }>();
			const checks = await doctorProject(cwd());
			const failed = checks.filter((check) => !check.ok);
			if (opts.json) {
				jsonOutput("doctor", {
					root: cwd(),
					checks,
					failed: failed.length,
				});
				if (failed.length > 0) process.exitCode = 1;
				return;
			}
			for (const check of checks) {
				const icon = check.ok ? chalk.green("✓") : chalk.red("x");
				console.log(`${icon} ${check.name} ${check.detail}`);
			}
			if (failed.length > 0) process.exitCode = 1;
		});

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
				console.log(chalk.green(`Created spec ${record.id}`));
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
		.option(
			"--constraint <text>",
			"Replace constraints with repeated values",
			collectValues,
			[],
		)
		.option(
			"--acceptance <text>",
			"Replace acceptance with repeated values",
			collectValues,
			[],
		)
		.option(
			"--reference <text>",
			"Replace references with repeated values",
			collectValues,
			[],
		)
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const patch = {
					title: opts.title,
					objective: opts.objective,
					seed: opts.seed,
					status: opts.status,
					constraints: hasExplicitArrayOption(opts.constraint)
						? opts.constraint
						: undefined,
					acceptance: hasExplicitArrayOption(opts.acceptance)
						? opts.acceptance
						: undefined,
					references: hasExplicitArrayOption(opts.reference)
						? opts.reference
						: undefined,
				};
				const record = await updateSpec(cwd(), id, patch);
				if (global.json) {
					jsonOutput("spec update", { spec: record });
					return;
				}
				console.log(chalk.green(`Updated spec ${record.id}`));
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
				console.log(chalk.green(`Started spec ${spec.id}`));
			} catch (error) {
				handleCommandError("spec start", error, global.json);
			}
		});
	spec
		.command("complete")
		.argument("<id>", "Spec identifier")
		.description("Transition a spec from active to done")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const spec = await transitionSpec(cwd(), id, "done");
				if (global.json) {
					jsonOutput("spec complete", { spec });
					return;
				}
				console.log(chalk.green(`Completed spec ${spec.id}`));
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

	const plan = program.command("plan").description("Manage Trellis plans");
	plan
		.command("create")
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
				console.log(chalk.green(`Created plan ${record.id}`));
			} catch (error) {
				handleCommandError("plan create", error, global.json);
			}
		});
	plan
		.command("show")
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
		.argument("<id>", "Plan identifier")
		.option("--title <title>", "Plan title")
		.option("--seed <seed>", "Linked Seeds issue ID")
		.option("--spec <spec>", "Linked Trellis spec ID")
		.option("--status <status>", "draft | active | blocked | done")
		.option("--summary <text>", "Plan summary")
		.option(
			"--step <text>",
			"Replace steps with repeated values",
			collectValues,
			[],
		)
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
				console.log(chalk.green(`Updated plan ${record.id}`));
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
				console.log(chalk.green(`Started plan ${plan.id}`));
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
				console.log(chalk.yellow(`Blocked plan ${plan.id}`));
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
				console.log(chalk.green(`Resumed plan ${plan.id}`));
			} catch (error) {
				handleCommandError("plan resume", error, global.json);
			}
		});
	plan
		.command("complete")
		.argument("<id>", "Plan identifier")
		.option("--reason <text>", "Completion note")
		.option("--from <name>", "Actor recording completion")
		.option("--to <name>", "Optional recipient for completion handoff")
		.description("Transition a plan into done")
		.action(async (id: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const plan = await transitionPlan(cwd(), id, "done", {
					reason: opts.reason,
					actor: opts.from,
					to: opts.to,
				});
				if (global.json) {
					jsonOutput("plan complete", { plan });
					return;
				}
				console.log(chalk.green(`Completed plan ${plan.id}`));
			} catch (error) {
				handleCommandError("plan complete", error, global.json);
			}
		});
	plan
		.command("list")
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

	const handoff = program
		.command("handoff")
		.description("Append and inspect handoff logs");
	handoff
		.command("append")
		.argument("<plan>", "Plan identifier")
		.requiredOption("--from <name>", "Sender identity")
		.requiredOption("--to <name>", "Recipient identity")
		.requiredOption("--summary <text>", "Handoff summary")
		.option("--spec <spec>", "Linked spec ID")
		.option("--seed <seed>", "Linked Seeds issue ID")
		.action(async (planId: string, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const record = await appendHandoff(cwd(), {
					plan: planId,
					from: opts.from,
					to: opts.to,
					summary: opts.summary,
					spec: opts.spec,
					seed: opts.seed,
				});
				if (global.json) {
					jsonOutput("handoff append", { handoff: record });
					return;
				}
				console.log(chalk.green(`Appended handoff for ${record.plan}`));
			} catch (error) {
				handleCommandError("handoff append", error, global.json);
			}
		});
	handoff
		.command("show")
		.argument("<plan>", "Plan identifier")
		.option("--from <name>", "Filter by sender")
		.option("--to <name>", "Filter by recipient")
		.option("--limit <count>", "Limit results", parseInteger)
		.action(
			async (
				planId: string,
				opts: { from?: string; to?: string; limit?: number },
			) => {
				const global = program.opts<{ json?: boolean }>();
				try {
					const records = (await readHandoffs(cwd(), planId))
						.filter((record) => (opts.from ? record.from === opts.from : true))
						.filter((record) => (opts.to ? record.to === opts.to : true))
						.slice(opts.limit ? -opts.limit : undefined);
					if (global.json) {
						jsonOutput("handoff show", {
							plan: planId,
							handoffs: records,
							count: records.length,
						});
						return;
					}
					for (const record of records) {
						console.log(
							`${chalk.cyan(record.timestamp)} ${record.from} -> ${record.to}: ${record.summary}`,
						);
					}
				} catch (error) {
					handleCommandError("handoff show", error, global.json);
				}
			},
		);
	handoff
		.command("list")
		.option("--plan <id>", "Filter by plan ID")
		.option("--from <name>", "Filter by sender")
		.option("--to <name>", "Filter by recipient")
		.option("--seed <id>", "Filter by Seeds issue ID")
		.option("--spec <id>", "Filter by linked spec ID")
		.option("--limit <count>", "Limit results", parseInteger)
		.description("Query handoff logs across plans")
		.action(async (opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const plans = opts.plan
					? [opts.plan]
					: (await listPlans(cwd())).map((plan) => plan.id);
				const records = (
					await Promise.all(plans.map((planId) => readHandoffs(cwd(), planId)))
				)
					.flat()
					.filter((record) => (opts.from ? record.from === opts.from : true))
					.filter((record) => (opts.to ? record.to === opts.to : true))
					.filter((record) => (opts.seed ? record.seed === opts.seed : true))
					.filter((record) => (opts.spec ? record.spec === opts.spec : true))
					.slice(opts.limit ? -opts.limit : undefined);
				if (global.json) {
					jsonOutput("handoff list", {
						handoffs: records,
						count: records.length,
					});
					return;
				}
				for (const record of records) {
					console.log(
						`${chalk.cyan(record.timestamp)} ${record.plan} ${record.from} -> ${record.to}: ${record.summary}`,
					);
				}
			} catch (error) {
				handleCommandError("handoff list", error, global.json);
			}
		});

	const template = program
		.command("template")
		.description("Manage Trellis templates");
	template
		.command("init")
		.description(
			"Write default spec, plan, and handoff templates into .trellis/templates",
		)
		.action(async () => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const written = await initTemplates(cwd());
				if (global.json) {
					jsonOutput("template init", { written, count: written.length });
					return;
				}
				for (const file of written) console.log(chalk.green(`Wrote ${file}`));
			} catch (error) {
				handleCommandError("template init", error, global.json);
			}
		});
	template
		.command("show")
		.argument("<kind>", "Template kind: spec, plan, or handoff")
		.action(async (kind: TemplateKind) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const templateText = await readTemplate(cwd(), kind);
				if (global.json) {
					jsonOutput("template show", { kind, template: templateText });
					return;
				}
				console.log(templateText);
			} catch (error) {
				handleCommandError("template show", error, global.json);
			}
		});
	template
		.command("placeholders")
		.argument("<kind>", "Template kind: spec, plan, or handoff")
		.description(
			"List the stable placeholders Trellis guarantees for a template kind",
		)
		.action((kind: TemplateKind) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const placeholders = TEMPLATE_PLACEHOLDERS[kind];
				if (!placeholders) throw new Error(`Unknown template kind '${kind}'`);
				if (global.json) {
					jsonOutput("template placeholders", { kind, placeholders });
					return;
				}
				for (const placeholder of placeholders) {
					console.log(placeholder);
				}
			} catch (error) {
				handleCommandError("template placeholders", error, global.json);
			}
		});
	template
		.command("render")
		.argument("<kind>", "Template kind: spec, plan, or handoff")
		.option("--data <pair>", "Key=value placeholder binding", collectValues, [])
		.description("Render a template with explicit placeholder bindings")
		.action(async (kind: TemplateKind, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const data = parseKeyValuePairs(opts.data);
				const output = await renderTemplate(cwd(), kind, data);
				if (global.json) {
					jsonOutput("template render", { kind, data, output });
					return;
				}
				console.log(output);
			} catch (error) {
				handleCommandError("template render", error, global.json);
			}
		});

	program
		.command("show")
		.argument("<id>", "Spec or plan identifier")
		.description(
			"Show a Trellis artifact without knowing whether it is a spec or a plan",
		)
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const resolved = await resolveArtifact(cwd(), id);
				if (global.json) {
					jsonOutput("show", resolved);
					return;
				}
				console.log(serializeForDisplay(resolved));
			} catch (error) {
				handleCommandError("show", error, global.json);
			}
		});

	program
		.command("inspect")
		.argument("<id>", "Spec or plan identifier")
		.description("Inspect a Trellis artifact with linked records")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const resolved = await resolveArtifact(cwd(), id);
				const handoffs =
					resolved.kind === "plan"
						? await readHandoffs(cwd(), resolved.plan.id)
						: await readLinkedPlanHandoffs(cwd(), resolved.spec.id);
				const payload = {
					...resolved,
					handoffs,
					handoffCount: handoffs.length,
				};
				if (global.json) {
					jsonOutput("inspect", payload);
					return;
				}
				console.log(serializeForDisplay(payload));
			} catch (error) {
				handleCommandError("inspect", error, global.json);
			}
		});

	program
		.command("version-json")
		.description("Print structured version metadata")
		.action(() => {
			jsonOutput("version", {
				name: packageName(),
				version: VERSION,
				runtime: runtimeString(),
			});
		});

	await program.parseAsync(process.argv);
}

function collectValues(value: string, previous: string[]): string[] {
	return [...previous, value];
}

function parseInteger(value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 1)
		throw new Error("limit must be a positive integer");
	return parsed;
}

function parseKeyValuePairs(values: string[]): Record<string, string> {
	return Object.fromEntries(
		values.map((entry) => {
			const separator = entry.indexOf("=");
			if (separator === -1)
				throw new Error(`invalid --data pair '${entry}', expected key=value`);
			return [entry.slice(0, separator), entry.slice(separator + 1)];
		}),
	);
}

function hasExplicitArrayOption(values: string[] | undefined): boolean {
	return Array.isArray(values) && values.length > 0;
}

function serializeForDisplay(record: unknown): string {
	return JSON.stringify(record, null, 2);
}

function formatSpecSummary(
	record: Awaited<ReturnType<typeof readSpec>>,
): string {
	const seed = record.seed ? ` seed=${record.seed}` : "";
	return `${chalk.cyan(record.id)} [${record.status}]${seed} ${record.title}`;
}

function formatPlanSummary(
	record: Awaited<ReturnType<typeof readPlan>>,
): string {
	const seed = record.seed ? ` seed=${record.seed}` : "";
	const spec = record.spec ? ` spec=${record.spec}` : "";
	return `${chalk.cyan(record.id)} [${record.status}]${seed}${spec} ${record.title}`;
}

async function resolveArtifact(
	root: string,
	id: string,
): Promise<
	| {
			kind: "spec";
			spec: Awaited<ReturnType<typeof readSpec>>;
			linkedPlans: Awaited<ReturnType<typeof listPlans>>;
	  }
	| {
			kind: "plan";
			plan: Awaited<ReturnType<typeof readPlan>>;
			linkedSpec: Awaited<ReturnType<typeof readSpec>> | null;
	  }
> {
	try {
		const spec = await readSpec(root, id);
		const linkedPlans = await listPlans(root, { spec: spec.id });
		return { kind: "spec", spec, linkedPlans };
	} catch {}
	try {
		const plan = await readPlan(root, id);
		const linkedSpec = plan.spec
			? await readSpec(root, plan.spec).catch(() => null)
			: null;
		return { kind: "plan", plan, linkedSpec };
	} catch {}
	throw new Error(`No spec or plan found for '${id}'`);
}

async function readLinkedPlanHandoffs(root: string, specId: string) {
	const linkedPlans = await listPlans(root, { spec: specId });
	const handoffs = await Promise.all(
		linkedPlans.map((plan) => readHandoffs(root, plan.id)),
	);
	return handoffs.flat();
}

function handleCommandError(
	command: string,
	error: unknown,
	json: boolean | undefined,
): void {
	const message = error instanceof Error ? error.message : String(error);
	if (json) {
		jsonError(command, message);
		return;
	}
	console.error(chalk.red(message));
	process.exitCode = 1;
}

void main();

export const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
