# 2026-09-22 — Castle gameplay, distance scale and block audit

## Purpose and status

Improve Castle Crasher+ toward the supplied gameplay reference, double robot speed,
check playground distance scales, and audit blocks for failures. Research context:
persistence and collaboration for middle-school learners.

At the end of this work the changes were local and uncommitted on `Mars-Rover`.
No implementation commit, PR or deployment was created. The audit was published
as [GitHub issue #5](https://github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/5).

## Before and after

| Concern | Before | After |
| --- | --- | --- |
| Motion speed | 10 ms/mm and 22 ms/degree at 50% | 5 ms/mm and 11 ms/degree; shared across all playgrounds. Existing 80-ms floor remains. |
| Castle orientation | Config pointed left, but display/start/reset paths wrote zero | Host pose and run/reset preserve the configured -90° heading |
| Island edge | Host clamp prevented reaching water | Drive can cross the boundary; physics ends the run |
| Castle contact | Contact displacement only; debris immediately stopped | Debris velocity, friction, spin, secondary contact and fixed-obstacle sweeps |
| Score/outcome | Fractional component weights and minimal water notice | Tunable whole-kg component weights, one-time clearing, same-step scoring/fall, settling interval and result card |
| End UI | No reference-style results/certificate flow | Water-backed stone-frame card, score, stop/fall/complete reason, SVG certificate and Try Again |
| Reef size | Fixed pixels/mm made window dimensions change effective world size | Fixed 2000-mm projection, invariant coral geometry, coral on field boundary and world-space hull collision |
| Reef sensors | Tied to visible pixel geometry | Legacy sensor helpers receive a fixed-scale virtual projection independently of window size |

Rover's 12000 × 6000-mm world was already represented in millimetres and was not
resized. Castle keeps the documented 3288-mm hex diameter; camera water padding
does not change that physical diameter. No block IDs or telemetry schemas were renamed.

## Implementation map

- `engine/motion.ts`: shared speed constants; `lib/robot-runtime.ts`: Reef field
  projection and compatibility wrapper behavior.
- `hooks/playground-host.ts`, `usePlaygroundSession.ts`, `useProgramRunner.ts`:
  heading preservation and lifecycle/state plumbing.
- `hooks/program-robot-api.ts`, `program-types.ts`: Castle state ownership for API
  calls/stops; expose pending-motion completion to the runner.
- `hooks/playground-motion.ts`, `useRobotAnimation.ts`: allow water crossing while
  sweeping against fixed rocks/trees.
- `hooks/usePlaygroundDraw.ts`: fixed Castle simulation steps, interpolation of
  sampled robot movement, outcomes, hidden-window ticking and render integration.
- `components/workspace/VexWorkbench.tsx`: Castle stop/reset/outcome wiring.
- `playgrounds/castle-crashers/`: configuration, layout/state, physics, art, score,
  HUD and new `results.tsx`.
- `playgrounds/ocean-reef/`: projection/camera, canonical coral layout, sensor scale,
  collection scaling and world-space hull contact radius.

See [current architecture](../ARCHITECTURE.md) for the complete execution flow.

## Reference evidence and assumptions

The supplied `Castle Crashers video.mp4` is approximately 19.9 seconds long. It was
reviewed through one-second reference frames, including debris scattering, score
increments and the 1850-kg final card. The video stays outside the repository;
temporary frames were written under ignored `.next/` and are not durable fixtures.

[Official Castle documentation](https://api.vex.com/vr/home/playgrounds/castle_crasher_plus.html)
establishes diameter, starting coordinates, level differences and certificate behavior.
[Official drivetrain documentation](https://api.vex.com/vr/home/blocks/drivetrain.html)
informed the block audit. The requested left-facing start and doubled speed come
from the user's instructions.

Per-component masses, collision coefficients, exact layout and end-animation timing
are TUNABLE estimates. A single final score cannot identify each component's mass.
The prototype does not reproduce the reference's full 3D physics or guarantee the
same score for the same program. The certificate is original SVG artwork labeled
as a research prototype.

## Validation

- `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`: passed.
- Final `npm.cmd test -- --reporter=dot`: 49 files, 321 passing tests, 5 expected failures.
  CI's additional coverage command was not run during this pass.
- Extended generator/API smoke execution to Castle. Added tests for leftward
  mm/inch driving, correct stop-state ownership, edge crossing, fixed-obstacle
  sweeps, same-step score/fall, Reef projection/sensor invariance and safe spawn.
- Browser: built a 2600-mm forward test stack; observed movement left through the
  castle, score increments, water-fall termination and the result screen. Also
  exercised Stop, Get Certificate and Try Again. Retry cleared score/timer and
  restored the start. Certificate content was not independently rendered/inspected.
- Intentional expectation changes: motion tests now expect doubled speed;
  Castle interaction tests expect post-contact sliding; Reef projection tests use
  2000-mm scaling; its parity fixture locates coral on the actual field boundary.
  These changes accompany requested behavior changes, not fixes to incidental
  failures. Tests and implementation were left uncommitted together.

## Known work for the next agent

Start with [BLOCK-AUDIT.md](../BLOCK-AUDIT.md) and issue #5. Five `it.fails` cases
document zero velocity, heading re-zeroing, full revolutions, Castle position sensing
and Switch execution. They are expected failures, not working features. Remove
`.fails` only when the corresponding semantics are fixed.

Additional findings include continuous movement, Rover go-to, pen rendering,
event lifetime, motion queue cancellation, front/down eye semantics, variable
reporters and seeded random replay. Castle's runner now waits for queued motion
before natural-completion results; that does not fix all other async/event cases.

Priorities for further parity work: implement Castle sensing, validate debris
behavior against more reference runs, measure component weights/layout, and check
replay consistency across rendering rates. The current frame interpolation reduces
oversized shoves on slow frames; broad frame-rate invariance is not proven.
