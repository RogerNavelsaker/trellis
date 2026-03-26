#!/usr/bin/env bun

import { join } from "node:path";
import { cwd, platform } from "node:process";
import chalk from "chalk";
import { Command, Help } from "commander";
import * as artifact from "./commands/artifact.ts";
import * as audit from "./commands/audit.ts";
import * as completions from "./commands/completions.ts";
import * as event from "./commands/event.ts";
import * as handoff from "./commands/handoff.ts";
import * as plan from "./commands/plan.ts";
import * as spec from "./commands/spec.ts";
import * as template from "./commands/template.ts";
import { doctorProject } from "./system/doctor.ts";
import { initProject } from "./system/init.ts";
import { jsonError, jsonOutput } from "./system/json.ts";
import { brand, muted, printError, printSuccess, setQuiet } from "./system/output.ts";

export const VERSION = "0.1.0";

function packageName(): string {
	return "@os-eco/trellis-cli";
}

function runtimeString(): string {
	return `bun-${platform}`;
}

async function main(): Promise<void> {
	if (shouldPrintVersionJson(process.argv.slice(2))) {
		jsonOutput("version", {
			name: packageName(),
			version: VERSION,
			runtime: runtimeString(),
			platform,
		});
		return;
	}

	const program = new Command();

	program
		.name("trellis")
		.description("Git-native specs, plans, and handoff artifacts for the os-eco toolchain")
		.version(VERSION, "-v, --version", "Print version")
		.option("--json", "Machine-readable JSON output")
		.option("-q, --quiet", "Suppress non-error output")
		.option("--verbose", "Extra diagnostic output")
		.option("--timing", "Print execution time to stderr")
		.addHelpCommand(false)
		.configureHelp({
			formatHelp(cmd: Command, helper: Help): string {
				if (cmd.parent) {
					return Help.prototype.formatHelp.call(helper, cmd, helper);
				}
				const header = `${brand(chalk.bold("trellis"))} ${muted(`v${VERSION}`)} — Git-native planning artifacts\n\nUsage: tl <command> [options]`;

				const cmdLines: string[] = ["\nCommands:"];
				for (const sub of cmd.commands) {
					const name = sub.name();
					const argStr = sub.registeredArguments
						.map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`))
						.join(" ");
					const rawEntry = argStr ? `${name} ${argStr}` : name;
					const colored = argStr ? `${chalk.green(name)} ${chalk.dim(argStr)}` : chalk.green(name);
					const pad = " ".repeat(Math.max(18 - rawEntry.length, 2));
					cmdLines.push(`  ${colored}${pad}${sub.description()}`);
				}

				const optsLines: string[] = ["\nOptions:"];
				const opts: [string, string][] = [
					["-h, --help", "Show help"],
					["-v, --version", "Print version"],
					["--json", "Output as JSON"],
					["-q, --quiet", "Suppress non-error output"],
					["--verbose", "Extra diagnostic output"],
					["--timing", "Show command execution time"],
				];
				for (const [flags, desc] of opts) {
					const pad = " ".repeat(Math.max(18 - flags.length, 2));
					optsLines.push(`  ${chalk.green(flags)}${pad}${desc}`);
				}

				return [
					header,
					cmdLines.join("\n"),
					optsLines.join("\n"),
					"",
					"Docs:",
					`  ${chalk.cyan("https://github.com/jayminwest/trellis")}`,
					"",
					"Scope:",
					"  Trellis owns repo-local specs, plans, and handoff artifacts.",
				].join("\n");
			},
		});

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
				printSuccess("Initialized .trellis/");
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (opts.json) {
					jsonError("init", message);
					return;
				}
				printError(message);
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
				const icon = check.ok ? brand("✓") : chalk.red("✗");
				console.log(`${icon} ${check.name} ${check.detail}`);
			}
			if (failed.length > 0) process.exitCode = 1;
		});

	// Register subcommands
	spec.register(program);
	plan.register(program);
	audit.register(program);
	handoff.register(program);
	event.register(program);
	template.register(program);
	completions.register(program);
	artifact.register(program);

	program
		.command("version-json")
		.description("Print structured version metadata")
		.action(() => {
			jsonOutput("version", {
				name: packageName(),
				version: VERSION,
				runtime: runtimeString(),
				platform,
			});
		});

	program.hook("preAction", (thisCommand) => {
		const opts = thisCommand.opts<{ quiet?: boolean }>();
		if (opts.quiet) setQuiet(true);
	});

	const timingStart = process.argv.includes("--timing") ? performance.now() : undefined;
	await program.parseAsync(process.argv);
	if (timingStart !== undefined) {
		const elapsed = performance.now() - timingStart;
		process.stderr.write(`\ntiming: ${elapsed.toFixed(1)}ms\n`);
	}
}

function shouldPrintVersionJson(args: string[]): boolean {
	return (
		args.includes("--json") &&
		(args.includes("--version") || args.includes("-v")) &&
		!args.includes("version-json")
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
