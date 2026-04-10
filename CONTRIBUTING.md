# Contributing to Trellis

Thanks for your interest in contributing to Trellis! This guide covers everything you need to get started.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/trellis.git
   cd trellis
   ```
3. **Install** dependencies:
   ```bash
   bun install
   ```
4. **Link** the CLI for local development:
   ```bash
   bun link
   ```
5. **Create a branch** for your work:
   ```bash
   git checkout -b fix/description-of-change
   ```

## Branch Naming

Use descriptive branch names with a category prefix:

- `fix/` -- Bug fixes
- `feat/` -- New features
- `docs/` -- Documentation changes
- `refactor/` -- Code refactoring
- `test/` -- Test additions or fixes

## Build & Test Commands

```bash
bun test                                       # Run all tests
bun test src/storage/storage.test.ts           # Run a single test file
bun run lint                                   # Biome check
bun run lint:fix                               # Auto-fix lint + format issues
bun run typecheck                              # Type check (tsc --noEmit)
bun test && bun run lint && bun run typecheck  # All quality gates
```

Always run all quality gates before submitting a PR.

## TypeScript Conventions

Trellis is a strict TypeScript project that runs directly on Bun (no build step).

### Strict Mode

- `noUncheckedIndexedAccess` is enabled -- always handle possible `undefined` from indexing
- `noExplicitAny` is an error -- use `unknown` and narrow, or define proper types
- `useConst` is enforced -- use `const` unless reassignment is needed
- `noNonNullAssertion` is a warning -- avoid `!` postfix, check for null/undefined instead

### Minimal Runtime Dependencies

The only allowed runtime dependencies are `chalk` (output formatting) and `commander` (CLI framework). Do not add new runtime npm packages — use Bun built-in APIs instead:

- `Bun.file` and `Bun.write` for file I/O
- `node:fs/promises` for directory operations
- `node:path` and `node:process` for platform utilities

External tools (`seeds`, `mulch`, `git`) are invoked as subprocesses via `Bun.spawn`, never as npm imports.

### File Organization

- All shared types and interfaces go in `src/types.ts`
- Each CLI command gets its own file under `src/commands/`
- Storage (YAML/JSONL read/write) lives under `src/storage/`
- Core runtime utilities live under `src/system/`
- Business logic (transitions, audits) lives under `src/workflow/`

### Formatting

- **Tab indentation** (enforced by Biome)
- **100 character line width** (enforced by Biome)
- Biome handles import organization automatically

## Testing Conventions

- **No mocks** unless absolutely necessary. Tests use real filesystems and real git repos.
- Create temp directories with `mkdtemp` for file I/O tests
- Clean up in `afterEach`
- Tests are colocated with source files: `src/storage/storage.test.ts` alongside `src/storage/specs.ts` and `src/storage/plans.ts`

**Only mock when the real thing has unacceptable side effects.** When mocking is necessary, document WHY in a comment at the top of the test file.

Example test structure:

```typescript
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it, expect } from "bun:test";

describe("my-feature", () => {
  let testDir: string | undefined;

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
      testDir = undefined;
    }
  });

  it("does the thing", async () => {
    testDir = await mkdtemp(join(tmpdir(), "trellis-test-"));
    // Write real files, run real code, assert real results
  });
});
```

## Commit Message Style

Use concise, descriptive commit messages:

```
fix: resolve spec transition bug for completed plans
feat: add doctor check for orphaned handoffs
docs: update CLI reference with new handoff flags
```

Prefix with `fix:`, `feat:`, or `docs:` when the category is clear. Plain descriptive messages are also fine.

## Pull Request Expectations

- **One concern per PR.** Keep changes focused -- a bug fix, a feature, a refactor. Not all three.
- **Tests required.** New features and bug fixes should include tests. See the testing conventions above.
- **Passing CI.** All PRs must pass CI checks (lint + typecheck + test) before merge.
- **Description.** Briefly explain what the PR does and why. Link to any relevant issues.

## Reporting Issues

Use [GitHub Issues](https://github.com/jayminwest/trellis/issues) for bug reports and feature requests. For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
