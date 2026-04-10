import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";

const RETRY_DELAY_MS = 50;
const MAX_ATTEMPTS = 40;

/**
 * Returns a promise that resolves after the specified delay.
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async function with an advisory write lock.
 * Uses 'wx' flag on file open to ensure exclusive access.
 * Retries up to MAX_ATTEMPTS times with RETRY_DELAY_MS intervals.
 */
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
				throw new Error(`timed out waiting for Trellis lock '${name}'`);
			}
			await delay(RETRY_DELAY_MS);
		}
	}

	throw new Error(`failed to acquire Trellis lock '${name}'`);
}
