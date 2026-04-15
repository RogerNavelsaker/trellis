import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySnippet, ONBOARD_SNIPPET, onboard } from "./onboard.ts";

describe("applySnippet", () => {
	test("appends to an empty file", () => {
		const { body, replaced } = applySnippet("");
		expect(replaced).toBe(false);
		expect(body).toContain(ONBOARD_SNIPPET);
	});

	test("appends after existing content", () => {
		const { body, replaced } = applySnippet("# Title\n\nSome text.");
		expect(replaced).toBe(false);
		expect(body.startsWith("# Title")).toBe(true);
		expect(body).toContain(ONBOARD_SNIPPET);
	});

	test("replaces existing marker block", () => {
		const initial = `# Title\n\n<!-- trellis:start -->\nold content\n<!-- trellis:end -->\n\nTail.`;
		const { body, replaced } = applySnippet(initial);
		expect(replaced).toBe(true);
		expect(body).not.toContain("old content");
		expect(body).toContain(ONBOARD_SNIPPET);
		expect(body).toContain("Tail.");
	});

	test("errors on unbalanced markers", () => {
		expect(() => applySnippet("# Title\n\n<!-- trellis:start -->\n")).toThrow(/unbalanced/);
	});
});

describe("onboard", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("writes to CLAUDE.md when present", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-onboard-"));
		const target = join(tempDir, "CLAUDE.md");
		await writeFile(target, "# Existing\n", "utf8");
		const result = await onboard(tempDir);
		expect(result.action).toBe("written");
		expect(result.path).toBe(target);
		const contents = await readFile(target, "utf8");
		expect(contents).toContain(ONBOARD_SNIPPET);
	});

	test("updates idempotently when rerun", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-onboard-"));
		const target = join(tempDir, "AGENTS.md");
		await writeFile(target, "# Existing\n", "utf8");
		await onboard(tempDir);
		const before = await readFile(target, "utf8");
		const second = await onboard(tempDir);
		expect(second.action).toBe("updated");
		const after = await readFile(target, "utf8");
		expect(after).toBe(before);
	});

	test("prints when no target exists", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-onboard-"));
		const result = await onboard(tempDir);
		expect(result.action).toBe("printed");
	});

	test("--stdout skips writing even when file exists", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-onboard-"));
		const target = join(tempDir, "CLAUDE.md");
		await writeFile(target, "# Existing\n", "utf8");
		const result = await onboard(tempDir, { stdout: true });
		expect(result.action).toBe("printed");
		const contents = await readFile(target, "utf8");
		expect(contents).toBe("# Existing\n");
	});

	test("--file targets an explicit path", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-onboard-"));
		const target = join(tempDir, "custom.md");
		const result = await onboard(tempDir, { file: target });
		expect(result.action).toBe("written");
		expect(result.path).toBe(target);
		const contents = await readFile(target, "utf8");
		expect(contents).toContain(ONBOARD_SNIPPET);
	});
});
