# 2026-09-22 — Research checklist and release preparation

## Purpose and scope

The user requested an updated partial testing list, a minimalist README clearly
identifying the research prototyping platform, and commit/push/deploy of the
accumulated work. This release includes the preceding Castle gameplay, block
repairs, planning cycle and documentation changes recorded earlier today.

## Documentation changes

- Replaced the outdated Ocean-only feature catalogue with a short research-purpose
  README, local commands, checks and links to detailed documentation.
- Consolidated dispersed testing criteria into `docs/TESTING-CHECKLIST.md`, drawing
  from Rover build/prompt documents, issue #3, the block audit and actual validation
  records. The older plans are retained as historical context.
- Added case IDs, priority, concrete steps/expected behavior, evidence labels and
  a result template. Added Castle/plow/scoring, repeated Plan cycles, cancellation,
  display scale, imported projects, classroom device/collaboration and telemetry
  checks. Known failures and unanswered official-reference questions stay explicit.
- Added `docs/DEPLOYMENT.md`: shared Pages deployment branches, exact-commit checks,
  separate collaboration relay requirements and a prioritized reference-material list.

## Validation before publishing

Local lint, typecheck and static build passed. All 336 tests in 51 files passed with
coverage enabled; 99.32% line coverage applies only to the configured `engine/` and
`lib/robot-runtime.ts` scope, not to the whole application. Coverage threshold is 85%.
Earlier same-day browser verification covered two Castle planning cycles and the
menu/layout changes; this documentation pass does not turn pending checklist cases
into passes. Markdown links and the staged diff are checked before committing.

Intentional timing, scale and contact characterization-test updates are committed
separately from implementation, as required by the project rules. The implementation
and documentation are grouped into reviewable commits. The final push to `Mars-Rover`
triggers existing CI and Pages workflows; their eventual status must be verified
before reporting deployment complete. No release tag or version bump is requested.

## Follow-up

Keep issue #3 and the unresolved portions of issue #5 open. The official Castle
weights/physics, full Python and the remaining block/runtime gaps are not resolved
by this release. Hosted multiplayer additionally needs a reachable secure relay;
the current Pages workflow publishes the static application only.
