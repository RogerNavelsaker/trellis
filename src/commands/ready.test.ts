import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlan } from "../storage/plans.ts";
import { createSpec } from "../storage/specs.ts";
import { initProject } from "../system/init.ts";
import { transitionPlan, transitionSpec } from "../workflow/transitions.ts";
import { buildReadyPayload } from "./ready.ts";

describe("buildReadyPayload", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	async function seed(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "trellis-ready-"));
		await initProject(dir);

		await createSpec(dir, {
			id: "spec-covered",
			title: "Covered",
			status: "active",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(dir, {
			id: "spec-orphan",
			title: "Orphan",
			status: "active",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(dir, {
			id: "spec-draft",
			title: "Draft",
			status: "draft",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});

		await createPlan(dir, {
			id: "plan-active",
			title: "Active",
			spec: "spec-covered",
			status: "active",
			summary: "s",
			steps: [],
		});
		await createPlan(dir, {
			id: "plan-draft",
			title: "Draft",
			status: "draft",
			summary: "s",
			steps: [],
		});
		await createPlan(dir, {
			id: "plan-blocked",
			title: "Blocked",
			status: "draft",
			summary: "s",
			steps: [],
		});
		await transitionPlan(dir, "plan-blocked", "blocked", { reason: "waiting" });

		await createPlan(dir, {
			id: "plan-done",
			title: "Done",
			status: "draft",
			summary: "s",
			steps: [],
		});
		await transitionPlan(dir, "plan-done", "active");
		await transitionPlan(dir, "plan-done", "done", { summary: "finished" });

		// complete a separate spec
		await createSpec(dir, {
			id: "spec-done",
			title: "Done",
			status: "draft",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await transitionSpec(dir, "spec-done", "active");
		await transitionSpec(dir, "spec-done", "done", { summary: "ok" });

		return dir;
	}

	test("excludes blocked and done plans", async () => {
		tempDir = await seed();
		const payload = await buildReadyPayload(tempDir);
		const ids = payload.plans.map((plan) => plan.id);
		expect(ids).toContain("plan-active");
		expect(ids).toContain("plan-draft");
		expect(ids).not.toContain("plan-blocked");
		expect(ids).not.toContain("plan-done");
	});

	test("surfaces active specs without a plan", async () => {
		tempDir = await seed();
		const payload = await buildReadyPayload(tempDir);
		const ids = payload.specsAwaitingPlan.map((spec) => spec.id);
		expect(ids).toContain("spec-orphan");
		expect(ids).not.toContain("spec-covered");
		expect(ids).not.toContain("spec-draft");
		expect(ids).not.toContain("spec-done");
	});
});
