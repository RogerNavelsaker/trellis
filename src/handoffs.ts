import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendEvent } from "./events.ts";
import { TRELLIS_DIR } from "./init.ts";
import { withWriteLock } from "./lock.ts";
import type { HandoffRecord } from "./types.ts";

const HANDOFFS_DIR = "handoffs";

function handoffPath(root: string, plan: string): string {
	return join(root, TRELLIS_DIR, HANDOFFS_DIR, `${plan}.jsonl`);
}

export async function appendHandoff(
	root: string,
	input: Omit<HandoffRecord, "timestamp">,
): Promise<HandoffRecord> {
	const record: HandoffRecord = {
		...input,
		timestamp: new Date().toISOString(),
	};

	await withWriteLock(root, `handoff-${record.plan}`, async () => {
		await mkdir(join(root, TRELLIS_DIR, HANDOFFS_DIR), { recursive: true });
		await appendFile(
			handoffPath(root, record.plan),
			`${JSON.stringify(record)}\n`,
			"utf8",
		);
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

export async function readHandoffs(
	root: string,
	plan: string,
): Promise<HandoffRecord[]> {
	const text = await readFile(handoffPath(root, plan), "utf8").catch(() => "");
	return text
		.split("\n")
		.filter(Boolean)
		.map((line, index) => {
			try {
				return JSON.parse(line) as HandoffRecord;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(
					`corrupt handoff log '${plan}' at line ${index + 1}: ${message}`,
				);
			}
		});
}
