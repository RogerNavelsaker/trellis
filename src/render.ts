import { readTemplate, type TemplateKind } from "./templates.ts";

const PLACEHOLDER_RE = /\{\{([a-z0-9_]+)\}\}/gi;

export type RenderData = Record<string, string>;

export function renderTemplateText(template: string, data: RenderData): string {
	return template.replace(PLACEHOLDER_RE, (_, rawKey: string) => data[rawKey] ?? `{{${rawKey}}}`);
}

export async function renderTemplate(
	root: string,
	kind: TemplateKind,
	data: RenderData,
): Promise<string> {
	return renderTemplateText(await readTemplate(root, kind), data);
}
