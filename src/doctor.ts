import { access } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR, TRELLIS_EVENTS } from "./init.ts";

export interface DoctorCheck {
	name: string;
	ok: boolean;
	detail: string;
}

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
			try {
				await access(join(root, relativePath));
				return { name: relativePath, ok: true, detail: "present" };
			} catch {
				return { name: relativePath, ok: false, detail: "missing" };
			}
		}),
	);
}
