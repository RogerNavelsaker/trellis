import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "../system/init.ts";
import { withWriteLock } from "../system/lock.ts";
import type { HandoffRecord } from "../types.ts";
import { appendEvent } from "./events.ts";

const HANDOFFS_DIR = "handoffs";

/**
 * Returns the absolute path to a plan's handoff JSONL log.
 */
function handoffPath(root: string, plan: string): string {
	return join(root, TRELLIS_DIR, HANDOFFS_DIR, `${plan}.jsonl`);
}

/**
 * Appends a new handoff record to a plan's log and records the event.
 */
export async function appendHandoff(
	root: string,
	input: Omit<HandoffRecord, "timestamp">,
): Promise<HandoffRecord> {
	const record: HandoffRecord = {
		...input,
		timestamp: new Date().toISOString(),
	};

	await withWriteLock(root, `handoff-${record.plan}`, async () => {
		const dir = join(root, TRELLIS_DIR, HANDOFFS_DIR);
		await mkdir(dir, { recursive: true });
		await appendFile(handoffPath(root, record.plan), `${JSON.stringify(record)}\n`, "utf8");
	});

	await appendEvent(root, {
		timestamp: record.timestamp,
		type: "handoff.append",
		artifactKind: "handoff",
		artifactId: record.plan,
		from: record.from,
		to: record.to,
		summary: record.summary,
		spec: record.spec,
		seed: record.seed,
		plan: record.plan,
	});

	return record;
}

/**
 * Reads and parses all handoff records for a specific plan.
 */
export async function readHandoffs(root: string, plan: string): Promise<HandoffRecord[]> {
	const file = Bun.file(handoffPath(root, plan));
	if (!(await file.exists())) return [];

	const text = await file.text();
	return text
		.split("\n")
		.filter(Boolean)
		.map((line, index) => {
			try {
				return JSON.parse(line) as HandoffRecord;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`corrupt handoff log '${plan}' at line ${index + 1}: ${message}`);
			}
		});
}
