import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendHandoff } from "../storage/handoffs.ts";
import { createPlan } from "../storage/plans.ts";
import { createSpec } from "../storage/specs.ts";
import { initProject } from "../system/init.ts";
import { transitionPlan } from "../workflow/transitions.ts";
import { buildStatsPayload } from "./stats.ts";

describe("buildStatsPayload", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("counts artifacts and handoffs", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-stats-"));
		await initProject(tempDir);

		await createSpec(tempDir, {
			id: "spec-a",
			title: "A",
			status: "active",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(tempDir, {
			id: "spec-b",
			title: "B",
			status: "draft",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});

		await createPlan(tempDir, {
			id: "plan-a",
			title: "A",
			spec: "spec-a",
			status: "active",
			summary: "s",
			steps: ["s1", "s2"],
		});
		await createPlan(tempDir, {
			id: "plan-b",
			title: "B",
			status: "draft",
			summary: "s",
			steps: ["s3"],
		});
		await transitionPlan(tempDir, "plan-b", "blocked", { reason: "hold" });

		await appendHandoff(tempDir, {
			plan: "plan-a",
			from: "x",
			to: "y",
			summary: "hi",
		});

		const stats = await buildStatsPayload(tempDir);
		expect(stats.specs.active).toBe(1);
		expect(stats.specs.draft).toBe(1);
		expect(stats.plans.active).toBe(1);
		expect(stats.plans.blocked).toBe(1);
		expect(stats.planSteps.active).toBe(3);
		expect(stats.handoffs.total).toBeGreaterThanOrEqual(1);
		expect(stats.handoffs.last7d).toBeGreaterThanOrEqual(1);
		expect(stats.orphans.specsWithoutPlans).toBe(1);
	});

	test("empty project returns zeros", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-stats-empty-"));
		await initProject(tempDir);
		const stats = await buildStatsPayload(tempDir);
		expect(stats.specs.active).toBe(0);
		expect(stats.plans.active).toBe(0);
		expect(stats.handoffs.total).toBe(0);
	});
});
