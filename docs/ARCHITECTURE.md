# Current architecture

Last reconciled with the working tree: 2026-09-22. This describes the implementation,
including local Castle gameplay changes, not a planned end state. See the
[documentation index](README.md), [change history](CHANGELOG.md), and
[archived original plan](history/ARCHITECTURE-original-plan.md).

## Module map

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | Static Next.js page rendering `VexWorkbench` |
| `components/workspace/VexWorkbench.tsx` | Client host composing editor, session, runner, playground windows and outcome UI |
| `components/workspace/BlocklyEditor.tsx`, `use-blockly-workspace.ts` | Blockly workspace lifecycle and block editing |
| `components/playground/` | Shared window, controls, picker and readouts |
| `hooks/usePlaygroundSession.ts` | Active playground, robot pose, separate playground state refs, camera/window state and reset/spawn helpers |
| `hooks/useProgramRunner.ts` | Start/Step/Stop/Reset, generated JavaScript execution, event watcher lifecycle and run state |
| `hooks/program-robot-api.ts` | `robot.*` API injected into programs; motion queue, runtime settings, console, variables, broadcasts and playground API delegation |
| `hooks/useRobotAnimation.ts`, `playground-motion.ts` | Animated host pose, movement targets, direction conventions and collision constraints |
| `hooks/usePlaygroundDraw.ts` | Playground-specific simulation/render integration and mission callbacks |
| `hooks/usePlaygroundMission.ts` | Ocean Reef mission handling; other playgrounds have separate outcome paths |
| `engine/` | Pure TypeScript units, motion timing, geometry, camera, sensors, clock, seeded RNG and interpreter utilities |
| `playgrounds/types.ts`, `registry.ts` | Authoritative playground contract, registered definitions and legacy ID aliases |
| `playgrounds/ocean-reef/` | Coral/trash state, legacy sensor adapters, collection, collision and canvas art |
| `playgrounds/rover-rescue/` | Map, terrain, entities, battery/minerals/combat/AI systems, sensors, mission and HUD |
| `playgrounds/castle-crashers/` | Hex field, component layout/state, debris physics, scoring, canvas art, HUD and results |
| `blocks/common/`, `blocks/registry.ts`, `blocks/toolbox.ts` | Common definitions, generators and category installation |
| `blocks/fields/`, `blocks/generators/` | Custom field editors and Python program generation |
| `lib/robot-runtime.ts`, `lib/python-generator.ts` | Compatibility helpers/re-exports; legacy Reef pixel helpers remain here |
| `lib/use-blockly-collab.ts`, `scripts/collab-server.mjs` | Client block/cursor synchronization and separate WebSocket relay |
| `lib/session-log.ts`, `telemetry/` | Local session events, research identity and event emission; schema in `LOGGING-SPEC.md` |
| `tests/` | Vitest engine, playground, block, host and telemetry checks |

## Program execution and state flow

1. `app/page.tsx` mounts `VexWorkbench`. The session resolves a registry ID from
   the picker or `?playground=...` and applies its `world.startPose`.
2. The editor installs common blocks plus the active definition's categories.
   `generateWhenStartedJavaScript` collects enabled started stacks; multiple stacks
   use concurrent async functions. Python generation is a separate display/export path.
3. The runner initializes runtime settings and pose, generates JavaScript, creates
   the host `robot.*` API and executes it using `AsyncFunction`. Step mode gates
   individual statements. Bumper and Rover event hats are polled separately.
4. Host drive/turn methods queue motion and update a shared pose ref plus React
   state through `useRobotAnimation`. Playground API methods read the relevant
   world state. Castle must receive `castleStateRef`; do not fall back to Reef state.
5. `usePlaygroundDraw` ticks and paints the active world and sends mission callbacks
   to the host. UI snapshots and mutable refs are both used; avoid replacing a live
   ref with stale React state when wiring reset or lifecycle changes.
6. Stop cancels active animation and requests program unwinding. The correct
   playground's `markStoppedByUser` records a user stop. Castle waits for queued
   motion before displaying natural-completion results. Remaining async/event
   lifetime problems are listed in [the audit](BLOCK-AUDIT.md).

The shared contract supports creation/reset, tick/render, block installation, API
creation, outcomes and telemetry adapters. Use [the actual interface](../playgrounds/types.ts)
instead of copying it into a feature-specific contract. The host still contains
playground-specific branches: the generic interface does not mean every lifecycle
is fully abstracted or every registered API is implemented.

## Coordinates, scale and clocks

| Playground | Physical dimensions | Coordinate/render details |
| --- | --- | --- |
| Ocean Reef | 2000 × 2000 mm | Historical +Y-down remains. Projection uses canvas size; enlarging the window does not enlarge the world. Sensor adapters project into a separate fixed-scale virtual canvas. |
| Rover Rescue | 12000 × 6000 mm | Engine +Y north, camera inverts screen Y; fit/pan/zoom/follow are presentation operations. |
| Castle Crasher+ | 3288-mm vertex-to-vertex hex diameter | Engine +Y north; start `(1014, 50)` facing left at -90°. `FIELD_WIDTH_MM`/`FIELD_HEIGHT_MM` include water padding for camera framing; they are not the island diameter. |

