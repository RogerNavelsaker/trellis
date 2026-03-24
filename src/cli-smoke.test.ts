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
			const proc = Bun.spawn(
				["bun", "/home/rona/Repositories/trellis/src/index.ts", ...args],
				{
					cwd: tempDir,
					stdout: "pipe",
					stderr: "pipe",
				},
			);
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

		const show = JSON.parse((await run(["show", "plan-a", "--json"])).stdout);
		expect(show.kind).toBe("plan");

		const inspect = JSON.parse(
			(await run(["inspect", "spec-a", "--json"])).stdout,
		);
		expect(inspect.kind).toBe("spec");
		expect(inspect.handoffCount).toBe(1);
	});
});
