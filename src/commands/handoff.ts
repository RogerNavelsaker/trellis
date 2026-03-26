import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { appendHandoff, readHandoffs } from "../storage/handoffs.ts";
import { listPlans } from "../storage/plans.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, parseInteger, printSuccess } from "../system/utils.ts";

/**
 * Register 'handoff' subcommands.
 */
export function register(program: Command): void {
	const handoff = program.command("handoff").description("Append and inspect handoff logs");

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
				printSuccess(`Appended handoff for ${record.plan}`);
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
		.action(async (planId: string, opts: { from?: string; to?: string; limit?: number }) => {
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
		});

	handoff
		.command("latest")
		.argument("<plan>", "Plan identifier")
		.description("Show the latest durable handoff for a plan")
		.action(async (planId: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const latest = (await readHandoffs(cwd(), planId)).at(-1) ?? null;
				if (global.json) {
					jsonOutput("handoff latest", { plan: planId, handoff: latest });
					return;
				}
				if (!latest) {
					console.log(`No handoffs for ${planId}`);
					return;
				}
				console.log(
					`${chalk.cyan(latest.timestamp)} ${latest.from} -> ${latest.to}: ${latest.summary}`,
				);
			} catch (error) {
				handleCommandError("handoff latest", error, global.json);
			}
		});

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
				const plans = opts.plan ? [opts.plan] : (await listPlans(cwd())).map((plan) => plan.id);
				const records = (await Promise.all(plans.map((planId) => readHandoffs(cwd(), planId))))
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
}
