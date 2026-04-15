import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendHandoff } from "../storage/handoffs.ts";
import { createPlan } from "../storage/plans.ts";
import { createSpec } from "../storage/specs.ts";
import { initProject } from "../system/init.ts";
import { transitionPlan } from "../workflow/transitions.ts";
import { buildPrimePayload, parseSince, renderMarkdown } from "./prime.ts";

describe("parseSince", () => {
	const now = new Date("2026-04-15T12:00:00.000Z");

	test("parses relative durations", () => {
		expect(parseSince("24h", now)).toBe("2026-04-14T12:00:00.000Z");
		expect(parseSince("7d", now)).toBe("2026-04-08T12:00:00.000Z");
		expect(parseSince("30m", now)).toBe("2026-04-15T11:30:00.000Z");
		expect(parseSince("45s", now)).toBe("2026-04-15T11:59:15.000Z");
	});

	test("parses ISO timestamps", () => {
		expect(parseSince("2026-04-15T00:00:00.000Z", now)).toBe("2026-04-15T00:00:00.000Z");
	});

	test("returns null for garbage", () => {
		expect(parseSince("not-a-date", now)).toBeNull();
		expect(parseSince("", now)).toBeNull();
	});
});

describe("buildPrimePayload", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	async function fixture(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "trellis-prime-"));
		await initProject(dir);

		await createSpec(dir, {
			id: "spec-active",
			title: "Active Spec",
			status: "active",
			objective: "obj",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(dir, {
			id: "spec-draft",
			title: "Draft Spec",
			status: "draft",
			objective: "obj",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(dir, {
			id: "spec-done",
			title: "Done Spec",
			status: "done",
			objective: "obj",
			constraints: [],
			acceptance: [],
			references: [],
			completedAt: new Date().toISOString(),
			completionSummary: "finished",
		});

		await createPlan(dir, {
			id: "plan-active",
			title: "Active Plan",
			spec: "spec-active",
			status: "draft",
			summary: "do work",
			steps: ["step one", "step two"],
		});
		await transitionPlan(dir, "plan-active", "active");

		await createPlan(dir, {
			id: "plan-blocked",
			title: "Blocked Plan",
			status: "draft",
			summary: "waiting",
			steps: [],
		});
		await transitionPlan(dir, "plan-blocked", "blocked", { reason: "waiting on review" });

		await createPlan(dir, {
			id: "plan-done",
			title: "Done Plan",
			status: "draft",
			summary: "ok",
			steps: [],
		});
		await transitionPlan(dir, "plan-done", "active");
		await transitionPlan(dir, "plan-done", "done", { summary: "finished" });

		for (let i = 0; i < 12; i += 1) {
			await appendHandoff(dir, {
				plan: "plan-active",
				from: "a",
				to: "b",
				summary: `msg ${i}`,
			});
		}

		return dir;
	}

	test("includes active/draft/blocked artifacts and caps handoffs", async () => {
		tempDir = await fixture();
		const payload = await buildPrimePayload(tempDir);

		expect(payload.specs.map((s) => s.id).sort()).toEqual(["spec-active", "spec-draft"]);
		expect(payload.plans.map((p) => p.id).sort()).toEqual(["plan-active", "plan-blocked"]);
		expect(payload.blocked).toHaveLength(1);
		expect(payload.blocked[0]?.plan.id).toBe("plan-blocked");
		expect(payload.blocked[0]?.reason).toBe("waiting on review");
		expect(payload.handoffs).toHaveLength(10);
		expect(payload.truncated.handoffs).toBe(true);
	});

	test("custom --status list narrows output", async () => {
		tempDir = await fixture();
		const payload = await buildPrimePayload(tempDir, { status: "active" });
		expect(payload.specs.map((s) => s.id)).toEqual(["spec-active"]);
		expect(payload.plans.map((p) => p.id)).toEqual(["plan-active"]);
	});

	test("--since filters handoffs", async () => {
		tempDir = await fixture();
		const future = new Date(Date.now() + 60_000).toISOString();
		const payload = await buildPrimePayload(tempDir, { since: future });
		expect(payload.handoffs).toHaveLength(0);
	});

	test("markdown render includes each section", async () => {
		tempDir = await fixture();
		const payload = await buildPrimePayload(tempDir);
		const md = renderMarkdown(payload, false);
		expect(md).toContain("## Specs");
		expect(md).toContain("## Plans");
		expect(md).toContain("## Blocked");
		expect(md).toContain("## Recent handoffs");
		expect(md).toContain("plan-blocked");
		expect(md).toContain("waiting on review");
	});

	test("--full includes step notes", async () => {
		tempDir = await fixture();
		const payload = await buildPrimePayload(tempDir);
		const full = renderMarkdown(payload, true);
		const compact = renderMarkdown(payload, false);
		expect(full).toContain("step one");
		expect(compact).not.toContain("step one");
	});

	test("--budget drops oldest handoffs first", async () => {
		tempDir = await fixture();
		const payload = await buildPrimePayload(tempDir, { budget: 80 });
		expect(payload.handoffs.length).toBeLessThan(10);
		expect(payload.truncated.handoffs).toBe(true);
	});
});
