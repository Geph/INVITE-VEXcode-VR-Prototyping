# Block functionality audit — 2026-09-22

Tracked in [GitHub issue #5](https://github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/5).
See the [implementation record](changes/2026-09-22-castle-gameplay.md) for changes
made alongside this audit and their validation limits.

Scope: common block definitions and JavaScript/Python generators, program scheduling,
and the Ocean Reef, Rover Rescue, and Castle Crasher+ runtime APIs. The existing
generator smoke suite now includes Castle. Smoke execution checks wiring; it does
not prove that each command behaves like VEX. The five original expected-failure
cases are now ordinary passing regressions. See the [repair and planning record](changes/2026-09-22-plan-cycle-and-block-fixes.md).

## Repairs after the original audit

- 0% drive/turn velocity now gives zero speed. Nonzero moves at zero speed wait
  without movement until canceled (drive also honors its configured timeout).
- Relative turns preserve direction and all revolutions; turn-to-rotation uses an
  accumulated, unwrapped angle. Turn-to-heading still takes the shortest route.
- Setting heading/rotation changes the corresponding reference offset, not the
  physical pose. GPS orientation remains physical and independent of these offsets.
- Castle X/Y position and position angle work and are exposed in Sensing. Distances
  support mm/inches. Other Castle sensors remain unresolved below.
- Switch now executes a documented subset of VEX Python calls and constant-count
  repeat loops. Unsupported syntax produces an explicit line-numbered error.
  This is **not full Python support**; see limitations below.

## Confirmed unresolved findings

| Priority | Blocks / area | Reproduction and observed behavior | Expected behavior / code evidence |
| --- | --- | --- | --- |
| High | `pg_drivetrain_drive`, `pg_drivetrain_turn` | Run `drive forward → wait 2 seconds → stop driving`. Drive completes a fixed 200 mm before the wait. Plain turn similarly waits for a fixed 90°. | Continuous, non-waiting movement until superseded/stopped. Defaults and generators in `hooks/program-robot-api.ts` and `blocks/common/drivetrain.ts` make these finite and awaited. |
| High | `pg_drivetrain_go_to_object` (Rover) | Select Rover, run `go to minerals` with a mineral visible: there is no movement. | Navigate to the selected target. `playgrounds/rover-rescue/api.ts` has an empty `async goToObject` body. |
| High | Remaining Castle sensors | Position and position angle are repaired. Imported distance, bumper, eye and magnet blocks still lack Castle implementations. | Implement world-specific sensors against pieces, trees, border and water. Do not infer these readings from GPS. |
| High | Drawing / pen (Castle and Rover) | Put pen down, drive, and change pen color: no trail appears in these playgrounds. | Render the pen trail in the active world's coordinates. `hooks/useRobotAnimation.ts` excludes Rover trail recording and records Castle in Reef pixel coordinates; Castle/Rover render paths do not consume the trail. |
| Medium | Switch Python coverage | Drivetrain/wait/console/pen calls with literal arguments and constant-count repeat loops execute. Imports, variables, expressions, sensors, arbitrary Python control flow and libraries are rejected visibly. Plain drive/turn inherit the finite-motion limitation above. | A complete VEX Python interpreter/API integration is future work. Supported syntax is explicit in `engine/switch-python.ts` and the tooltip. |
| High | Event hats and asynchronous command lifetime | Use a bumper/under-attack/level-up hat without a long-running started stack. Watchers are created and immediately removed when the main body finishes. A trailing non-waiting motion/broadcast can outlive the main body and its running indicator. | Keep event/async execution alive until all active work ends or the user stops. `hooks/useProgramRunner.ts` unconditionally tears down watchers in `finally`; broadcast promises are not joined. |
| Medium | `drive is done?`, stop driving, timeout | During `turn to heading` or `turn to rotation`, `driveIsDone()` can return true because those methods do not increment `outstandingMotion`. Stop Driving cancels only the active animation, allowing previously queued motions to run afterward. Timeout is applied only to `drive()`. | Track/cancel all drivetrain work consistently and apply drivetrain timeout to turns. `hooks/program-robot-api.ts`. |
| Medium | Ocean front/down eye color and brightness | Place colored trash beside/behind the robot, then compare front and down color/brightness readings: both use the same robot-center neighborhood. | Respect selected sensor location/direction. `eyeDetectsColor(_sensor, ...)` and `eyeBrightness(_sensor)` ignore the sensor argument in `playgrounds/ocean-reef/api.ts`. |
| Medium | Variables palette | Set `item` to 1, then try using `item` in a print or condition: there is no variable reporter in the category. | Supply a read reporter and usable variable lifecycle. `blocks/common/variables.ts` registers only set-variable, despite an existing runtime `getVariable()`. |
| Medium | Ocean direction convention | At heading 0, a forward drive decreases reported Y; start `(0,-800)` appears above the center. | Standard VEX north is +Y. Ocean deliberately retains historical canvas-down Y (`applyDrive`, `reefWorldToScreen`, `isEngineNorthPlayground`), unlike Castle/Rover. Migrate coordinates and saved projects together. |
| Research | Random operator | Run the same seed/project twice with random blocks: output is not reproducible. | Seeded replay where research sessions require it. `pg_operator_random` emits `Math.random()`, bypassing `engine/rng.ts`; Python uses a separate unseeded random generator. |

## What passed / limits

Castle now waits for its queued motion before showing natural-completion results.
The event/broadcast lifetime finding above remains unresolved; finite-main-stack
behavior in other playgrounds also still needs attention.

- Registered JavaScript generator/API smoke execution across all three playgrounds.
- Existing math/text/logic, Python generation, variable assignment, console output,
  broadcast delivery, simulation and sensor tests. These are representative inputs,
  not an exhaustive numeric or concurrency conformance suite.
- New regression tests cover Castle start heading, mm/inch movement, water crossing,
  fixed-obstacle sweeps, same-step scoring/fall, stop-project state ownership, and
  Reef world size/sensor scale across normal and maximized windows.
- All five original expected-failure tests now pass normally; additional regressions
  cover reference offsets, multi-turn rotation, executable Switch code and rejection
  of unsupported syntax. This does not close the remaining findings above.
- Trigonometry and numeric edge cases need an additional official-VR conformance
  pass; this audit does not assert degree/radian parity based on another VEX platform.

## Changes made with this audit

Drive/turn timing is twice as fast. Start/Reset preserve the playground start heading.
Castle can fall into water; its actual hex diameter stays 3288 mm. Reef projection
now uses a fixed 2000-mm field at both window sizes, and its sensor calculation uses
a separate fixed-scale projection. Rover already uses a 12000 × 6000-mm world.
Castle gains debris momentum/secondary contact, immovable obstacle sweeps, one-time
whole-kg scoring, a settling interval, splash ripples and a result/certificate/retry UI.

The supplied 19.9-second video shows a final **1850 kg** score. It does not establish
per-piece masses. Our `PIECE_WEIGHT_KG` table and physics coefficients are explicitly
TUNABLE approximations; exact replay score and 3D physics parity are not claimed.
The video is kept outside the repository.

## References

- [Official VR drivetrain behavior](https://api.vex.com/vr/home/blocks/drivetrain.html)
- [Castle Crasher+ dimensions, start, levels and certificate](https://api.vex.com/vr/home/playgrounds/castle_crasher_plus.html)
- User-provided Castle Crashers gameplay video, reviewed at one-second intervals.
