# Target architecture

This is the **target** structure. Phase 1 landed `engine/` as pure TypeScript modules. The running app is still the `components/vex-workspace.tsx` monolith; `lib/robot-runtime.ts` re-exports the pieces that moved and keeps the pixel-based Ocean Reef helpers.

Field, economy, sensing, and block numbers live in [`ROVER-RESCUE-SPEC.md`](./ROVER-RESCUE-SPEC.md). This file is Part 2 of the build plan: the tree, the `PlaygroundDefinition` contract, and the five invariants. Do not widen the contract with Rover Rescue special cases.

## Why this split

Ocean Reef is a single-screen, fixed-field simulator. Rover Rescue is a large open world with an economy, a clock, and combat. The last row is the one that decides everything else — you cannot bolt a 12 m world onto a component that stores pose in canvas pixels.

| Concern | Ocean Reef today | Rover Rescue needs |
| --- | --- | --- |
| Field size | 2000 mm square, fits the canvas | 12000 × 6000 mm — 18× the area |
| Camera | none; canvas is the field | pan + zoom, world↔screen transform, follow-rover mode |
| Robot state | stored in canvas pixels, converted to mm for sensors | must be stored in world mm; pixels are a render detail |
| Entities | 12 trash items, one flat array | minerals, obstacles, 4 enemy types, base, river, bridges — needs a broadphase grid |
| Time | wall-clock animation only | a mission clock (50 in-game days), battery drain, a standby fast-forward mode |
| State | robot pose + score | battery, XP, level, absorb, capacity, storage, days, per-enemy HP/radiation |
| Sensors | bumper / distance / eye | AI detect (360°, 800 mm), AI sight (40° cone, 1000 mm) with per-object attribute reporting |
| Autonomy | none | `go to [minerals/enemy/base]` — pathfinding around obstacles and over bridges |
| Failure | hit coral → game over | battery reaches 0 → game over; river is a hazard; enemies attack |
| Code shape | `vex-workspace.tsx`, playground hard-wired into the editor | playground must be a swappable module |

That is why Phases 1–3 rewrite the host **before** any Rover Rescue code is written.

Current picker ids stay until Phase 3: `ocean-cleanup` is Ocean Reef, `rescue-rover` is Rover Rescue. Target ids are `ocean-reef` and `rover-rescue`.

## Target tree

```
app/
  layout.tsx  page.tsx  globals.css

engine/                        # pure TypeScript, no React, unit-testable
  units.ts                     # mm ↔ px, inches, angle normalisation
  camera.ts                    # pan/zoom, world↔screen, viewport culling
  world.ts                     # World, Entity, spatial hash grid
  motion.ts                    # drive/turn kinematics, velocity, timeout
  collision.ts                 # circle/polygon/polyline tests, point-in-zone
  sensors.ts                   # raycast, cone FOV, radial detect
  clock.ts                     # fixed-timestep tick, in-game time, fast-forward
  rng.ts                       # seeded PRNG (already have seededRandom)
  interpreter.ts               # AsyncFunction runner, ProgramStopped, event hats
  types.ts

playgrounds/
  registry.ts                  # id → PlaygroundDefinition
  ocean-reef/                  # existing playground, ported to the contract
    config.ts art.ts entities.ts blocks.ts api.ts render.ts index.ts
  rover-rescue/
    config.ts                  # every constant from ROVER-RESCUE-SPEC.md
    map-spec.ts                # zones, river, bridges, base, spawn tables
    entities/                  # mineral.ts enemy.ts obstacle.ts base.ts
    systems/                   # spawn.ts physics.ts enemy-ai.ts sensing.ts combat.ts
                               # battery.ts leveling.ts minerals.ts mission.ts navigation.ts
    art/                       # terrain.ts river.ts flora.ts rocks.ts rover.ts mineral.ts spider.ts serpent.ts base.ts
    render.ts                  # composes art/ through the camera
    blocks.ts                  # the 1:1 block definitions
    api.ts                     # robot.* implementations
    hud/                       # Battery.tsx Strength.tsx LevelBox.tsx Minimap.tsx MapView.tsx AIOverlay.tsx MissionDialog.tsx Stats.tsx
    index.ts

blocks/
  common/                      # drivetrain.ts logic.ts operators.ts console.ts control.ts events.ts
  fields/                      # angle-wheel.ts compass.ts distance-slider.ts
  registry.ts  toolbox.ts
  generators/                  # javascript.ts python.ts

components/
  workspace/                   # BlocklyEditor.tsx Toolbar.tsx CategoryRail.tsx Trashcan.tsx
  playground/                  # PlaygroundWindow.tsx PlaygroundCanvas.tsx ZoomControls.tsx Console.tsx
  ai-assistant/                # unchanged behaviour, extracted from the monolith
  ui/                          # shadcn primitives (unchanged)

collab/                        # existing use-blockly-collab.ts + overlay, untouched this cycle
scripts/                       # collab-server.mjs, geometry checks
tests/engine/                  # characterisation of today's robot-runtime.ts (this phase)
docs/
  ARCHITECTURE.md  ROVER-RESCUE-SPEC.md  phases/00..10.md
```

