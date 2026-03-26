import type { PlanRecord, SpecRecord } from "./types.ts";

const SEED_ID_RE = /^[A-Za-z][A-Za-z0-9_-]*-[A-Za-z0-9._-]+$/;

function requireNonEmpty(value: string, field: string): void {
	if (!value.trim()) {
		throw new Error(`${field} must not be empty`);
	}
}

export function validateSeed(seed: string | undefined): void {
	if (seed && !SEED_ID_RE.test(seed)) {
		throw new Error(`seed must look like a Seeds ID, got '${seed}'`);
	}
}

function validateId(id: string, field: string): void {
	requireNonEmpty(id, field);
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
		throw new Error(`${field} must use letters, numbers, dots, underscores, or dashes`);
	}
}

export function validateSpecInput(input: Omit<SpecRecord, "createdAt" | "updatedAt">): void {
	validateId(input.id, "spec id");
	requireNonEmpty(input.title, "title");
	requireNonEmpty(input.objective, "objective");
	validateSeed(input.seed);
	if (!["draft", "active", "done"].includes(input.status)) {
		throw new Error(`spec status must be one of: draft, active, done`);
	}
}

export function validatePlanInput(input: Omit<PlanRecord, "createdAt" | "updatedAt">): void {
	validateId(input.id, "plan id");
	requireNonEmpty(input.title, "title");
	validateSeed(input.seed);
	if (input.spec) validateId(input.spec, "spec");
	if (!["draft", "active", "blocked", "done"].includes(input.status)) {
		throw new Error(`plan status must be one of: draft, active, blocked, done`);
	}
}

export function validateSpecStatus(status: string | undefined): void {
	if (status === undefined) return;
	if (!["draft", "active", "done"].includes(status)) {
		throw new Error(`spec status must be one of: draft, active, done`);
	}
}

export function validatePlanStatus(status: string | undefined): void {
	if (status === undefined) return;
	if (!["draft", "active", "blocked", "done"].includes(status)) {
		throw new Error(`plan status must be one of: draft, active, blocked, done`);
	}
}

export function validateStoredSpec(record: SpecRecord): void {
	validateSpecInput({
		id: record.id,
		title: record.title,
		seed: record.seed,
		status: record.status,
		objective: record.objective,
		constraints: record.constraints,
		acceptance: record.acceptance,
		references: record.references,
		completedAt: record.completedAt,
		completionSummary: record.completionSummary,
	} as Omit<SpecRecord, "createdAt" | "updatedAt">);
}

export function validateStoredPlan(record: PlanRecord): void {
	validatePlanInput({
		id: record.id,
		title: record.title,
		seed: record.seed,
		spec: record.spec,
		status: record.status,
		summary: record.summary,
		steps: record.steps,
		completedAt: record.completedAt,
		completionSummary: record.completionSummary,
	} as Omit<PlanRecord, "createdAt" | "updatedAt">);
}
