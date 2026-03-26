import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "../system/init.ts";
import { withWriteLock } from "../system/lock.ts";
import type { SpecRecord } from "../types.ts";
import { compactPatch } from "../workflow/patch.ts";
import {
	validateSeed,
	validateSpecInput,
	validateSpecStatus,
	validateStoredSpec,
} from "./validate.ts";
import { parseYaml, serializeYaml } from "./yaml.ts";

const SPECS_DIR = "specs";

/** Returns the absolute path to a spec file given its ID. */
function specPath(root: string, id: string): string {
	return join(root, TRELLIS_DIR, SPECS_DIR, `${id}.yaml`);
}

/** Serialize a SpecRecord to YAML. */
export function serializeSpec(record: SpecRecord): string {
	return serializeYaml({
		id: record.id,
		title: record.title,
		seed: record.seed,
		status: record.status,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		completedAt: record.completedAt,
		completionSummary: record.completionSummary,
		objective: record.objective,
		constraints: record.constraints,
		acceptance: record.acceptance,
		references: record.references,
	});
}

/** Parse a SpecRecord from YAML text. Validates the structure. */
export function parseSpec(text: string): SpecRecord {
	const parsed = parseYaml(text);
	const record: SpecRecord = {
		id: String(parsed.id ?? ""),
		title: String(parsed.title ?? ""),
		seed: parsed.seed ? String(parsed.seed) : undefined,
		status: (parsed.status ? String(parsed.status) : "draft") as SpecRecord["status"],
		createdAt: String(parsed.createdAt ?? ""),
		updatedAt: String(parsed.updatedAt ?? ""),
		completedAt: parsed.completedAt ? String(parsed.completedAt) : undefined,
		completionSummary: parsed.completionSummary ? String(parsed.completionSummary) : undefined,
		objective: String(parsed.objective ?? ""),
		constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
		acceptance: Array.isArray(parsed.acceptance) ? parsed.acceptance : [],
		references: Array.isArray(parsed.references) ? parsed.references : [],
	};
	validateStoredSpec(record);
	return record;
}

/**
 * Create a new spec file.
 * Throws if the file already exists.
 */
export async function createSpec(
	root: string,
	input: Omit<SpecRecord, "createdAt" | "updatedAt">,
): Promise<SpecRecord> {
	validateSpecInput(input);
	const timestamp = new Date().toISOString();
	const record: SpecRecord = {
		...input,
		createdAt: timestamp,
		updatedAt: timestamp,
	};

	await withWriteLock(root, "specs", async () => {
		const path = specPath(root, record.id);
		if (await Bun.file(path).exists()) {
			throw new Error(`spec '${record.id}' already exists`);
		}
		await mkdir(join(root, TRELLIS_DIR, SPECS_DIR), { recursive: true });
		await Bun.write(path, serializeSpec(record));
	});

	return record;
}

export interface SpecFilters {
	status?: SpecRecord["status"];
	seed?: string;
}

/** Read a spec from disk by ID. */
export async function readSpec(root: string, id: string): Promise<SpecRecord> {
	const path = specPath(root, id);
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`spec '${id}' not found`);
	}
	try {
		return parseSpec(await file.text());
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`corrupt spec '${id}': ${message}`);
	}
}

/**
 * Update an existing spec.
 * Applies a partial patch and updates the updatedAt timestamp.
 */
export async function updateSpec(
	root: string,
	id: string,
	patch: Partial<
		Pick<
			SpecRecord,
			| "title"
			| "seed"
			| "status"
			| "completedAt"
			| "completionSummary"
			| "objective"
			| "constraints"
			| "acceptance"
			| "references"
		>
	>,
): Promise<SpecRecord> {
	validateSpecStatus(patch.status);
	validateSeed(patch.seed);
	if (patch.title !== undefined && !patch.title.trim()) throw new Error("title must not be empty");
	if (patch.objective !== undefined && !patch.objective.trim()) {
		throw new Error("objective must not be empty");
	}
	if (
		patch.completionSummary !== undefined &&
		patch.completionSummary !== null &&
		!patch.completionSummary.trim()
	) {
		throw new Error("completionSummary must not be empty");
	}
	return withWriteLock(root, "specs", async () => {
		const current = await readSpec(root, id);
		const updated: SpecRecord = {
			...current,
			...compactPatch(patch),
			updatedAt: new Date().toISOString(),
		};
		await Bun.write(specPath(root, id), serializeSpec(updated));
		return updated;
	});
}

/** List all specs in the project, optionally filtered by status or seed. */
export async function listSpecs(root: string, filters: SpecFilters = {}): Promise<SpecRecord[]> {
	const dir = join(root, TRELLIS_DIR, SPECS_DIR);
	const files = (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter(
		(entry) => entry.isFile() && entry.name.endsWith(".yaml"),
	);
	const records = await Promise.all(
		files.map((entry) => readSpec(root, entry.name.replace(/\.yaml$/, ""))),
	);
	return records
		.filter((record) => (filters.status ? record.status === filters.status : true))
		.filter((record) => (filters.seed ? record.seed === filters.seed : true))
		.sort((left, right) => left.id.localeCompare(right.id));
}
