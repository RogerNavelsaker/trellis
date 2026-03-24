import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const TRELLIS_DIR = ".trellis";
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

export async function initProject(root: string): Promise<void> {
	const trellisDir = join(root, TRELLIS_DIR);
	await mkdir(join(trellisDir, "specs"), { recursive: true });
	await mkdir(join(trellisDir, "plans"), { recursive: true });
	await mkdir(join(trellisDir, "handoffs"), { recursive: true });
	await mkdir(join(trellisDir, "templates"), { recursive: true });
	await writeFile(join(trellisDir, ".gitignore"), TRELLIS_GITIGNORE, "utf8");
	await writeFile(join(trellisDir, "README.md"), TRELLIS_README, "utf8");
}
