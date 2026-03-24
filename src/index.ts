#!/usr/bin/env bun

import { dirname, join } from "node:path";
import { cwd, platform } from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { doctorProject } from "./doctor.ts";
import { initProject } from "./init.ts";
import { jsonError, jsonOutput } from "./json.ts";

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

void main();

export const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url));
