# Project documentation

This VEXcode VR research prototype studies persistence and collaboration for
middle-school learners. Behavior changes need a traceable explanation, especially
when they affect timing, task difficulty, feedback, or recorded events.

## Start here

| Document | Purpose |
| --- | --- |
| [Testing checklist](TESTING-CHECKLIST.md) | Prioritized procedures, evidence, known gaps and research-session checks |
| [Deployment](DEPLOYMENT.md) | Publishing, collaboration hosting and useful reference materials |
| [Architecture](ARCHITECTURE.md) | Current modules, execution flow, units, state ownership and known exceptions |
| [Change history](CHANGELOG.md) | Dated implementation/handoff records |
| [Block audit](BLOCK-AUDIT.md) | Confirmed unresolved block behavior, reproductions and coverage limits |
| [Logging specification](LOGGING-SPEC.md) | External telemetry compatibility contract |
| [Agent instructions](../AGENTS.md) | Required documentation maintenance workflow |

## Feature specifications and historical plans

- [Rover Rescue specification](ROVER-RESCUE-SPEC.md), [visuals](ROVER-VISUALS.md),
  and [logging plan](ROVER-RESCUE-LOGGING-PLAN.md).
- [Rover build plan](ROVER-RESCUE-BUILD-PLAN.md) and
  [Cursor prompt pack](CURSOR-PROMPT-PACK.md) describe staged implementation work.
  A planned item is not evidence that it is implemented; check the current code/audit.
- [Original architecture plan](history/ARCHITECTURE-original-plan.md) is preserved
  for context. Its monolith descriptions and phase labels are historical.

## Continuing work

1. Start from updated `main` for new work; continue another branch only when the
   task is explicitly about that branch/PR. Inspect the working tree and latest
   relevant change record before editing.
2. Read the feature code and its tests; consult bundled Next.js docs before changing
   framework code. Preserve block IDs and the logging contract.
3. Keep implementation, tests and the documentation trail together. Use
   [the record template](changes/TEMPLATE.md) for substantive changes.
4. Report exactly what was validated. Distinguish passing tests, expected failures,
   source-only findings and unverified assumptions.
5. Record issue/PR links and commits when they exist. Do not invent a commit ID or
   imply a local change has been pushed.

## Local development

Use Node matching [`.nvmrc`](../.nvmrc) and install from the lockfile with `npm ci`.
`npm run dev:all` starts Next.js at `http://localhost:3000` and the collaboration
relay at `ws://localhost:1234`. The scripts bind to all interfaces.

On the Windows machine used for the 2026-09-22 handoff, the PowerShell `npm.ps1`
launcher was broken; `npm.cmd run dev:all` worked. This is a machine-specific
workaround, not a repository dependency. There is no need to replace the runtime
or reinstall dependencies when an existing installation works.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
CI additionally runs `npm test -- --coverage`; local tests without coverage do not
establish that the CI coverage gate passed. The build is a static export in `out/`.
For documentation-only changes, verify relative links, referenced paths and diff
whitespace; application tests do not validate documentation accuracy.
