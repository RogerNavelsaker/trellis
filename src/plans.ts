import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";
import { withWriteLock } from "./lock.ts";
import type { PlanRecord } from "./types.ts";
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
		summary: record.summary,
		steps: record.steps,
	});
}

export function parsePlan(text: string): PlanRecord {
	const parsed = parseYaml(text);
	return {
		id: String(parsed.id ?? ""),
		title: String(parsed.title ?? ""),
		seed: parsed.seed ? String(parsed.seed) : undefined,
		spec: parsed.spec ? String(parsed.spec) : undefined,
		status: (parsed.status
			? String(parsed.status)
			: "draft") as PlanRecord["status"],
		createdAt: String(parsed.createdAt ?? ""),
		updatedAt: String(parsed.updatedAt ?? ""),
		summary: String(parsed.summary ?? ""),
		steps: Array.isArray(parsed.steps) ? parsed.steps : [],
	};
}

export async function createPlan(
	root: string,
	input: Omit<PlanRecord, "createdAt" | "updatedAt">,
): Promise<PlanRecord> {
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

export async function readPlan(root: string, id: string): Promise<PlanRecord> {
	return parsePlan(await readFile(planPath(root, id), "utf8"));
}

export async function listPlans(root: string): Promise<PlanRecord[]> {
	const dir = join(root, TRELLIS_DIR, PLANS_DIR);
	const files = (
		await readdir(dir, { withFileTypes: true }).catch(() => [])
	).filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"));
	const records = await Promise.all(
		files.map((entry) => readPlan(root, entry.name.replace(/\.yaml$/, ""))),
	);
	return records.sort((left, right) => left.id.localeCompare(right.id));
}
