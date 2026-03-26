import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const TRELLIS_DIR = ".trellis";
export const TRELLIS_EVENTS = "events.jsonl";
export const TRELLIS_GITIGNORE = `*
!README.md
!.gitignore
!specs/
!specs/**
!plans/
!plans/**
!handoffs/
!handoffs/**
!templates/
!templates/**
`;

export const TRELLIS_README = `# .trellis

Managed repo-local specs, plans, and handoff artifacts for Trellis.
`;

/** Write content to path only if the file does not already exist. Skips silently on EEXIST. */
async function writeFileIfAbsent(path: string, content: string): Promise<void> {
	try {
		await writeFile(path, content, { encoding: "utf8", flag: "wx" });
	} catch (error) {
		if (error instanceof Error && (error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
	}
}

export async function initProject(root: string): Promise<void> {
	const trellisDir = join(root, TRELLIS_DIR);
	await mkdir(join(trellisDir, "specs"), { recursive: true });
	await mkdir(join(trellisDir, "plans"), { recursive: true });
	await mkdir(join(trellisDir, "handoffs"), { recursive: true });
	await mkdir(join(trellisDir, "templates"), { recursive: true });
	await mkdir(join(trellisDir, "locks"), { recursive: true });
	await writeFileIfAbsent(join(trellisDir, ".gitignore"), TRELLIS_GITIGNORE);
	await writeFileIfAbsent(join(trellisDir, "README.md"), TRELLIS_README);
	await writeFileIfAbsent(join(trellisDir, TRELLIS_EVENTS), "");
}
