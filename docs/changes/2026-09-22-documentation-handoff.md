# 2026-09-22 — Documentation handoff

## Purpose and status

The user requested a durable trail of structure, functionality and alterations
for other agents. At this record's creation, documentation and the preceding
gameplay work are local, uncommitted changes on `Mars-Rover`.

## Changes

- Replaced the outdated target architecture with a map of the current host,
  playgrounds, block runtime, rendering and telemetry boundaries.
- Preserved the original architecture plan in `docs/history/` with a historical banner.
- Added the documentation index, dated change history, reusable record template,
  and retrospective Castle gameplay handoff.
- Added documentation-maintenance instructions to root `AGENTS.md`, preserving
  the generated Next.js block. Removed its ignore rule so future commits can carry
  these instructions to other clones. The generated `CLAUDE.md` pointer stays ignored.
- Linked the trail from the root README and Cursor rules, and corrected the
  README's obsolete project tree. Updated the local audit's issue reference and
  its note about Castle waiting for pending motion.

## Validation and limits

Read the current entry point, playground registry/contract, host hooks, runtime
APIs, CI workflow and working-tree changes. Checked local Markdown links and
referenced paths, plus diff whitespace. No application behavior changes in this
documentation pass; application tests were not rerun.

Historical notes are preserved, not proof that all planned features landed.
Future agents should update current docs and add a dated record with each
substantive implementation change.
