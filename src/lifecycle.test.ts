import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEvents } from "./events.ts";
import { readHandoffs } from "./handoffs.ts";
import { initProject } from "./init.ts";
import { createPlan, readPlan } from "./plans.ts";
import { createSpec, readSpec } from "./specs.ts";
import { transitionPlan, transitionSpec } from "./transitions.ts";

describe("Trellis lifecycle transitions", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("spec lifecycle follows draft -> active -> done", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-life-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Spec A",
			seed: "seed-1",
			status: "draft",
			objective: "Objective",
			constraints: [],
			acceptance: [],
			references: [],
		});

		await transitionSpec(tempDir, "spec-a", "active");
		expect((await readSpec(tempDir, "spec-a")).status).toBe("active");
		expect((await readEvents(tempDir)).at(-1)?.type).toBe("spec.transition");

		await transitionSpec(tempDir, "spec-a", "done");
		expect((await readSpec(tempDir, "spec-a")).status).toBe("done");

		await expect(transitionSpec(tempDir, "spec-a", "active")).rejects.toThrow(
			"spec cannot transition from done to active",
		);
	});

	test("plan lifecycle supports block/resume/complete and optional handoff recording", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-life-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Spec A",
			seed: "seed-1",
			status: "draft",
			objective: "Objective",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(tempDir, {
			id: "plan-a",
			title: "Plan A",
			seed: "seed-1",
			spec: "spec-a",
			status: "draft",
			summary: "Summary",
			steps: ["First"],
		});

		await transitionPlan(tempDir, "plan-a", "active");
		expect((await readPlan(tempDir, "plan-a")).status).toBe("active");

		await transitionPlan(tempDir, "plan-a", "blocked", {
			reason: "Waiting for review bandwidth",
			actor: "lead",
			to: "reviewer",
		});
		expect((await readPlan(tempDir, "plan-a")).status).toBe("blocked");
		expect((await readHandoffs(tempDir, "plan-a")).at(-1)?.summary).toBe(
			"Waiting for review bandwidth",
		);
		expect(
			(await readEvents(tempDir)).some(
				(event) => event.type === "plan.transition",
			),
		).toBe(true);

		await transitionPlan(tempDir, "plan-a", "active");
		await transitionPlan(tempDir, "plan-a", "done", {
			reason: "Implementation merged",
			actor: "reviewer",
			to: "lead",
		});
		expect((await readPlan(tempDir, "plan-a")).status).toBe("done");
	});

	test("spec completion is blocked until linked plans are done", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-life-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Spec A",
			seed: "seed-1",
			status: "draft",
			objective: "Objective",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(tempDir, {
			id: "plan-a",
			title: "Plan A",
			seed: "seed-1",
			spec: "spec-a",
			status: "active",
			summary: "Summary",
			steps: ["First"],
		});

		await transitionSpec(tempDir, "spec-a", "active");
		await expect(transitionSpec(tempDir, "spec-a", "done")).rejects.toThrow(
			"spec 'spec-a' cannot complete until linked plans are done: plan-a",
		);
	});
});
