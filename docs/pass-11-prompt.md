# Pass 11: CLI Contract and Ecosystem UX Parity

System Context & Mission:
You are a senior software engineer performing the final CLI-facing alignment pass on the `trellis` repository ahead of a future ownership transfer and deeper adoption across the `os-eco` stack (`overstory`, `canopy`, `seeds`, `sapling`, `mulch`).

Previous passes have already completed metadata migration, structural refactors, domain-driven source layout, centralized formatting, documentation migration, release workflow alignment, and follow-up cleanup through Pass 10. The repository is already close to stack parity.

Your Objective:
Perform a final ecosystem UX and contract pass focused on command-surface consistency, help/version behavior, color/output conventions, and JSON safety.

Scope:

1. Root Help Contract Audit
Review `trellis --help` against current `overstory`, `canopy`, and `mulch` behavior.
  - Align the top-level banner, usage line, command table spacing, option text, and command-specific-help footer with the established `os-eco` CLI style.
  - Check whether the root command should present the binary alias style used elsewhere (`ov`, `cn`, `tl`, etc.).
  - Remove any Trellis-specific root-help content that does not belong in the shared ecosystem pattern unless it is clearly intentional and documented.

2. Color and Output Path Audit
Trace all human-readable CLI output paths in `src/index.ts`, `src/system/output.ts`, and `src/commands/**/*.ts`.
  - Ensure the CLI uses the same forest-palette conventions as the rest of the stack.
  - Ensure colored help and human-readable status output route through the same conventions instead of ad hoc formatting.
  - Confirm `--quiet` suppresses only the categories of output it should suppress.

3. JSON Safety and Failure Semantics
Audit all `--json` paths, including top-level errors.
  - Ensure `--json` never emits ANSI escape codes.
  - Ensure `--json` never leaks stray `console.log` or `console.error` output outside the documented JSON envelope.
  - Verify `version-json`, `doctor --json`, and representative command failures all obey the documented envelope.
  - Update `docs/json-contract.md` if the explicit guarantees are underspecified.

4. Dependency and Config Parity
Compare `package.json`, `tsconfig.json`, and `biome.json` against current `seeds` and `overstory`.
  - Keep exact alignment for shared foundational dependencies where practical: `commander`, `chalk`, `@biomejs/biome`, `@types/bun`, `typescript`.
  - Preserve or tighten strictness settings; do not loosen them.
  - If Trellis intentionally diverges, document the reason in the change summary.

5. Documentation Drift Check
Re-scan `docs/` and the root README for any remaining wording drift.
  - Remove stale wording about older help behavior, old ownership, or obsolete command-surface expectations.
  - Confirm docs describe the current domain-driven source layout and current JSON/storage contracts.

Execution Rules:
  - Do not revert the current domain-driven `src/commands`, `src/storage`, `src/system`, `src/workflow` structure.
  - Explain findings concisely before modifying files.
  - If code or docs change, run:
    - `bun run lint --write`
    - `bun run typecheck`
    - `bun test`
    - `bun ./src/index.ts doctor`
  - Validate `bun ./src/index.ts --help` after the patch and compare it mentally to the rest of the stack before finishing.
