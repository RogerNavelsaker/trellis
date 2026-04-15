import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "../system/init.ts";
import { syncTrellis } from "./sync.ts";

async function git(args: string[], cwdPath: string): Promise<{ exitCode: number; stdout: string }> {
	const proc = Bun.spawn(["git", ...args], {
		cwd: cwdPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	return { exitCode, stdout };
}

async function initRepo(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "trellis-sync-"));
	await git(["init", "-q"], dir);
	await git(["config", "user.email", "test@example.com"], dir);
	await git(["config", "user.name", "Test"], dir);
	await git(["config", "commit.gpgsign", "false"], dir);
	await initProject(dir);
	return dir;
}

describe("syncTrellis", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("rejects non-git directory", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-nosync-"));
		await initProject(tempDir);
		await expect(syncTrellis(tempDir)).rejects.toThrow(/not inside a git work tree/);
	});

	test("no-op when nothing staged", async () => {
		tempDir = await initRepo();
		await syncTrellis(tempDir);
		const result = await syncTrellis(tempDir);
		expect(result.committed).toBe(false);
		expect(result.changedFiles).toHaveLength(0);
	});

	test("commits when .trellis/ has changes", async () => {
		tempDir = await initRepo();
		await writeFile(join(tempDir, ".trellis", "specs", "demo.yaml"), "id: demo\n");
		const result = await syncTrellis(tempDir);
		expect(result.committed).toBe(true);
		expect(result.changedFiles.some((line) => line.includes("demo.yaml"))).toBe(true);
		const log = await git(["log", "--oneline"], tempDir);
		expect(log.stdout).toContain("trellis: sync artifacts");
	});

	test("--dry-run stages nothing and reports changes", async () => {
		tempDir = await initRepo();
		await writeFile(join(tempDir, ".trellis", "specs", "demo.yaml"), "id: demo\n");
		const result = await syncTrellis(tempDir, { dryRun: true });
		expect(result.committed).toBe(false);
		expect(result.dryRun).toBe(true);
		expect(result.changedFiles.length).toBeGreaterThan(0);
		const staged = await git(["diff", "--cached", "--name-only"], tempDir);
		expect(staged.stdout.trim()).toBe("");
	});

	test("--message overrides headline", async () => {
		tempDir = await initRepo();
		await writeFile(join(tempDir, ".trellis", "specs", "demo.yaml"), "id: demo\n");
		const result = await syncTrellis(tempDir, { message: "custom headline" });
		expect(result.committed).toBe(true);
		const log = await git(["log", "--pretty=%s"], tempDir);
		expect(log.stdout.trim().split("\n")[0]).toBe("custom headline");
	});
});
