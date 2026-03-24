import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEvents } from "./events.ts";
import { readHandoffs } from "./handoffs.ts";
import { initProject } from "./init.ts";
import { readPlan } from "./plans.ts";
import { readSpec } from "./specs.ts";

describe("Trellis corruption handling", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("reports corrupt spec files with a stable Trellis error", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-corrupt-"));
		await initProject(tempDir);
		await writeFile(
			join(tempDir, ".trellis", "specs", "spec-a.yaml"),
			"id: spec-a\nstatus: draft\nobjective: Example\nconstraints:\nacceptance:\nreferences:\n",
			"utf8",
		);

		await expect(readSpec(tempDir, "spec-a")).rejects.toThrow(
			"corrupt spec 'spec-a': title must not be empty",
		);
	});

	test("reports corrupt plan files with a stable Trellis error", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-corrupt-"));
		await initProject(tempDir);
		await writeFile(
			join(tempDir, ".trellis", "plans", "plan-a.yaml"),
			"id: plan-a\ntitle: Plan A\nstatus: invalid\nsummary: Example\nsteps:\n",
			"utf8",
		);

		await expect(readPlan(tempDir, "plan-a")).rejects.toThrow(
			"corrupt plan 'plan-a': plan status must be one of: draft, active, blocked, done",
		);
	});

	test("reports corrupt handoff logs with line numbers", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-corrupt-"));
		await initProject(tempDir);
		await mkdir(join(tempDir, ".trellis", "handoffs"), { recursive: true });
		await writeFile(
			join(tempDir, ".trellis", "handoffs", "plan-a.jsonl"),
			'{"plan":"plan-a","from":"lead","to":"builder","summary":"ok","timestamp":"2026-03-24T00:00:00.000Z"}\n{bad json}\n',
			"utf8",
		);

		await expect(readHandoffs(tempDir, "plan-a")).rejects.toThrow(
			"corrupt handoff log 'plan-a' at line 2:",
		);
	});

	test("reports corrupt event logs with line numbers", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-corrupt-"));
		await initProject(tempDir);
		await writeFile(
			join(tempDir, ".trellis", "events.jsonl"),
			'{"timestamp":"2026-03-24T00:00:00.000Z","type":"spec.transition","artifactKind":"spec","artifactId":"spec-a"}\n{bad json}\n',
			"utf8",
		);

		await expect(readEvents(tempDir)).rejects.toThrow(
			"corrupt event log at line 2:",
		);
	});
});
