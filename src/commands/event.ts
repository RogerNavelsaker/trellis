import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { readEvents } from "../storage/events.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, parseInteger } from "../system/utils.ts";

/**
 * Register 'event' subcommands.
 */
export function register(program: Command): void {
	const event = program.command("event").description("Query Trellis event history");

	event
		.command("list")
		.description("List transition and handoff events")
		.option("--kind <kind>", "Filter by artifact kind")
		.option("--type <type>", "Filter by event type")
		.option("--artifact <id>", "Filter by artifact ID")
		.option("--limit <count>", "Limit results", parseInteger)
		.action(async (opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const records = (await readEvents(cwd()))
					.filter((record) => (opts.kind ? record.artifactKind === opts.kind : true))
					.filter((record) => (opts.type ? record.type === opts.type : true))
					.filter((record) => (opts.artifact ? record.artifactId === opts.artifact : true))
					.slice(opts.limit ? -opts.limit : undefined);
				if (global.json) {
					jsonOutput("event list", { events: records, count: records.length });
					return;
				}
				for (const record of records) {
					console.log(
						`${chalk.cyan(record.timestamp)} ${record.type} ${record.artifactKind}:${record.artifactId}`,
					);
				}
			} catch (error) {
				handleCommandError("event list", error, global.json);
			}
		});
}
