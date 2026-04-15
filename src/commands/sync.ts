import { cwd } from "node:process";
import type { Command } from "commander";
import { TRELLIS_DIR } from "../system/init.ts";
import { jsonOutput } from "../system/json.ts";
import { handleCommandError, printSuccess } from "../system/utils.ts";

export interface SyncOptions {
	message?: string;
	dryRun?: boolean;
}

export interface SyncResult {
	committed: boolean;
	commitSha?: string;
	message: string;
	changedFiles: string[];
	dryRun: boolean;
}

const DEFAULT_MESSAGE = "trellis: sync artifacts";

interface GitRunResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

async function runGit(args: string[], cwdPath: string): Promise<GitRunResult> {
	const proc = Bun.spawn(["git", ...args], {
		cwd: cwdPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	return { stdout, stderr, exitCode };
}

async function ensureGitRepo(cwdPath: string): Promise<void> {
	const result = await runGit(["rev-parse", "--is-inside-work-tree"], cwdPath);
	if (result.exitCode !== 0 || result.stdout.trim() !== "true") {
		throw new Error(`'${cwdPath}' is not inside a git work tree`);
	}
}

async function stagedNameStatus(cwdPath: string): Promise<string[]> {
	const result = await runGit(["diff", "--cached", "--name-status", "--", TRELLIS_DIR], cwdPath);
	if (result.exitCode !== 0) {
		throw new Error(`git diff failed: ${result.stderr.trim()}`);
	}
	return result.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

export async function syncTrellis(root: string, options: SyncOptions = {}): Promise<SyncResult> {
	await ensureGitRepo(root);

	const trackedDir = TRELLIS_DIR;
	const addResult = await runGit(["add", "--", trackedDir], root);
	if (addResult.exitCode !== 0) {
		throw new Error(`git add failed: ${addResult.stderr.trim()}`);
	}

	const changed = await stagedNameStatus(root);

	if (changed.length === 0) {
		return {
			committed: false,
			message: "no staged changes under .trellis/",
			changedFiles: [],
			dryRun: Boolean(options.dryRun),
		};
	}

	const headline = options.message?.trim() || DEFAULT_MESSAGE;
	const body = changed.join("\n");
	const fullMessage = `${headline}\n\n${body}\n`;

	if (options.dryRun) {
		// Unstage to restore prior index state for a true dry-run.
		const resetResult = await runGit(["reset", "--", trackedDir], root);
		if (resetResult.exitCode !== 0) {
			throw new Error(`git reset failed: ${resetResult.stderr.trim()}`);
		}
		return {
			committed: false,
			message: fullMessage,
			changedFiles: changed,
			dryRun: true,
		};
	}

	const commitResult = await runGit(["commit", "-m", headline, "-m", body], root);
	if (commitResult.exitCode !== 0) {
		throw new Error(
			`git commit failed: ${commitResult.stderr.trim() || commitResult.stdout.trim()}`,
		);
	}

	const revResult = await runGit(["rev-parse", "HEAD"], root);
	const sha = revResult.exitCode === 0 ? revResult.stdout.trim() : undefined;

	return {
		committed: true,
		commitSha: sha,
		message: fullMessage,
		changedFiles: changed,
		dryRun: false,
	};
}

/**
 * Register the top-level 'sync' command.
 */
export function register(program: Command): void {
	program
		.command("sync")
		.description("Stage and commit changes under .trellis/")
		.option("--message <text>", "Override the default commit headline")
		.option("--dry-run", "Show what would be committed without staging or committing")
		.action(async (opts: SyncOptions) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const result = await syncTrellis(cwd(), opts);
				if (global.json) {
					jsonOutput("sync", { ...result });
					return;
				}
				if (result.dryRun) {
					console.log("[dry-run] would commit with message:");
					console.log(result.message);
					return;
				}
				if (!result.committed) {
					console.log(result.message);
					return;
				}
				printSuccess(`Committed ${result.changedFiles.length} change(s) under .trellis/`);
				if (result.commitSha) console.log(result.commitSha);
			} catch (error) {
				handleCommandError("sync", error, global.json);
			}
		});
}
