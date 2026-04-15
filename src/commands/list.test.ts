import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendHandoff } from "../storage/handoffs.ts";
import { createPlan } from "../storage/plans.ts";
import { createSpec } from "../storage/specs.ts";
import { initProject } from "../system/init.ts";
import { buildListRows } from "./list.ts";

describe("buildListRows", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	async function fixture(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "trellis-list-"));
		await initProject(dir);
		await createSpec(dir, {
			id: "spec-a",
			title: "A",
			status: "active",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createSpec(dir, {
			id: "spec-b",
			title: "B",
			status: "draft",
			objective: "o",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(dir, {
			id: "plan-a",
			title: "Plan A",
			spec: "spec-a",
			status: "active",
			summary: "s",
			steps: [],
		});
		for (let i = 0; i < 3; i += 1) {
			await appendHandoff(dir, {
				plan: "plan-a",
				from: "x",
				to: "y",
				summary: `h ${i}`,
			});
		}
		return dir;
	}

	test("returns all kinds by default", async () => {
		tempDir = await fixture();
		const rows = await buildListRows(tempDir);
		const kinds = new Set(rows.map((row) => row.kind));
		expect(kinds.has("spec")).toBe(true);
		expect(kinds.has("plan")).toBe(true);
		expect(kinds.has("handoff")).toBe(true);
	});

	test("--type narrows output", async () => {
		tempDir = await fixture();
		const rows = await buildListRows(tempDir, { type: "spec" });
		expect(rows.every((row) => row.kind === "spec")).toBe(true);
		expect(rows).toHaveLength(2);
	});

	test("--status filters specs and plans", async () => {
		tempDir = await fixture();
		const rows = await buildListRows(tempDir, { status: "active" });
		const ids = rows.filter((row) => row.kind !== "handoff").map((row) => row.id);
		expect(ids).toEqual(["spec-a", "plan-a"]);
	});

	test("--limit caps per kind", async () => {
		tempDir = await fixture();
		const rows = await buildListRows(tempDir, { limit: 1 });
		const perKind = new Map<string, number>();
		for (const row of rows) perKind.set(row.kind, (perKind.get(row.kind) ?? 0) + 1);
		expect(perKind.get("handoff")).toBe(1);
		expect(perKind.get("spec")).toBe(1);
		expect(perKind.get("plan")).toBe(1);
	});

	test("--plan restricts handoffs", async () => {
		tempDir = await fixture();
		const rows = await buildListRows(tempDir, { type: "handoff", plan: "plan-a" });
		expect(rows).toHaveLength(3);
	});

	test("--since rejects bad values", async () => {
		tempDir = await fixture();
		await expect(buildListRows(tempDir, { since: "not-a-date" })).rejects.toThrow();
	});
});
