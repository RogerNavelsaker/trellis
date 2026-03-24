# Contributing

Contributions are welcome.

## Development

```bash
bun install
bun test
bun run lint
bun run typecheck
```

## Guidelines

- Keep `.trellis/` storage changes backward-compatible unless a migration path is documented.
- Keep `--json` payloads backward-compatible unless there is a clearly documented breaking change.
- Prefer additive changes over renames or removals.
- Keep Trellis standalone. Integration with the rest of `os-eco` should remain composable, not required.
