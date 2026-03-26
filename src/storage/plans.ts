import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "../system/init.ts";
import { withWriteLock } from "../system/lock.ts";
import type { PlanRecord } from "../types.ts";
import { compactPatch } from "../workflow/patch.ts";
import { readSpec } from "./specs.ts";
import {
	validatePlanInput,
	validatePlanStatus,
	validateSeed,
	validateStoredPlan,
} from "./validate.ts";
import { parseYaml, serializeYaml } from "./yaml.ts";

const PLANS_DIR = "plans";

/** Returns the absolute path to a plan file given its ID. */
function planPath(root: string, id: string): string {
	return join(root, TRELLIS_DIR, PLANS_DIR, `${id}.yaml`);
}

/** Serialize a PlanRecord to YAML. */
export function serializePlan(record: PlanRecord): string {
	return serializeYaml({
		id: record.id,
		title: record.title,
		seed: record.seed,
		spec: record.spec,
		status: record.status,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		completedAt: record.completedAt,
		completionSummary: record.completionSummary,
		summary: record.summary,
		steps: record.steps,
	});
}

/** Parse a PlanRecord from YAML text. Validates the structure. */
export function parsePlan(text: string): PlanRecord {
	const parsed = parseYaml(text);
	const record: PlanRecord = {
		id: String(parsed.id ?? ""),
		title: String(parsed.title ?? ""),
		seed: parsed.seed ? String(parsed.seed) : undefined,
		spec: parsed.spec ? String(parsed.spec) : undefined,
		status: (parsed.status ? String(parsed.status) : "draft") as PlanRecord["status"],
		createdAt: String(parsed.createdAt ?? ""),
		updatedAt: String(parsed.updatedAt ?? ""),
		completedAt: parsed.completedAt ? String(parsed.completedAt) : undefined,
		completionSummary: parsed.completionSummary ? String(parsed.completionSummary) : undefined,
		summary: String(parsed.summary ?? ""),
		steps: Array.isArray(parsed.steps) ? parsed.steps : [],
	};
	validateStoredPlan(record);
	return record;
}

/**
 * Create a new plan file.
 * Throws if the file already exists or if the linked spec does not exist.
 */
export async function createPlan(
	root: string,
	input: Omit<PlanRecord, "createdAt" | "updatedAt">,
): Promise<PlanRecord> {
	validatePlanInput(input);
	if (input.spec) {
		await readSpec(root, input.spec).catch(() => {
			throw new Error(`linked spec '${input.spec}' does not exist`);
		});
	}
	const timestamp = new Date().toISOString();
	const record: PlanRecord = {
		...input,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await withWriteLock(root, "plans", async () => {
		const path = planPath(root, record.id);
		if (await Bun.file(path).exists()) {
			throw new Error(`plan '${record.id}' already exists`);
		}
		await mkdir(join(root, TRELLIS_DIR, PLANS_DIR), { recursive: true });
		await Bun.write(path, serializePlan(record));
	});

	return record;
}

export interface PlanFilters {
	status?: PlanRecord["status"];
	seed?: string;
	spec?: string;
}

/** Read a plan from disk by ID. */
export async function readPlan(root: string, id: string): Promise<PlanRecord> {
	const path = planPath(root, id);
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`plan '${id}' not found`);
	}
	try {
		return parsePlan(await file.text());
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`corrupt plan '${id}': ${message}`);
	}
}

/**
 * Update an existing plan.
 * Applies a partial patch and updates the updatedAt timestamp.
 */
export async function updatePlan(
	root: string,
	id: string,
	patch: Partial<
		Pick<
			PlanRecord,
			| "title"
			| "seed"
			| "spec"
			| "status"
			| "completedAt"
			| "completionSummary"
			| "summary"
			| "steps"
		>
	>,
): Promise<PlanRecord> {
	validatePlanStatus(patch.status);
	validateSeed(patch.seed);
	if (patch.title !== undefined && !patch.title.trim()) throw new Error("title must not be empty");
	if (
		patch.completionSummary !== undefined &&
		patch.completionSummary !== null &&
		!patch.completionSummary.trim()
	) {
		throw new Error("completionSummary must not be empty");
	}
	if (patch.spec) {
		await readSpec(root, patch.spec).catch(() => {
			throw new Error(`linked spec '${patch.spec}' does not exist`);
		});
	}
	return withWriteLock(root, "plans", async () => {
		const current = await readPlan(root, id);
		const updated: PlanRecord = {
			...current,
			...compactPatch(patch),
			updatedAt: new Date().toISOString(),
		};
		await Bun.write(planPath(root, id), serializePlan(updated));
		return updated;
	});
}

/** List all plans in the project, optionally filtered by status, seed, or spec. */
export async function listPlans(root: string, filters: PlanFilters = {}): Promise<PlanRecord[]> {
	const dir = join(root, TRELLIS_DIR, PLANS_DIR);
	const files = (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter(
		(entry) => entry.isFile() && entry.name.endsWith(".yaml"),
	);
	const records = await Promise.all(
		files.map((entry) => readPlan(root, entry.name.replace(/\.yaml$/, ""))),
	);
	return records
		.filter((record) => (filters.status ? record.status === filters.status : true))
		.filter((record) => (filters.seed ? record.seed === filters.seed : true))
		.filter((record) => (filters.spec ? record.spec === filters.spec : true))
		.sort((left, right) => left.id.localeCompare(right.id));
}
