import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendHandoff, readHandoffs } from "./handoffs.ts";
import { initProject } from "./init.ts";
import { createPlan, listPlans, readPlan } from "./plans.ts";
import { createSpec, listSpecs, readSpec } from "./specs.ts";

describe("Trellis storage", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("creates, reads, and lists specs", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);

		await createSpec(tempDir, {
			id: "spec-a",
			title: "Auth redesign",
			seed: "seed-123",
			status: "draft",
			objective: "Redesign auth around short-lived tokens.",
			constraints: ["No new daemon", "Keep CLI-first UX"],
			acceptance: ["Document the contract", "Preserve existing login flow"],
			references: ["docs/auth.md"],
		});

		const record = await readSpec(tempDir, "spec-a");
		expect(record.seed).toBe("seed-123");
		expect(record.constraints).toEqual(["No new daemon", "Keep CLI-first UX"]);
		expect((await listSpecs(tempDir)).map((spec) => spec.id)).toEqual([
			"spec-a",
		]);
	});

	test("creates, reads, and lists plans", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);

		await createPlan(tempDir, {
			id: "plan-a",
			title: "Auth rollout",
			seed: "seed-123",
			spec: "spec-a",
			status: "active",
			summary: "Land the auth redesign in two increments.",
			steps: ["Ship storage changes", "Ship CLI follow-up"],
		});

		const record = await readPlan(tempDir, "plan-a");
		expect(record.spec).toBe("spec-a");
		expect(record.steps).toEqual([
			"Ship storage changes",
			"Ship CLI follow-up",
		]);
		expect((await listPlans(tempDir)).map((plan) => plan.id)).toEqual([
			"plan-a",
		]);
	});

	test("appends and reads handoff logs", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);

		await appendHandoff(tempDir, {
			plan: "plan-a",
			from: "lead",
			to: "builder",
			summary: "Implement storage schema and lock writes.",
			spec: "spec-a",
			seed: "seed-123",
		});
		await appendHandoff(tempDir, {
			plan: "plan-a",
			from: "builder",
			to: "reviewer",
			summary: "Implementation complete, ready for review.",
			spec: "spec-a",
			seed: "seed-123",
		});

		const records = await readHandoffs(tempDir, "plan-a");
		expect(records).toHaveLength(2);
		expect(records[0]?.from).toBe("lead");
		expect(records[1]?.to).toBe("reviewer");
	});
});