`app/` stays a static Next export. It does not learn about individual playgrounds.

## PlaygroundDefinition

Everything downstream depends on this interface being right. Define it in Phase 2 and do not let Rover Rescue widen it with special cases.

```ts
export interface PlaygroundDefinition<S = unknown> {
  id: string
  name: string
  world: {
    widthMm: number
    heightMm: number
    gridMm: number
    startPose: { xMm: number; yMm: number; headingDeg: number }
    camera: { minZoom: number; maxZoom: number; initialZoom: number; follow: boolean }
  }
  createState(seed: number): S
  reset(state: S, seed: number): S
  tick(state: S, dtMs: number, robot: RobotState): S      // pure; no React, no canvas
  render(ctx: CanvasRenderingContext2D, state: S, robot: RobotState, cam: Camera): void
  renderOverlay?(ctx: CanvasRenderingContext2D, state: S, robot: RobotState, cam: Camera): void
  blocks: BlockCategory[]                                  // block defs + toolbox entries
  createApi(deps: PlaygroundApiDeps<S>): Record<string, (...args: any[]) => unknown>
  hud?: React.ComponentType<{ state: S; robot: RobotState }>
  isMissionOver(state: S): { over: boolean; reason?: string; won?: boolean }
}
```

The host looks up a definition by id, calls `createState` / `createApi`, injects that API into the generated program, and asks the definition to `tick` and `render`. Ocean Reef can set `follow: false` and a zoom that fits the 2000 mm field. Rover Rescue uses pan/zoom with follow-rover over the 12000 × 6000 mm field.

`tick` returns the next state. It does not mutate React state or touch a canvas. `standby` is many `tick` steps without `render`.

## Five invariants

These are merge gates. A change that breaks one is incomplete.

1. **All simulation state is in world millimetres.** Pixels exist only inside `engine/camera.ts` and the render functions. This is the single biggest change from the current code, which stores pose in canvas pixels and converts to mm for sensors.

2. **`tick()` is pure and framerate-independent.** Fixed 16.67 ms steps accumulated from `requestAnimationFrame`; a slow frame runs multiple steps. `standby` just runs many steps without rendering.

3. **The engine never imports React, and playground modules never import `components/`.** HUD components live under the playground's `hud/` and are passed in through `PlaygroundDefinition.hud`. Engine code stays unit-testable in Node.

4. **Block definition, JS generator, and Python generator for a block live together in one file**, so adding a block is one edit, not three.

5. **Ocean Reef must keep working identically through Phases 1–3.** It is the regression test. Characterisation in `tests/engine/` describes today's `lib/robot-runtime.ts` behaviour, including the oddities below. Phases 1–3 may move code. They must not change those assertions. If a later phase *intends* to fix an oddity, it updates the test and this list in the same change.

## Phase map (not this change)

| Phase | Intent |
| --- | --- |
| 0 (this) | Docs, Vitest, characterisation tests, CI. No refactor. |
| 1 | Move shared math from `lib/robot-runtime.ts` into `engine/` without behaviour change. |
| 2 | Define `PlaygroundDefinition` and extract Ocean Reef as the first implementation. |
| 3 | Thin the monolith into `components/workspace` + `components/playground` that swap definitions. |
| 4+ | Implement Rover Rescue against [`ROVER-RESCUE-SPEC.md`](./ROVER-RESCUE-SPEC.md). Phase 4 includes a zone-vertex debug overlay. |

