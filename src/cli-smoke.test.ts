import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("trellis CLI smoke", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("show and inspect work across spec, plan, and handoff artifacts", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-cli-"));

		const run = async (args: string[]) => {
			const proc = Bun.spawn(["bun", join(import.meta.dir, "index.ts"), ...args], {
				cwd: tempDir,
				stdout: "pipe",
				stderr: "pipe",
			});
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;
			return { stdout, stderr, exitCode };
		};

		expect((await run(["init", "--json"])).exitCode).toBe(0);
		expect(
			JSON.parse(
				(
					await run([
						"spec",
						"create",
						"spec-a",
						"--title",
						"Spec A",
						"--objective",
						"Objective",
						"--seed",
						"seed-1",
						"--json",
					])
				).stdout,
			).success,
		).toBe(true);
		expect(
			JSON.parse(
				(
					await run([
						"plan",
						"create",
						"plan-a",
						"--title",
						"Plan A",
						"--spec",
						"spec-a",
						"--seed",
						"seed-1",
						"--summary",
						"Summary",
						"--step",
						"First",
						"--json",
					])
				).stdout,
			).success,
		).toBe(true);
		expect(
			JSON.parse(
				(
					await run([
						"handoff",
						"append",
						"plan-a",
						"--from",
						"lead",
						"--to",
						"builder",
						"--summary",
						"Do the work",
						"--spec",
						"spec-a",
						"--seed",
						"seed-1",
						"--json",
					])
				).stdout,
			).success,
		).toBe(true);
		expect(
			JSON.parse(
				(
					await run([
						"plan",
						"block",
						"plan-a",
						"--reason",
						"Waiting on review",
						"--from",
						"lead",
						"--to",
						"reviewer",
						"--json",
					])
				).stdout,
			).success,
		).toBe(true);

		const show = JSON.parse((await run(["show", "plan-a", "--json"])).stdout);
		expect(show.kind).toBe("plan");

		const inspect = JSON.parse((await run(["inspect", "spec-a", "--json"])).stdout);
		expect(inspect.kind).toBe("spec");
		expect(inspect.handoffCount).toBe(2);

		const latest = JSON.parse((await run(["handoff", "latest", "plan-a", "--json"])).stdout);
		expect(latest.handoff.summary).toBe("Waiting on review");

		const timeline = JSON.parse((await run(["timeline", "plan-a", "--json"])).stdout);
		expect(Array.isArray(timeline.events)).toBe(true);

		const blocked = JSON.parse((await run(["audit", "blocked", "--json"])).stdout);
		expect(blocked.count).toBe(1);

		const version = JSON.parse((await run(["--version", "--json"])).stdout);
		expect(version.success).toBe(true);
		expect(version.command).toBe("version");
		expect(version.name).toBe("@os-eco/trellis-cli");

		const bashCompletions = await run(["completions", "bash"]);
		expect(bashCompletions.stdout).toContain("complete -F _trellis_completions");
	});
});
