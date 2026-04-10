import { cwd } from "node:process";
import type { Command } from "commander";
import { readEvents } from "../storage/events.ts";
import { readHandoffs } from "../storage/handoffs.ts";
import { jsonOutput } from "../system/json.ts";
import {
	formatTimelineForDisplay,
	handleCommandError,
	readLinkedPlanHandoffs,
	resolveArtifact,
	serializeForDisplay,
} from "../system/utils.ts";

/**
 * Register top-level artifact commands (show, inspect, timeline).
 */
export function register(program: Command): void {
	program
		.command("show")
		.argument("<id>", "Spec or plan identifier")
		.description("Show a Trellis artifact without knowing whether it is a spec or a plan")
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
				const events = (await readEvents(cwd())).filter(
					(e) => e.artifactId === id || (resolved.kind === "plan" && e.plan === id),
				);
				const handoffs =
					resolved.kind === "plan"
						? await readHandoffs(cwd(), resolved.plan.id)
						: await readLinkedPlanHandoffs(cwd(), resolved.spec.id);
				const payload = {
					...resolved,
					events,
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
		.command("timeline")
		.argument("<id>", "Spec or plan identifier")
		.description("Show lifecycle events and handoffs for a Trellis artifact")
		.action(async (id: string) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const resolved = await resolveArtifact(cwd(), id);
				const events = (await readEvents(cwd())).filter(
					(e) => e.artifactId === id || (resolved.kind === "plan" && e.plan === id),
				);
				const handoffs =
					resolved.kind === "plan"
						? await readHandoffs(cwd(), resolved.plan.id)
						: await readLinkedPlanHandoffs(cwd(), resolved.spec.id);
				const payload = { ...resolved, events, handoffs };
				if (global.json) {
					jsonOutput("timeline", payload);
					return;
				}
				console.log(formatTimelineForDisplay(payload));
			} catch (error) {
				handleCommandError("timeline", error, global.json);
			}
		});
}
