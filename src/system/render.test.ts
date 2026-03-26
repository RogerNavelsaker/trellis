import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initProject } from "./init.ts";
import { renderTemplate, renderTemplateText } from "./render.ts";
import { initTemplates, TEMPLATE_PLACEHOLDERS } from "./templates.ts";

describe("Trellis templates", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("exposes stable placeholder lists", () => {
		expect(TEMPLATE_PLACEHOLDERS.spec).toContain("spec_id");
		expect(TEMPLATE_PLACEHOLDERS.plan).toContain("plan_id");
		expect(TEMPLATE_PLACEHOLDERS.handoff).toContain("summary");
	});

	test("renders template text with explicit bindings", () => {
		const output = renderTemplateText("Hello {{name}} {{missing}}", {
			name: "world",
		});
		expect(output).toBe("Hello world {{missing}}");
	});

	test("renders persisted templates", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-render-"));
		await initProject(tempDir);
		await initTemplates(tempDir);

		const output = await renderTemplate(tempDir, "plan", {
			plan_id: "plan-a",
			title: "Plan A",
			seed_id: "seed-1",
			spec_id: "spec-a",
			timestamp: "2026-03-24T00:00:00.000Z",
			summary: "Summary",
			step_1: "First",
		});

		expect(output).toContain('id: "plan-a"');
		expect(output).toContain("summary: |");
		expect(output).toContain("  Summary");
	});
});
