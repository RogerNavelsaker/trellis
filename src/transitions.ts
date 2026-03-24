import { appendHandoff } from "./handoffs.ts";
import { readPlan, updatePlan } from "./plans.ts";
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
) {
	const current = await readSpec(root, id);
	ensureTransition("spec", current.status, status, SPEC_TRANSITIONS);
	return updateSpec(root, id, { status });
}

export async function transitionPlan(
	root: string,
	id: string,
	status: "active" | "blocked" | "done",
	options: { reason?: string; actor?: string; to?: string } = {},
) {
	const current = await readPlan(root, id);
	ensureTransition("plan", current.status, status, PLAN_TRANSITIONS);
	if (status === "blocked" && !options.reason?.trim()) {
		throw new Error("blocking a plan requires --reason");
	}
	const updated = await updatePlan(root, id, { status });
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