Robot/world positions are in millimetres; inches convert at 25.4 mm/inch. Legacy
Reef pen trails and some sensor/art helpers still use pixels, so this is not a fully
pixel-free host. Do not feed an engine mm duration into the legacy pixel-taking
`lib/robot-runtime.ts` wrapper without conversion.

Shared motion constants are 5 ms/mm and 11 ms/degree at 50% velocity, changed from
10 and 22 on 2026-09-22. This affects all playgrounds, not just Castle. The 80-ms
minimum duration remains for finite moves. Zero velocity gives zero speed and infinite
duration for nonzero moves, so animation stays at the starting pose until canceled.
Physical rotation is unwrapped to preserve full revolutions. Drivetrain heading and
rotation setters change independent per-run reference offsets; GPS remains physical.

Castle accumulates fixed 60-Hz simulation steps with `SimulationClock`; the host
interpolates sampled robot movement across steps. The Castle loop continues when
its window is hidden/minimized. Rover's host currently passes bounded render-frame
deltas to `tickRoverRescue`; standby owns its own advancement. Ocean uses its legacy
animation/mission paths. Fixed-step simulation everywhere is a design goal, not an
established property of all current host paths.

## Castle lifecycle and extension points

- `config.ts`: documented field/start values and tunable contact, debris, scoring,
  splash and results-delay constants. Keep these categories distinguishable.
- `layout.ts`: approximate component positions, dimensions and levels; Basic has
  no trees, Advanced adds immovable trees. Layout is not an official measured mesh.
- `state.ts`: component position/orientation, velocities, topple/cleared flags,
  clearing timestamps, kilograms, mission/display clocks and outcome reason.
- `systems/physics.ts`: pushes and secondary contacts, friction/spin, plow pickup,
  fixed-obstacle sweep, water-fall detection and one-time score increments.
- `art/`, `render.ts`: original canvas artwork, toppled pieces and splash ripples.
  The result phase shows the water background instead of the island.
- `hud.tsx`, `results.tsx`: live kilograms/time, delayed result card, retry and a
  downloadable SVG certificate. Retry resets the world and robot; it does not erase
  the learner's blocks. Certificate graphics are original prototype artwork.

Water, user stop and natural program completion are separate reasons. Debris can
settle briefly after mission end; the mission timer stops while the display clock
continues. Score is counted only once per cleared component, including a component
that crosses the edge on the same step as the robot. Piece masses and physics are
approximations, not validated 3D or score parity. Castle exposes X/Y GPS and position angle in Sensing; other Castle sensors remain unimplemented.

## Learner planning and Switch code

`AIAssistant` owns a session-local plan cycle outside the conditional sidebar/menu.
`plan-cycle.ts` holds draw → build → running → review transitions; `plan-panel.tsx`
shows a playground map and accepts blue drawing strokes in fixed canvas coordinates.
The host supplies `isRunning` and actual robot positions in world mm. Running samples
(at least 2 mm apart) become an orange dashed path projected by the same camera.
Closing Help preserves recording. Completion reopens Plan with the comparison and a
new-plan action. Reset is excluded from travelled paths. Selecting another playground
remounts the assistant; a page reload also discards plans. No persistence or telemetry
schema changes were introduced. Castle previews use a fresh layout at the selected
level so the castle remains visible after the results screen replaces the live scene.

`engine/switch-python.ts` is an explicit VEX Python command adapter. The Switch block
passes its text to `robot.runSwitchCode`; the adapter validates the entire block before
execution and generates calls to the existing host API. It supports literal command
arguments, constants, and four-space-indented `for … in range(integer)` repeats. Loop
iterations yield so Stop can interrupt them. It rejects unsupported Python with line
numbers; it is not a general Python runtime. See the dated change record for syntax
and inherited drivetrain limitations.

## Compatibility and maintenance boundaries

- Keep `engine/` free of React/DOM dependencies. Playground modules should not
  import the host's `components/` or `app/` directories.
- Preserve `pg_*` block identifiers, saved-workspace migration and the logging
  schema, including external spellings such as `CasteCrasherPlus` and
  `enemies_nuetralized`. Put INVITE additions under `_invite`.
- Prefer seeded RNG for simulation/replay. The random operator and some historical
  visual helpers have separate behavior; do not claim universal deterministic replay.
- Keep block definitions and their JavaScript/Python generators together where
  the current module organization permits. Verify both generation and runtime
  semantics; a generated block that does not throw can still do nothing.
- Preserve historical records. Update this page for current behavior, and add a
  dated record describing why behavior changed and what was tested.

## Build and validation

Next.js static export (`next.config.mjs`) writes `out/`. GitHub Pages builds use a
base path. Collaboration requires the separate Node WebSocket process; it is not
included in the static export. See [local commands](README.md#local-development)
and [CI](../.github/workflows/ci.yml).

The 2026-09-22 gameplay validation recorded 321 passing tests and 5 expected failures
across 49 files, plus a passing lint/typecheck/build and manual Castle browser flows.
This is a historical checkpoint, not a guarantee about a future checkout. Known
failures are tracked in [issue #5](https://github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/5).
