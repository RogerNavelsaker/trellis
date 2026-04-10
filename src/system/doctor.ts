import { stat } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR, TRELLIS_EVENTS } from "./init.ts";

/**
 * Result of a single repo health check.
 */
export interface DoctorCheck {
	/** Machine-readable check name */
	name: string;
	/** Whether the check passed */
	ok: boolean;
	/** Human-readable details or error message */
	detail: string;
}

/**
 * Validates the existence of all managed .trellis/ artifacts and directories.
 */
export async function doctorProject(root: string): Promise<DoctorCheck[]> {
	const required = [
		`${TRELLIS_DIR}/README.md`,
		`${TRELLIS_DIR}/.gitignore`,
		`${TRELLIS_DIR}/specs`,
		`${TRELLIS_DIR}/plans`,
		`${TRELLIS_DIR}/handoffs`,
		`${TRELLIS_DIR}/templates`,
		`${TRELLIS_DIR}/locks`,
		`${TRELLIS_DIR}/${TRELLIS_EVENTS}`,
	];

	return Promise.all(
		required.map(async (relativePath) => {
			const path = join(root, relativePath);
			try {
				await stat(path);
				return { name: relativePath, ok: true, detail: "present" };
			} catch {
				return { name: relativePath, ok: false, detail: "missing" };
			}
		}),
	);
}
