import { cwd } from "node:process";
import type { Command } from "commander";
import { jsonOutput } from "../system/json.ts";
import { renderTemplate } from "../system/render.ts";
import {
	initTemplates,
	readTemplate,
	TEMPLATE_PLACEHOLDERS,
	type TemplateKind,
} from "../system/templates.ts";
import { handleCommandError, parseKeyValuePairs, printSuccess } from "../system/utils.ts";

/**
 * Register 'template' subcommands.
 */
export function register(program: Command): void {
	const template = program.command("template").description("Manage Trellis templates");

	template
		.command("init")
		.description("Write default spec, plan, and handoff templates into .trellis/templates")
		.action(async () => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const written = await initTemplates(cwd());
				if (global.json) {
					jsonOutput("template init", { written, count: written.length });
					return;
				}
				for (const file of written) printSuccess(`Wrote ${file}`);
			} catch (error) {
				handleCommandError("template init", error, global.json);
			}
		});

	template
		.command("show")
		.description("Show a template file")
		.argument("<kind>", "Template kind: spec, plan, or handoff")
		.action(async (kind: TemplateKind) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const templateText = await readTemplate(cwd(), kind);
				if (global.json) {
					jsonOutput("template show", { kind, template: templateText });
					return;
				}
				console.log(templateText);
			} catch (error) {
				handleCommandError("template show", error, global.json);
			}
		});

	template
		.command("placeholders")
		.argument("<kind>", "Template kind: spec, plan, or handoff")
		.description("List the stable placeholders Trellis guarantees for a template kind")
		.action((kind: TemplateKind) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const placeholders = TEMPLATE_PLACEHOLDERS[kind];
				if (!placeholders) throw new Error(`Unknown template kind '${kind}'`);
				if (global.json) {
					jsonOutput("template placeholders", { kind, placeholders });
					return;
				}
				for (const placeholder of placeholders) {
					console.log(placeholder);
				}
			} catch (error) {
				handleCommandError("template placeholders", error, global.json);
			}
		});

	template
		.command("render")
		.argument("<kind>", "Template kind: spec, plan, or handoff")
		.option("--data <pair>", "Key=value placeholder binding", (v, p: string[]) => [...p, v], [])
		.description("Render a template with explicit placeholder bindings")
		.action(async (kind: TemplateKind, opts) => {
			const global = program.opts<{ json?: boolean }>();
			try {
				const data = parseKeyValuePairs(opts.data);
				const output = await renderTemplate(cwd(), kind, data);
				if (global.json) {
					jsonOutput("template render", { kind, data, output });
					return;
				}
				console.log(output);
			} catch (error) {
				handleCommandError("template render", error, global.json);
			}
		});
}
