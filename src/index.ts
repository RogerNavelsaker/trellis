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
import { createPlan, listPlans, readPlan } from "./plans.ts";
import { createSpec, listSpecs, readSpec } from "./specs.ts";

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
	spec.command("list").action(async () => {
		const global = program.opts<{ json?: boolean }>();
		const records = await listSpecs(cwd());
		if (global.json) {
			jsonOutput("spec list", { specs: records });
			return;
		}
		for (const record of records) {
			console.log(`${chalk.cyan(record.id)} ${record.title}`);
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
	plan.command("list").action(async () => {
		const global = program.opts<{ json?: boolean }>();
		const records = await listPlans(cwd());
		if (global.json) {
			jsonOutput("plan list", { plans: records });
			return;
		}
		for (const record of records) {
			console.log(`${chalk.cyan(record.id)} ${record.title}`);
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
		.action(async (planId: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const records = await readHandoffs(cwd(), planId);
				if (global.json) {
					jsonOutput("handoff show", { plan: planId, handoffs: records });
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

function serializeForDisplay(record: unknown): string {
	return JSON.stringify(record, null, 2);
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
