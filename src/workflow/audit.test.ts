import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlan } from "../storage/plans.ts";
import { createSpec } from "../storage/specs.ts";
import { initProject } from "../system/init.ts";
import { auditBlocked, auditOrphaned, auditStale } from "./audit.ts";
import { transitionPlan, transitionSpec } from "./transitions.ts";

describe("Trellis audit views", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("audit blocked reports the latest block reason", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-audit-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Spec A",
			status: "draft",
			objective: "Objective",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(tempDir, {
			id: "plan-a",
			title: "Plan A",
			spec: "spec-a",
			status: "draft",
			summary: "Summary",
			steps: ["First"],
		});

		await transitionPlan(tempDir, "plan-a", "active");
		await transitionPlan(tempDir, "plan-a", "blocked", {
			reason: "Waiting on review",
			actor: "lead",
			to: "reviewer",
		});

		const blocked = await auditBlocked(tempDir);
		expect(blocked).toHaveLength(1);
		expect(blocked[0]?.plan.id).toBe("plan-a");
		expect(blocked[0]?.latestBlockReason).toBe("Waiting on review");
	});

	test("audit stale uses last event activity for open artifacts", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-audit-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Spec A",
			status: "draft",
			objective: "Objective",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(tempDir, {
			id: "plan-a",
			title: "Plan A",
			spec: "spec-a",
			status: "draft",
			summary: "Summary",
			steps: ["First"],
		});
		await transitionSpec(tempDir, "spec-a", "active");
		await transitionPlan(tempDir, "plan-a", "active");

		const stale = await auditStale(tempDir, 7, new Date("2030-03-24T00:00:00.000Z"));
		expect(stale.map((entry) => entry.id).sort()).toEqual(["plan-a", "spec-a"]);
	});

	test("audit orphaned reports specs without plans and handoffs for missing plans", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-audit-"));
		await initProject(tempDir);
		await createSpec(tempDir, {
			id: "spec-a",
			title: "Spec A",
			status: "draft",
			objective: "Objective",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await mkdir(join(tempDir, ".trellis", "handoffs"), { recursive: true });
		await writeFile(
			join(tempDir, ".trellis", "handoffs", "missing-plan.jsonl"),
			`${JSON.stringify({
				timestamp: "2026-03-01T00:00:00.000Z",
				plan: "missing-plan",
				from: "lead",
				to: "builder",
				summary: "Missing plan handoff",
			})}\n`,
			"utf8",
		);

		const orphaned = await auditOrphaned(tempDir);
		expect(orphaned.specsWithoutPlans.map((spec) => spec.id)).toEqual(["spec-a"]);
		expect(orphaned.plansWithMissingSpecs).toEqual([]);
		expect(orphaned.handoffsForMissingPlans).toEqual([{ plan: "missing-plan", count: 1 }]);
	});
});
