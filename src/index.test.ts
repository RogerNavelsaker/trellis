import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { doctorProject } from "./doctor.ts";
import {
	initProject,
	TRELLIS_EVENTS,
	TRELLIS_GITIGNORE,
	TRELLIS_README,
} from "./init.ts";

describe("initProject", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("creates the managed .trellis layout", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-"));

		await initProject(tempDir);

		expect(await Bun.file(join(tempDir, ".trellis", "README.md")).text()).toBe(
			TRELLIS_README,
		);
		expect(await Bun.file(join(tempDir, ".trellis", ".gitignore")).text()).toBe(
			TRELLIS_GITIGNORE,
		);
		expect((await stat(join(tempDir, ".trellis", "specs"))).isDirectory()).toBe(
			true,
		);
		expect((await stat(join(tempDir, ".trellis", "plans"))).isDirectory()).toBe(
			true,
		);
		expect(
			(await stat(join(tempDir, ".trellis", "handoffs"))).isDirectory(),
		).toBe(true);
		expect(
			(await stat(join(tempDir, ".trellis", "templates"))).isDirectory(),
		).toBe(true);
		expect(
			await Bun.file(join(tempDir, ".trellis", TRELLIS_EVENTS)).text(),
		).toBe("");
	});
});

describe("doctorProject", () => {
	let tempDir: string | undefined;

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
			tempDir = undefined;
		}
	});

	test("reports all required artifacts after init", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "trellis-"));
		await initProject(tempDir);

		const checks = await doctorProject(tempDir);

		expect(checks.every((check) => check.ok)).toBe(true);
	});
});
