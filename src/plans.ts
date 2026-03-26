import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";
import { withWriteLock } from "./lock.ts";
import { compactPatch } from "./patch.ts";
import { readSpec } from "./specs.ts";
import type { PlanRecord } from "./types.ts";
import {
	validatePlanInput,
	validatePlanStatus,
	validateSeed,
	validateStoredPlan,
} from "./validate.ts";
import { parseYaml, serializeYaml } from "./yaml.ts";

const PLANS_DIR = "plans";

function planPath(root: string, id: string): string {
	return join(root, TRELLIS_DIR, PLANS_DIR, `${id}.yaml`);
}

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
		await mkdir(join(root, TRELLIS_DIR, PLANS_DIR), { recursive: true });
		await writeFile(planPath(root, record.id), serializePlan(record), {
			encoding: "utf8",
			flag: "wx",
		});
	});

	return record;
}

export interface PlanFilters {
	status?: PlanRecord["status"];
	seed?: string;
	spec?: string;
}

export async function readPlan(root: string, id: string): Promise<PlanRecord> {
	try {
		return parsePlan(await readFile(planPath(root, id), "utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`corrupt plan '${id}': ${message}`);
	}
}

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
		await writeFile(planPath(root, id), serializePlan(updated), "utf8");
		return updated;
	});
}

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
