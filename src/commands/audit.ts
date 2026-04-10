import { cwd } from "node:process";
import chalk from "chalk";
import type { Command } from "commander";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, parseInteger } from "../system/utils.ts";
import { auditBlocked, auditOrphaned, auditStale } from "../workflow/audit.ts";

/**
 * Register 'audit' subcommands.
 */
export function register(program: Command): void {
	const audit = program
		.command("audit")
		.description("Audit Trellis artifact health and lifecycle quality");

	audit
		.command("blocked")
		.description("List blocked plans with their latest block reason")
		.action(async () => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const blocked = await auditBlocked(cwd());
				if (global.json) {
					jsonOutput("audit blocked", { blocked, count: blocked.length });
					return;
				}
				for (const entry of blocked) {
					const reason = entry.latestBlockReason ? ` reason=${entry.latestBlockReason}` : "";
					const since = entry.blockedAt ? ` blockedAt=${entry.blockedAt}` : "";
					console.log(
						`${chalk.yellow(entry.plan.id)} spec=${entry.plan.spec ?? "-"}${since}${reason}`,
					);
				}
			} catch (error) {
				handleCommandError("audit blocked", error, global.json);
			}
		});

	audit
		.command("stale")
		.option("--days <count>", "Minimum age in days", parseInteger, 7)
		.description("List active or blocked artifacts with no recent activity")
		.action(async (opts: { days: number }) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const stale = await auditStale(cwd(), opts.days);
				if (global.json) {
					jsonOutput("audit stale", {
						stale,
						count: stale.length,
						days: opts.days,
					});
					return;
				}
				for (const entry of stale) {
					const link = entry.spec ? ` spec=${entry.spec}` : "";
					const seed = entry.seed ? ` seed=${entry.seed}` : "";
					console.log(
						`${chalk.yellow(`${entry.kind}:${entry.id}`)} [${entry.status}] stale=${entry.staleDays}d last=${entry.lastActivityAt}${seed}${link}`,
					);
				}
			} catch (error) {
				handleCommandError("audit stale", error, global.json);
			}
		});

	audit
		.command("orphaned")
		.description("List specs, plans, and handoffs with broken linkage")
		.action(async () => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const orphaned = await auditOrphaned(cwd());
				if (global.json) {
					jsonOutput("audit orphaned", {
						specsWithoutPlans: orphaned.specsWithoutPlans,
						plansWithMissingSpecs: orphaned.plansWithMissingSpecs,
						handoffsForMissingPlans: orphaned.handoffsForMissingPlans,
					});
					return;
				}
				for (const spec of orphaned.specsWithoutPlans) {
					console.log(`${chalk.yellow(`spec:${spec.id}`)} no linked plans`);
				}
				for (const plan of orphaned.plansWithMissingSpecs) {
					console.log(`${chalk.yellow(`plan:${plan.id}`)} missing spec=${plan.spec}`);
				}
				for (const handoff of orphaned.handoffsForMissingPlans) {
					console.log(
						`${chalk.yellow(`handoff:${handoff.plan}`)} missing plan entries=${handoff.count}`,
					);
				}
			} catch (error) {
				handleCommandError("audit orphaned", error, global.json);
			}
		});
}
