import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";
import { withWriteLock } from "./lock.ts";
import { compactPatch } from "./patch.ts";
import type { SpecRecord } from "./types.ts";
import {
	validateSeed,
	validateSpecInput,
	validateSpecStatus,
} from "./validate.ts";
import { parseYaml, serializeYaml } from "./yaml.ts";

const SPECS_DIR = "specs";

function specPath(root: string, id: string): string {
	return join(root, TRELLIS_DIR, SPECS_DIR, `${id}.yaml`);
}

export function serializeSpec(record: SpecRecord): string {
	return serializeYaml({
		id: record.id,
		title: record.title,
		seed: record.seed,
		status: record.status,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		objective: record.objective,
		constraints: record.constraints,
		acceptance: record.acceptance,
		references: record.references,
	});
}

export function parseSpec(text: string): SpecRecord {
	const parsed = parseYaml(text);
	return {
		id: String(parsed.id ?? ""),
		title: String(parsed.title ?? ""),
		seed: parsed.seed ? String(parsed.seed) : undefined,
		status: (parsed.status
			? String(parsed.status)
			: "draft") as SpecRecord["status"],
		createdAt: String(parsed.createdAt ?? ""),
		updatedAt: String(parsed.updatedAt ?? ""),
		objective: String(parsed.objective ?? ""),
		constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
		acceptance: Array.isArray(parsed.acceptance) ? parsed.acceptance : [],
		references: Array.isArray(parsed.references) ? parsed.references : [],
	};
}

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
		await mkdir(join(root, TRELLIS_DIR, SPECS_DIR), { recursive: true });
		await writeFile(specPath(root, record.id), serializeSpec(record), {
			encoding: "utf8",
			flag: "wx",
		});
	});

	return record;
}

export interface SpecFilters {
	status?: SpecRecord["status"];
	seed?: string;
}

export async function readSpec(root: string, id: string): Promise<SpecRecord> {
	return parseSpec(await readFile(specPath(root, id), "utf8"));
}

export async function updateSpec(
	root: string,
	id: string,
	patch: Partial<
		Pick<
			SpecRecord,
			| "title"
			| "seed"
			| "status"
			| "objective"
			| "constraints"
			| "acceptance"
			| "references"
		>
	>,
): Promise<SpecRecord> {
	validateSpecStatus(patch.status);
	validateSeed(patch.seed);
	if (patch.title !== undefined && !patch.title.trim())
		throw new Error("title must not be empty");
	if (patch.objective !== undefined && !patch.objective.trim()) {
		throw new Error("objective must not be empty");
	}
	return withWriteLock(root, "specs", async () => {
		const current = await readSpec(root, id);
		const updated: SpecRecord = {
			...current,
			...compactPatch(patch),
			updatedAt: new Date().toISOString(),
		};
		await writeFile(specPath(root, id), serializeSpec(updated), "utf8");
		return updated;
	});
}

export async function listSpecs(
	root: string,
	filters: SpecFilters = {},
): Promise<SpecRecord[]> {
	const dir = join(root, TRELLIS_DIR, SPECS_DIR);
	const files = (
		await readdir(dir, { withFileTypes: true }).catch(() => [])
	).filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"));
	const records = await Promise.all(
		files.map((entry) => readSpec(root, entry.name.replace(/\.yaml$/, ""))),
	);
	return records
		.filter((record) =>
			filters.status ? record.status === filters.status : true,
		)
		.filter((record) => (filters.seed ? record.seed === filters.seed : true))
		.sort((left, right) => left.id.localeCompare(right.id));
}
