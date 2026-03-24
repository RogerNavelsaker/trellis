import { appendEvent } from "./events.ts";
import { appendHandoff } from "./handoffs.ts";
import { listPlans, readPlan, updatePlan } from "./plans.ts";
import { readSpec, updateSpec } from "./specs.ts";

const SPEC_TRANSITIONS: Record<string, readonly string[]> = {
	draft: ["active"],
	active: ["done"],
	done: [],
};

const PLAN_TRANSITIONS: Record<string, readonly string[]> = {
	draft: ["active", "blocked"],
	active: ["blocked", "done"],
	blocked: ["active", "done"],
	done: [],
};

function ensureTransition(
	label: string,
	current: string,
	target: string,
	table: Record<string, readonly string[]>,
): void {
	if (current === target) return;
	if (!table[current]?.includes(target)) {
		throw new Error(`${label} cannot transition from ${current} to ${target}`);
	}
}

export async function transitionSpec(
	root: string,
	id: string,
	status: "active" | "done",
	options: { summary?: string } = {},
) {
	const current = await readSpec(root, id);
	ensureTransition("spec", current.status, status, SPEC_TRANSITIONS);
	if (status === "done") {
		if (!options.summary?.trim()) {
			throw new Error("completing a spec requires --summary");
		}
		const linkedPlans = await listPlans(root, { spec: id });
		const incomplete = linkedPlans.filter((plan) => plan.status !== "done");
		if (incomplete.length > 0) {
			throw new Error(
				`spec '${id}' cannot complete until linked plans are done: ${incomplete.map((plan) => plan.id).join(", ")}`,
			);
		}
	}
	const updated = await updateSpec(root, id, {
		status,
		completedAt: status === "done" ? new Date().toISOString() : undefined,
		completionSummary: status === "done" ? options.summary?.trim() : undefined,
	});
	await appendEvent(root, {
		timestamp: updated.updatedAt,
		type: "spec.transition",
		artifactKind: "spec",
		artifactId: updated.id,
		fromStatus: current.status,
		toStatus: updated.status,
		summary: updated.completionSummary,
		seed: updated.seed,
	});
	return updated;
}

export async function transitionPlan(
	root: string,
	id: string,
	status: "active" | "blocked" | "done",
	options: {
		reason?: string;
		summary?: string;
		actor?: string;
		to?: string;
	} = {},
) {
	const current = await readPlan(root, id);
	ensureTransition("plan", current.status, status, PLAN_TRANSITIONS);
	if (status === "blocked" && !options.reason?.trim()) {
		throw new Error("blocking a plan requires --reason");
	}
	if (status === "done" && !options.summary?.trim()) {
		throw new Error("completing a plan requires --summary");
	}
	const updated = await updatePlan(root, id, {
		status,
		completedAt: status === "done" ? new Date().toISOString() : undefined,
		completionSummary: status === "done" ? options.summary?.trim() : undefined,
	});
	await appendEvent(root, {
		timestamp: updated.updatedAt,
		type: "plan.transition",
		artifactKind: "plan",
		artifactId: updated.id,
		fromStatus: current.status,
		toStatus: updated.status,
		spec: updated.spec,
		seed: updated.seed,
		plan: updated.id,
		summary: options.summary ?? options.reason,
	});
	if (options.reason && options.actor && options.to) {
		await appendHandoff(root, {
			plan: updated.id,
			from: options.actor,
			to: options.to,
			summary: options.reason,
			spec: updated.spec,
			seed: updated.seed,
		});
	}
	return updated;
}
