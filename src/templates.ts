import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TRELLIS_DIR } from "./init.ts";

export const TEMPLATE_FILES = {
	spec: `id: "{{spec_id}}"
title: "{{title}}"
seed: "{{seed_id}}"
status: draft
createdAt: "{{timestamp}}"
updatedAt: "{{timestamp}}"
objective: |
  {{objective}}
constraints:
  - "{{constraint_1}}"
acceptance:
  - "{{acceptance_1}}"
references:
  - "{{reference_1}}"
`,
	plan: `id: "{{plan_id}}"
title: "{{title}}"
seed: "{{seed_id}}"
spec: "{{spec_id}}"
status: draft
createdAt: "{{timestamp}}"
updatedAt: "{{timestamp}}"
summary: |
  {{summary}}
steps:
  - "{{step_1}}"
`,
	handoff: `# Handoff

Plan: {{plan_id}}
Spec: {{spec_id}}
Seed: {{seed_id}}
From: {{from}}
To: {{to}}

## Summary

{{summary}}

## Next Steps

- {{next_step_1}}
`,
} as const;

export type TemplateKind = keyof typeof TEMPLATE_FILES;

function templatePath(root: string, kind: TemplateKind): string {
	const ext = kind === "handoff" ? "md" : "yaml";
	return join(root, TRELLIS_DIR, "templates", `${kind}.${ext}`);
}

export async function initTemplates(root: string): Promise<string[]> {
	await mkdir(join(root, TRELLIS_DIR, "templates"), { recursive: true });
	const written: string[] = [];
	for (const kind of Object.keys(TEMPLATE_FILES) as TemplateKind[]) {
		const target = templatePath(root, kind);
		await writeFile(target, TEMPLATE_FILES[kind], "utf8");
		written.push(target);
	}
	return written;
}

export async function readTemplate(
	root: string,
	kind: TemplateKind,
): Promise<string> {
	return readFile(templatePath(root, kind), "utf8");
}
