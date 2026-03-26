import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";
import { withWriteLock } from "./lock.ts";
import type { EventRecord } from "./types.ts";

const EVENTS_FILE = "events.jsonl";

function eventsPath(root: string): string {
	return join(root, TRELLIS_DIR, EVENTS_FILE);
}

export async function appendEvent(root: string, event: EventRecord): Promise<EventRecord> {
	await withWriteLock(root, "events", async () => {
		await mkdir(join(root, TRELLIS_DIR), { recursive: true });
		await appendFile(eventsPath(root), `${JSON.stringify(event)}\n`, "utf8");
	});
	return event;
}

export async function readEvents(root: string): Promise<EventRecord[]> {
	const text = await readFile(eventsPath(root), "utf8").catch(() => "");
	return text
		.split("\n")
		.filter(Boolean)
		.map((line, index) => {
			try {
				return JSON.parse(line) as EventRecord;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`corrupt event log at line ${index + 1}: ${message}`);
			}
		});
}