## Known oddities (current Ocean Reef code)

Characterisation tests lock these in. They look wrong next to official VEX docs; they are what `lib/robot-runtime.ts` does today.

- **Field +Y is canvas-down.** `fieldMmToPixel` adds field-Y to canvas-Y, so positive field millimetres move toward the bottom of the window. Official VEX +Y is north. Ocean Reef's start `{ x: 0, y: -800 }` therefore sits *above* the canvas centre, even though the status bar reports Y as −800. The rewrite stores pose in world mm with +Y north; only the camera inverts Y.
- **`pixelToFieldMm` rounds.** The inverse snaps to integer millimetres. A pixel that is not an exact millimetre multiple does not round-trip through `fieldMmToPixel`.
- **Three different “edge” margins.** `clampRobotPosition` and `maxDriveDistanceMm` default to 35 px. `raycastToBorder` hard-codes 20 px. Trash placement uses 55 px. The hull never shares one inset with the distance sensor.
- **`raycastToBorder` caps at 2000 mm by default**, not `DISTANCE_SENSOR_MAX_MM` (3000).
- **Unit strings are not VEX constants.** Only `"inches"` and `"INCHES"` convert as inches. `"INCH"`, `"in"`, `"MM"`, and anything else are treated as millimetres.
- **Velocity is clamped to 5–100.** `driveDurationMs` and `turnDurationMs` raise 0% to 5% and drop values above 100%. Both also floor duration at 80 ms.
- **Raycasts step 2 px.** `maxDriveDistanceMm` and `raycastToBorder` can report a hit up to almost 2 px past the real edge or coral surface.
- **“In front” is a half-plane, not a cone.** `nearestTrashInFrontMm` keeps anything with a non-negative forward dot product. Official Rover Rescue vision is a 40° cone; Ocean Reef does not implement that.
- **Front eye vs down eye.** `isTrashNearEye("front")` uses the 22 px eye offset and the half-plane. `"down"` uses omnidirectional distance from the robot centre.
- **Trash range is edge-to-edge.** Both nearest-trash helpers subtract `TRASH_HIT_RADIUS_PX` (20) before converting to millimetres, and clamp that to ≥ 0. A robot sitting on a sprite reports 0 mm, not a negative.
- **`createInitialTrashItems` can return fewer than `count`.** Placement gives up after `count * 50` attempts. Items that land on coral (28 px margin) or within 70 px of the spawn point are skipped.
- **`forEachProgramBlock` skips the `when_started` hat.** A workspace that is only the hat visits nothing, so a bare hat is an empty program. Nested mouths still walk `DO` / `DO1` / `DO2` / `ELSE`.
- **`generateWhenStartedJavaScript` wraps extra hats in `Promise.all`.** Disabled hats are dropped. Empty bodies are dropped. One non-empty body is emitted raw; two or more become concurrent async IIFEs.
- **`seededRandom` is `sin(seed * 9999)` fractional part.** It is deterministic and SSR-safe. It is not a stepped PRNG; the same seed always returns the same value.
- **`normalizeDegrees(-360)` is `-0`.** In JavaScript `-360 % 360` is `-0`, and `-0 < 0` is false, so the wrap-around branch does not run. Callers that use `Object.is` or serialise the value will see a signed zero.

## Current mapping (phase 0)

| Target | Today |
| --- | --- |
| `engine/*` | implemented; Ocean Reef still talks to it through `lib/robot-runtime.ts` shims |
| `playgrounds/ocean-reef/*` | inlined in `components/vex-workspace.tsx` |
| `playgrounds/registry.ts` | `PlaygroundId` union (`ocean-cleanup` / `rescue-rover` / `castle-crashers`) |
| `blocks/` | `define*Blocks` functions in that component + `lib/python-generator.ts` |
| `components/workspace` + `playground` | the same monolith |
| characterisation suite | `tests/engine/*.test.ts` (this phase) |
