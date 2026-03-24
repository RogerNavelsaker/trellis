import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";

const RETRY_DELAY_MS = 50;
const MAX_ATTEMPTS = 40;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withWriteLock<T>(
	root: string,
	name: string,
	fn: () => Promise<T>,
): Promise<T> {
	const lockDir = join(root, TRELLIS_DIR, "locks");
	await mkdir(lockDir, { recursive: true });
	const lockPath = join(lockDir, `${name}.lock`);

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const handle = await open(lockPath, "wx");
			await handle.close();
			try {
				return await fn();
			} finally {
				await rm(lockPath, { force: true });
			}
		} catch (error) {
			if (
				!(
					error &&
					typeof error === "object" &&
					"code" in error &&
					(error as { code?: string }).code === "EEXIST"
				)
			) {
				throw error;
			}
			if (attempt === MAX_ATTEMPTS) {
				throw new Error(`Timed out waiting for Trellis lock '${name}'`);
			}
			await delay(RETRY_DELAY_MS);
		}
	}

	throw new Error(`Failed to acquire Trellis lock '${name}'`);
}
