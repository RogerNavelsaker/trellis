import chalk from "chalk";
import { readHandoffs } from "../storage/handoffs.ts";
import { listPlans, readPlan } from "../storage/plans.ts";
import { readSpec } from "../storage/specs.ts";
import type { EventRecord, HandoffRecord, PlanRecord, SpecRecord } from "../types.ts";
import { jsonError } from "./json.ts";
import { printError } from "./output.ts";

export { printConfirm, printError, printSuccess, printWarning, setQuiet } from "./output.ts";

/** Standard error handler for CLI command actions. */
export function handleCommandError(command: string, error: unknown, json = false): void {
	const message = error instanceof Error ? error.message : String(error);
	if (json) {
		jsonError(command, message);
		return;
	}
	printError(message);
	process.exitCode = 1;
}
/** Accumulator for repeated commander options. */
export function collectValues(value: string, previous: string[]): string[] {
	return [...previous, value];
}

/** Returns true if an array option was explicitly provided (length > 0). */
export function hasExplicitArrayOption(values: string[] | undefined): boolean {
	return Array.isArray(values) && values.length > 0;
}

/** Formats a Record as a pretty JSON string for display. */
export function serializeForDisplay(record: unknown): string {
	return JSON.stringify(record, null, 2);
}

/** Parses an integer string, throwing an error if invalid. */
export function parseInteger(value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 1) throw new Error("limit must be a positive integer");
	return parsed;
}

/** Parses Key=Value pairs from a list of strings. */
export function parseKeyValuePairs(values: string[]): Record<string, string> {
	return Object.fromEntries(
		values.map((entry) => {
			const separator = entry.indexOf("=");
			if (separator === -1) throw new Error(`invalid --data pair '${entry}', expected key=value`);
			return [entry.slice(0, separator), entry.slice(separator + 1)];
		}),
	);
}

/** Resolves an ID to either a Spec or a Plan artifact. */
export async function resolveArtifact(
	root: string,
	id: string,
): Promise<
	| { kind: "spec"; spec: SpecRecord; linkedPlans: PlanRecord[] }
	| { kind: "plan"; plan: PlanRecord; linkedSpec: SpecRecord | null }
> {
	try {
		const spec = await readSpec(root, id);
		const linkedPlans = await listPlans(root, { spec: id });
		return { kind: "spec", spec, linkedPlans };
	} catch (error) {
		// If spec not found, try plan
		if (error instanceof Error && error.message.includes("not found")) {
			const plan = await readPlan(root, id);
			const linkedSpec = plan.spec ? await readSpec(root, plan.spec).catch(() => null) : null;
			return { kind: "plan", plan, linkedSpec };
		}
		throw error;
	}
}

/** Reads all handoffs for all plans linked to a specific spec. */
export async function readLinkedPlanHandoffs(
	root: string,
	specId: string,
): Promise<HandoffRecord[]> {
	const plans = await listPlans(root, { spec: specId });
	const nested = await Promise.all(plans.map((p: PlanRecord) => readHandoffs(root, p.id)));
	return nested
		.flat()
		.sort((a: HandoffRecord, b: HandoffRecord) => a.timestamp.localeCompare(b.timestamp));
}

/** Formats an artifact timeline for console display. */
export function formatTimelineForDisplay(
	record: (
		| { kind: "spec"; spec: SpecRecord; linkedPlans: PlanRecord[] }
		| { kind: "plan"; plan: PlanRecord; linkedSpec: SpecRecord | null }
	) & {
		events?: EventRecord[];
		handoffs: HandoffRecord[];
	},
): string {
	const header =
		record.kind === "spec"
			? `spec ${record.spec.id} [${record.spec.status}] ${record.spec.title}`
			: `plan ${record.plan.id} [${record.plan.status}] ${record.plan.title}`;
	const lines = [header];
	if (record.kind === "spec") {
		lines.push(`linked plans: ${record.linkedPlans.length}`);
		if (record.spec.completionSummary) {
			lines.push(`completion: ${record.spec.completionSummary}`);
		}
	} else {
		lines.push(`linked spec: ${record.linkedSpec?.id ?? "-"}`);
		if (record.plan.completionSummary) {
			lines.push(`completion: ${record.plan.completionSummary}`);
		}
	}
	lines.push("");
	lines.push("handoffs:");
	for (const h of record.handoffs) {
		lines.push(`- ${h.timestamp} ${h.from} -> ${h.to}: ${h.summary}`);
	}
	if (record.handoffs.length === 0) lines.push("(none)");
	return lines.join("\n");
}

/** Formats a spec summary line for list views. */
export function formatSpecSummary(record: SpecRecord): string {
	const seed = record.seed ? ` seed=${record.seed}` : "";
	return `${chalk.cyan(record.id)} [${record.status}]${seed} ${record.title}`;
}

/** Formats a plan summary line for list views. */
export function formatPlanSummary(record: PlanRecord): string {
	const spec = record.spec ? ` spec=${record.spec}` : "";
	const seed = record.seed ? ` seed=${record.seed}` : "";
	return `${chalk.cyan(record.id)} [${record.status}]${spec}${seed} ${record.title}`;
}
