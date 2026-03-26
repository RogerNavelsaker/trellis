import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendHandoff, readHandoffs } from "./handoffs.ts";
import { initProject } from "./init.ts";
import { createPlan, listPlans, readPlan, updatePlan } from "./plans.ts";
import { createSpec, listSpecs, readSpec, updateSpec } from "./specs.ts";
import { initTemplates, readTemplate } from "./templates.ts";

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
		expect((await listSpecs(tempDir)).map((spec) => spec.id)).toEqual(["spec-a"]);
	});

	test("creates, reads, and lists plans", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Auth redesign",
			seed: "seed-123",
			status: "draft",
			objective: "Redesign auth around short-lived tokens.",
			constraints: [],
			acceptance: [],
			references: [],
		});

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
		expect(record.steps).toEqual(["Ship storage changes", "Ship CLI follow-up"]);
		expect((await listPlans(tempDir)).map((plan) => plan.id)).toEqual(["plan-a"]);
	});

	test("filters and updates specs", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);

		await createSpec(tempDir, {
			id: "spec-a",
			title: "Auth redesign",
			seed: "seed-123",
			status: "draft",
			objective: "Redesign auth around short-lived tokens.",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(tempDir, {
			id: "spec-b",
			title: "CLI cleanup",
			seed: "seed-456",
			status: "active",
			objective: "Tighten CLI output and help text.",
			constraints: [],
			acceptance: [],
			references: [],
		});

		const updated = await updateSpec(tempDir, "spec-a", {
			status: "active",
			acceptance: ["Auth flow passes smoke test"],
		});

		expect(updated.status).toBe("active");
		expect(updated.title).toBe("Auth redesign");
		expect(updated.acceptance).toEqual(["Auth flow passes smoke test"]);
		expect((await listSpecs(tempDir, { status: "active" })).map((spec) => spec.id)).toEqual([
			"spec-a",
			"spec-b",
		]);
		expect((await listSpecs(tempDir, { seed: "seed-123" })).map((spec) => spec.id)).toEqual([
			"spec-a",
		]);
	});

	test("filters and updates plans", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Auth redesign",
			seed: "seed-123",
			status: "draft",
			objective: "Redesign auth around short-lived tokens.",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(tempDir, {
			id: "plan-a",
			title: "Auth rollout",
			seed: "seed-123",
			spec: "spec-a",
			status: "draft",
			summary: "Land the auth redesign in two increments.",
			steps: ["Ship storage changes"],
		});
		await createPlan(tempDir, {
			id: "plan-b",
			title: "CLI rollout",
			seed: "seed-456",
			spec: "spec-a",
			status: "blocked",
			summary: "Wait on auth storage changes.",
			steps: ["Wait"],
		});

		const updated = await updatePlan(tempDir, "plan-a", {
			status: "active",
			steps: ["Ship storage changes", "Wire CLI flow"],
		});

		expect(updated.status).toBe("active");
		expect(updated.title).toBe("Auth rollout");
		expect(updated.spec).toBe("spec-a");
		expect(updated.steps).toEqual(["Ship storage changes", "Wire CLI flow"]);
		expect((await listPlans(tempDir, { status: "active" })).map((plan) => plan.id)).toEqual([
			"plan-a",
		]);
		expect((await listPlans(tempDir, { spec: "spec-a" })).map((plan) => plan.id)).toEqual([
			"plan-a",
			"plan-b",
		]);
	});

	test("rejects invalid seeds and missing linked specs", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);

		await expect(
			createSpec(tempDir, {
				id: "spec-a",
				title: "Bad seed",
				seed: "not a seed",
				status: "draft",
				objective: "Invalid seed format.",
				constraints: [],
				acceptance: [],
				references: [],
			}),
		).rejects.toThrow("seed must look like a Seeds ID");

		await expect(
			createPlan(tempDir, {
				id: "plan-a",
				title: "Missing spec",
				seed: "seed-123",
				spec: "spec-missing",
				status: "draft",
				summary: "Should fail",
				steps: [],
			}),
		).rejects.toThrow("linked spec 'spec-missing' does not exist");
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

	test("initializes and reads templates", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-storage-"));
		await initProject(tempDir);

		const written = await initTemplates(tempDir);
		expect(written).toHaveLength(3);
		expect(await readTemplate(tempDir, "spec")).toContain("{{spec_id}}");
		expect(await readTemplate(tempDir, "handoff")).toContain("## Summary");
	});
});
