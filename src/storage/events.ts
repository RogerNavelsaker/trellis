import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "../system/init.ts";
import { withWriteLock } from "../system/lock.ts";
import type { EventRecord } from "../types.ts";

const EVENTS_FILE = "events.jsonl";

/** Returns the absolute path to the events log for the given project root. */
function eventsPath(root: string): string {
	return join(root, TRELLIS_DIR, EVENTS_FILE);
}

/**
 * Append a new event record to the repo-local event log.
 * Ensures the directory exists and uses a write lock to prevent corruption.
 */
export async function appendEvent(root: string, event: EventRecord): Promise<EventRecord> {
	await withWriteLock(root, "events", async () => {
		await mkdir(join(root, TRELLIS_DIR), { recursive: true });
		await appendFile(eventsPath(root), `${JSON.stringify(event)}\n`, "utf8");
	});
	return event;
}

/**
 * Read and parse all event records from the repo-local event log.
 * Returns an empty array if the file does not exist.
 * Throws an error if any line is not valid JSON.
 */
export async function readEvents(root: string): Promise<EventRecord[]> {
	const text = await Bun.file(eventsPath(root))
		.text()
		.catch(() => "");
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
