#!/usr/bin/env bun

import { join } from "node:path";
import { cwd, platform } from "node:process";
import { Command, Help } from "commander";
import * as artifact from "./commands/artifact.ts";
import * as audit from "./commands/audit.ts";
import * as completions from "./commands/completions.ts";
import * as event from "./commands/event.ts";
import * as handoff from "./commands/handoff.ts";
import * as list from "./commands/list.ts";
import * as plan from "./commands/plan.ts";
import * as prime from "./commands/prime.ts";
import * as spec from "./commands/spec.ts";
import * as sync from "./commands/sync.ts";
import * as template from "./commands/template.ts";
import { doctorProject } from "./system/doctor.ts";
import { initProject } from "./system/init.ts";
import { jsonError, jsonOutput } from "./system/json.ts";
import {
	brand,
	chalk,
	muted,
	printError,
	printStatus,
	printSuccess,
	setQuiet,
} from "./system/output.ts";

export const VERSION = "0.1.1";

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
	let timingStart: number | undefined;

	program
		.name("tl")
		.description("Git-native specs, plans, and handoff artifacts for the os-eco toolchain")
		.version(VERSION, "-v, --version", "Print version")
		.option("-q, --quiet", "Suppress non-error output")
		.option("--json", "JSON output")
		.option("--verbose", "Extra diagnostic output")
		.option("--timing", "Print command execution time to stderr")
		.addHelpCommand(false)
		.configureHelp({
			formatHelp(cmd: Command, helper: Help): string {
				if (cmd.parent) {
					return Help.prototype.formatHelp.call(helper, cmd, helper);
				}
				const colWidth = 20;
				const lines: string[] = [];

				lines.push(
					`${brand(chalk.bold("trellis"))} ${muted(`v${VERSION}`)} — git-native specs, plans, and handoff artifacts`,
				);
				lines.push("");
				lines.push(`Usage: ${chalk.dim("tl")} <command> [options]`);
				lines.push("");

				const visibleCommands = helper.visibleCommands(cmd);
				if (visibleCommands.length > 0) {
					lines.push("Commands:");
					for (const sub of visibleCommands) {
						const term = helper.subcommandTerm(sub);
						const firstSpace = term.indexOf(" ");
						const name = firstSpace === -1 ? term : term.slice(0, firstSpace);
						const args = firstSpace === -1 ? "" : term.slice(firstSpace);
						const coloredTerm = `${chalk.green(name)}${args ? chalk.dim(args) : ""}`;
						const padding = " ".repeat(Math.max(2, colWidth - term.length));
						lines.push(`  ${coloredTerm}${padding}${helper.subcommandDescription(sub)}`);
					}
					lines.push("");
				}

				const visibleOptions = helper.visibleOptions(cmd);
				if (visibleOptions.length > 0) {
					lines.push("Options:");
					for (const option of visibleOptions) {
						const flags = helper.optionTerm(option);
						const padding = " ".repeat(Math.max(2, colWidth - flags.length));
						lines.push(`  ${chalk.dim(flags)}${padding}${helper.optionDescription(option)}`);
					}
					lines.push("");
				}

				lines.push(`Run '${chalk.dim("tl")} <command> --help' for command-specific help.`);
				return `${lines.join("\n")}\n`;
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
				printStatus(`${icon} ${check.name} ${check.detail}`);
			}
			if (failed.length > 0) process.exitCode = 1;
		});

	// Register subcommands
	prime.register(program);
	list.register(program);
	sync.register(program);
	spec.register(program);
	plan.register(program);
	audit.register(program);
	handoff.register(program);
	event.register(program);
	template.register(program);
	completions.register(program);
	artifact.register(program);

	program.hook("preAction", (thisCommand) => {
		const opts = thisCommand.optsWithGlobals<{ quiet?: boolean; timing?: boolean }>();
		if (opts.quiet) setQuiet(true);
		if (opts.timing) timingStart = performance.now();
	});

	await program.parseAsync(process.argv);
	if (timingStart !== undefined) {
		const elapsed = performance.now() - timingStart;
		const formatted =
			elapsed < 1000 ? `${Math.round(elapsed)}ms` : `${(elapsed / 1000).toFixed(2)}s`;
		process.stderr.write(`${muted(`Done in ${formatted}`)}\n`);
	}
}

function shouldPrintVersionJson(args: string[]): boolean {
	return args.includes("--json") && (args.includes("--version") || args.includes("-v"));
}

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	if (process.argv.includes("--json")) {
		jsonError("trellis", message);
		process.exit(1);
	}
	printError(message);
	process.exit(1);
});
