import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendHandoff } from "../storage/handoffs.ts";
import { createPlan } from "../storage/plans.ts";
import { createSpec } from "../storage/specs.ts";
import { initProject } from "../system/init.ts";
import { searchArtifacts } from "./search.ts";

describe("searchArtifacts", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	async function seed(): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "trellis-search-"));
		await initProject(dir);
		await createSpec(dir, {
			id: "auth-refresh",
			title: "Refresh token redesign",
			status: "active",
			objective: "Short-lived tokens with refresh flow.",
			constraints: [],
			acceptance: [],
			references: [],
		});
		await createPlan(dir, {
			id: "auth-refresh-v1",
			title: "Ship auth increment",
			spec: "auth-refresh",
			status: "active",
			summary: "Land storage and refresh path.",
			steps: ["Define token format", "Wire refresh flow"],
		});
		await appendHandoff(dir, {
			plan: "auth-refresh-v1",
			from: "lead",
			to: "builder",
			summary: "Please implement refresh path",
		});
		return dir;
	}

	test("finds case-insensitive matches across kinds", async () => {
		tempDir = await seed();
		const hits = await searchArtifacts(tempDir, "REFRESH");
		const kinds = new Set(hits.map((hit) => hit.kind));
		expect(kinds.has("spec")).toBe(true);
		expect(kinds.has("plan")).toBe(true);
		expect(kinds.has("handoff")).toBe(true);
	});

	test("--type narrows output", async () => {
		tempDir = await seed();
		const hits = await searchArtifacts(tempDir, "refresh", { type: "spec" });
		expect(hits.every((hit) => hit.kind === "spec")).toBe(true);
	});

	test("--limit caps total hits", async () => {
		tempDir = await seed();
		const hits = await searchArtifacts(tempDir, "refresh", { limit: 1 });
		expect(hits).toHaveLength(1);
	});

	test("empty query returns no hits", async () => {
		tempDir = await seed();
		const hits = await searchArtifacts(tempDir, "   ");
		expect(hits).toHaveLength(0);
	});

	test("matches plan step notes", async () => {
		tempDir = await seed();
		const hits = await searchArtifacts(tempDir, "token format");
		const planHit = hits.find((hit) => hit.kind === "plan");
		expect(planHit?.field.startsWith("steps[")).toBe(true);
	});
});
