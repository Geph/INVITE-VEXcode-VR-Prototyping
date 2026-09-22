<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project handoff and documentation

This is an educational research prototype. Changes to motion, scoring, blocks or
telemetry can alter learners' experiences and the interpretation of research data.

Before working, read [docs/README.md](docs/README.md), the relevant sections of
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and the latest relevant entry in
[docs/CHANGELOG.md](docs/CHANGELOG.md). Check `git status` and preserve existing work.

For each substantive behavior or structural change:

- Update the current architecture or feature documentation when its description changes.
- Add a dated record under `docs/changes/` and link it in `docs/CHANGELOG.md`.
  Follow [the change-record template](docs/changes/TEMPLATE.md).
- Record purpose, before/after behavior, affected paths, evidence and assumptions,
  validation results, known limitations, and related issue/PR/commit when available.
- Distinguish implemented behavior from plans and approximations. Never claim VEX
  parity from a smoke test or one reference video.
- Document deliberate changes to characterization/parity expectations. Do not
  remove expected-failure tests merely to make a suite green.
- Keep [the block audit](docs/BLOCK-AUDIT.md) and its issue references current as
  findings are fixed. Preserve `pg_*` identifiers and the telemetry contract in
  [docs/LOGGING-SPEC.md](docs/LOGGING-SPEC.md).

Keep the Next.js-generated block above intact. The instructions below it are
project-owned and should travel with the repository. Documentation changes alone
need link/path validation; behavior changes need relevant tests, lint, typecheck,
and a build. Consult the current architecture for known legacy exceptions.
