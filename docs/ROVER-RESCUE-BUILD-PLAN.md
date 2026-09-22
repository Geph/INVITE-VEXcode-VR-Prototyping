# Rover Rescue (2D) — Build Plan & Cursor Prompt Pack

**Target repo:** `Geph/INVITE-VEXcode-VR-Prototyping`, branching from `Mars-Rover`
**Goal:** a purely 2D, pan/zoom clone of the VEXcode VR *Rover Rescue* playground, sitting inside a modular rewrite of the existing Blockly environment, ready for later multiplayer co-editing and learner-model instrumentation.

**Decisions locked for this plan**

| Decision | Choice |
|---|---|
| Architecture | Full rewrite into modular components (`engine/`, `playgrounds/`, `blocks/`, `components/`) |
| Block fidelity | 1:1 with VEX's published VR Rover block list |
| Rendering | Procedural canvas art driven by a data map spec (same spirit as `lib/reef-art.ts`) |
| Multiplayer / telemetry seams | Not designed in now — deferred to a later phase |

---

## Part 1 — What we are actually cloning

### 1.1 The gap between what you have and what Rover Rescue needs

Your current build is a **single-screen, fixed-field simulator**. Rover Rescue is a **large open world with an economy, a clock, and combat**. The specific structural gaps:

| Concern | Ocean Reef today | Rover Rescue needs |
|---|---|---|
| Field size | 2000 mm square, fits the canvas | 12000 × 6000 mm — 18× the area |
| Camera | none; canvas *is* the field | pan + zoom, world↔screen transform, follow-rover mode |
| Robot state | stored in **canvas pixels**, converted to mm for sensors | must be stored in **world mm**; pixels are a render detail |
| Entities | 12 trash items, one flat array | minerals, obstacles, 4 enemy types, base, river, bridges — needs a broadphase grid |
| Time | wall-clock animation only | a **mission clock** (50 in-game days), battery drain, a `standby` fast-forward mode |
| State | robot pose + score | battery, XP, level, absorb, capacity, storage, days, per-enemy HP/radiation |
| Sensors | bumper / distance / eye | AI *detect* (360°, 800 mm), AI *sight* (40° cone, 1000 mm) with per-object attribute reporting |
| Autonomy | none | `go to [minerals/enemy/base]` — a pathfinding block that must route around obstacles and over bridges |
| Failure | hit coral → game over | battery reaches 0 → game over; river is a hazard; enemies attack |
| Code shape | `components/vex-workspace.tsx`, 5,619 lines, playground hard-wired into the editor component | playground must be a swappable module |

The last row is the one that decides everything else. Right now the Blockly editor, the block definitions, the robot API, the physics, the art, and the HUD all live in one React function component, and robot position is kept in pixels relative to a canvas whose size depends on whether the window is maximized. You cannot bolt a 12 m world onto that — which is why Phase 1–3 below are a rewrite before any Rover Rescue code is written.

### 1.2 Field specification

Sources: *VEXcode VR Rover Rescue Documentation* (28 Aug 2025) pp. 33–36, 39–52, and `api.vex.com/vr/home/playgrounds/rover_rescue/field_details.html`.

```
Field:        12000 mm (X) × 6000 mm (Y)
X range:      -6000 … +6000     (west → east)
Y range:      -3000 … +3000     (south → north; canvas Y is inverted)
Origin (0,0): centre of the playable rectangle, near the river in Zone A
Grid:         500 mm squares → 24 × 12 cells
Base:         nominal (-6000, -3000), SW corner; pad drawn at ≈ (-5750, -2650)
Rover start:  at the Base
Rover size:   191 mm long × 147 mm wide
Heading:      0–359.9°, clockwise positive, 0° = North
```

### 1.3 Zones

Each zone changes **which enemies spawn** and **whether minerals respawn**. Enemy strength also scales with distance from the Base, independently of zone.

| Zone | Colour on ref map | Enemies | Mineral respawn |
|---|---|---|---|
| A | blue | Alien Spiders | never |
| B | grey | Alien Spiders | never |
| C | orange | Spiders + **orange** Serpents | yes |
| D | red | Spiders + **blue** Serpents | more frequent |
| E | purple | Spiders + **purple** Serpents | most frequent |

**Zone polygons — traced draft.** These were measured off the reference zone map by pixel-tracing the playable dotted rectangle and converting to world mm. Treat them as a *starting draft to tune visually*, not as ground truth. Phase 4 includes a debug overlay so you can drag vertices and re-export.

```ts
// world mm, +Y = north. Zones are painted in this order (later wins on overlap).
ZONE_B_WEST: [[-6000,-2800],[-6000,1000],[-4200,1100],[-3000,600],[-1400,-500],
              [-3000,-1200],[-4600,-1700],[-6000,-1950]]
ZONE_B_EAST: [[1500,-3000],[5900,-3000],[5900,300],[2000,300],[1200,-1900]]
ZONE_A:      [[-5930,-2790],[-5930,-1960],[-4620,-1700],[-3020,-1170],[-1420,-490],
              [-40,220],[620,120],[840,-1240],[690,-2380],[470,-2790]]
ZONE_C:      [[-2440,3000],[3530,3000],[3530,480],[5850,480],[5850,-1240],
              [2070,-1240],[2070,620],[-2440,480]]
ZONE_D:      [[2900,480],[6000,480],[6000,3000],[2900,3000]]
ZONE_E:      [[4250,1700],[6000,1700],[6000,3000],[4250,3000]]
```

### 1.4 River and bridges

The river is **impassable** — entering it ends the mission. It enters from the northwest, runs east across the north of the map, turns south around X ≈ +900, and exits to the southeast. Width ≈ 700–900 mm.

```ts
RIVER_CENTERLINE: [[-6000,1410],[-4760,1200],[-3310,980],[-2000,1200],[-840,980],
                   [330,770],[910,190],[1060,-950],[1200,-1950],[1490,-2670],[2200,-3000]]
RIVER_WIDTH_MM: 800

BRIDGES: [
  { id:"north", centre:[-3500,1240], orientation:"NS", widthMm:700, lengthMm:1400 },
  { id:"south", centre:[ 1130,-1880], orientation:"EW", widthMm:700, lengthMm:1400 },
]
```
Bridge decks are walkable strips that punch a hole in the river's hazard polygon. Any navigation code (`go to`) must route through them.

### 1.5 Economy, levels and combat

```
XP awards          use a mineral                    2 XP
                   return a mineral to Base         5 XP
                   neutralize Alien Spider          5 XP
                   neutralize orange/blue Serpent  10 XP
                   neutralize purple Serpent       15 XP

Level thresholds   L1  0 XP   L2  10 XP   L3  30 XP   L4  70 XP   L5  125 XP
Starting stats     Absorb 10 %   Capacity 2 minerals   Battery 100 %
Per-level growth   Absorb and Capacity both rise each level (values not published —
                   suggested: Absorb 10/20/35/55/80 %, Capacity 2/3/4/6/8; tune in playtest)

Battery            drains continuously with time and movement; 0 % → mission over
                   using a mineral → 100 % instantly
                   absorbing radiation → + (absorb % × enemy radiation)

Mission            50 in-game days, then a dialog: Continue | View Statistics | Get Certificate
                   Continue re-irradiates every previously neutralized enemy
standby            fast-forwards the clock until battery falls to the given %
```

### 1.6 Sensing

```
AI detect   360°, radius  800 mm  — minerals and enemies only, boolean
AI sight     40° cone, range 1000 mm — minerals, enemies, obstacles, hazards, Base
            reports name + distance + angle; for enemies also level and health points
Distance    forward sensor, max 2000 mm
Location    reports rover (X,Y) in mm
```

### 1.7 The block set — 1:1 with VEX

Source: `api.vex.com/vr/home/robots/rover/robot_specific_blocks.html`.
**Bold = new work.** The rest already exist in some form in `vex-workspace.tsx`.

**Drivetrain — actions**
`drive [forward▾]` · `drive [forward▾] for (200) [mm▾]` · `turn [right▾]` · `turn [right▾] for (90) degrees` · `turn to heading (90) degrees` · `stop driving` · **`go to [minerals▾]`** (options: minerals / enemy / base)

**Drivetrain — settings**
`set drive velocity (50) [%▾]` · `set turn velocity (50) [%▾]` · `set drive heading (0) degrees` · `set drive timeout (1) seconds`

**Drivetrain — values**
`drive is done?` · `drive is moving?` · `drive heading`

**Minerals & resources**
**`minerals action [pick up▾]`** (pick up / drop / use) · **`absorb radiation`** · **`standby until (50) % battery`**

**Rover sensing — values**
**`rover sees [minerals▾]?`** · **`rover detects [minerals▾]?`** · **`minerals in storage`** · **`storage capacity`** · **`rover direction [minerals▾]`** · **`rover distance [minerals▾] in [mm▾]`** · **`rover location [minerals▾] [X▾]`** · **`under attack?`** · **`enemy level`** · **`enemy radiation`** · **`battery level`** · **`level`** · **`XP`**

**Rover events (hat blocks)**
**`when under attack`** · **`when level up`**

**Distance sensor**
`distance found object?` · `object distance in [mm▾]`

Plus the shared Logic / Operators / Console / Control categories you already have.

---

## Part 2 — Target architecture

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
    config.ts                  # every constant from Part 1
    map-spec.ts                # zones, river, bridges, base, spawn tables
    entities/                  # mineral.ts enemy.ts obstacle.ts base.ts
    systems/                   # spawn.ts physics.ts enemy-ai.ts sensing.ts combat.ts
                               # battery.ts leveling.ts minerals.ts mission.ts navigation.ts
    art/                       # terrain.ts river.ts flora.ts rocks.ts rover.ts mineral.ts spider.ts serpent.ts base.ts
    render.ts                  # composes art/ through the camera
    blocks.ts                  # the 1:1 block definitions above
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
scripts/                       # collab-server.mjs, geometry checks, new engine tests
docs/
  ARCHITECTURE.md  ROVER-RESCUE-SPEC.md  phases/00..10.md
```

### The playground contract

Everything downstream depends on this interface being right. Define it in Phase 2 and do not let Rover Rescue widen it with special cases:

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

### Non-negotiable invariants

1. **All simulation state is in world millimetres.** Pixels exist only inside `camera.ts` and the render functions. This is the single biggest change from the current code.
2. **`tick()` is pure and framerate-independent.** Fixed 16.67 ms steps accumulated from `requestAnimationFrame`; a slow frame runs multiple steps. `standby` just runs many steps without rendering.
3. **The engine never imports React**, and playground modules never import `components/`.
4. **Block definition, JS generator, and Python generator for a block live together** in one file, so adding a block is one edit, not three.
5. **Ocean Reef must keep working identically** through Phases 1–3. It is your regression test.

---

## Part 3 — Phased plan

| Phase | Deliverable | Risk | Rough size |
|---|---|---|---|
| 0 | Branch, docs, test harness, behaviour snapshot | low | small |
| 1 | `engine/` extracted, unit-tested | low | medium |
| 2 | Playground contract + registry; Ocean Reef ported | medium | medium |
| 3 | React monolith decomposed | **high** | large |
| 4 | Rover Rescue world, terrain, camera, drivable rover | medium | large |
| 5 | Entities, zones, spawning, hazards | medium | large |
| 6 | Sensing + AI visualisation + minimap | medium | medium |
| 7 | Game systems: battery, XP, levels, combat, minerals, mission clock | medium | large |
| 8 | `go to` navigation block | **high** | medium |
| 9 | HUD, map views, mission-end flow, statistics | low | medium |
| 10 | Python generator, example projects, docs | low | small |

Phases 1–3 are pure refactor with **zero** Rover Rescue code. Resist the urge to merge them with Phase 4 — the whole point of choosing the full rewrite is that the seams exist before the complex playground lands.

---

## Part 4 — Cursor prompt pack

### How to run these

1. Put this file in the repo at `docs/ROVER-RESCUE-BUILD-PLAN.md` and commit it. Cursor's agent reads it as context.
2. Create `.cursor/rules/project.mdc` with the house rules (draft in Part 5) so you do not restate them in every prompt.
3. **One phase per branch, one PR per phase.** `git checkout -b rr/phase-4-world` etc.
4. For each phase: open Cursor's agent in **Plan** mode first, paste the prompt, let it produce a plan, review the file list, *then* let it execute. Composer/agent one-shotting a large phase without a plan is where these go wrong.
5. After each phase run `npm run lint && npm run typecheck && npm test && npm run build` before merging. Every prompt below ends by requiring this.
6. If a phase's diff exceeds ~1,500 lines, stop and split it. Ask Cursor: *"Split this phase into two PRs and give me the file list for each."*

---

### Phase 0 — Baseline, guardrails, and the spec in the repo

```
We are rewriting this project from a single 5,600-line component into a modular
engine + playground architecture, then adding a second playground (VEXcode VR
"Rover Rescue") as a 2D pan/zoom world. This phase does no refactoring — it only
sets up the guardrails.

Tasks:
1. Create docs/ARCHITECTURE.md describing the TARGET structure exactly as laid out
   in docs/ROVER-RESCUE-BUILD-PLAN.md Part 2, including the PlaygroundDefinition
   interface and the five invariants. Do not implement anything yet.
2. Copy the Rover Rescue field/economy/sensing/block spec from Part 1 of the build
   plan into docs/ROVER-RESCUE-SPEC.md as the single source of truth for constants.
3. Set up a real test runner. Add vitest + @vitest/coverage-v8 as devDependencies,
   a vitest.config.ts with a node environment, and scripts:
     "test": "vitest run", "test:watch": "vitest"
   Port scripts/check-bumper-geometry.mjs into tests/engine/bumper-geometry.test.ts
   so `npm test` still covers what it covered.
4. Write characterisation tests for the CURRENT behaviour of lib/robot-runtime.ts —
   at minimum: clampRobotPosition, distanceToPixels/pixelsToDistance round-trips,
   normalizeDegrees, shortestRotationDelta, driveDurationMs, turnDurationMs,
   fieldMmToPixel/pixelToFieldMm round-trips, raycastToBorder, pointHitsCoral,
   nearestTrashInFrontMm. These lock in Ocean Reef behaviour so the refactor in
   Phases 1-3 cannot silently change it. Aim for >80% line coverage of that file.
5. Add a GitHub Actions step running the new test suite in .github/workflows/ci.yml.

Constraints:
- Do not modify components/vex-workspace.tsx, app/, or any lib/ implementation.
- Tests must describe what the code does today, even where that looks wrong. If
  you find behaviour that looks like a bug, add a test asserting current behaviour
  and list it under "Known oddities" in docs/ARCHITECTURE.md.

Done when: npm run lint && npm run typecheck && npm test && npm run build all pass,
and the app behaves exactly as before.
```

---

### Phase 1 — Extract the engine

```
Extract playground-agnostic simulation logic out of lib/ into a new engine/
directory of pure TypeScript modules. No React, no DOM, no canvas calls except
where a module explicitly takes a CanvasRenderingContext2D argument.

Create:
  engine/types.ts       Vec2, RobotState (xMm, yMm, headingDeg, driveVelocity,
                        turnVelocity, driveTimeoutMs), Entity base type, Camera,
                        Viewport, TickContext
  engine/units.ts       mm/inch conversion, MM_PER_PIXEL replaced by a
                        camera-driven pixelsPerMm; normalizeDegrees;
                        shortestRotationDelta; angleBetween
  engine/rng.ts         a proper seeded PRNG (mulberry32 or sfc32) exposing
                        next(), int(min,max), pick(array), and a fork(label)
                        method so independent subsystems get independent streams
  engine/clock.ts       fixed-timestep accumulator (STEP_MS = 1000/60), in-game
                        time scaling, fastForward(untilPredicate, maxSteps)
  engine/camera.ts      Camera { centerMm, zoom }, worldToScreen, screenToWorld,
                        clampToBounds, fitToBounds, zoomAt(screenPoint, factor),
                        visibleWorldRect (for culling)
  engine/collision.ts   pointInPolygon, polygonsOverlap, circleHitsPolygon,
                        distanceToPolyline, segmentIntersectsPolygon,
                        SpatialHash class (insert / queryRadius / queryRect)
  engine/sensors.ts     raycast(origin, headingDeg, maxMm, obstacles),
                        detectRadial(origin, radiusMm, entities, filter),
                        detectCone(origin, headingDeg, halfAngleDeg, rangeMm,
                        entities, filter) — each returning sorted hits with
                        distanceMm and relativeAngleDeg
  engine/motion.ts      driveStep / turnStep given velocity %, plus
                        driveDurationMs / turnDurationMs kept compatible with
                        the current constants
  engine/interpreter.ts the AsyncFunction runner, ProgramStopped class, an
                        EventHatRegistry that polls predicates and fires handler
                        bodies with re-entrancy guards (generalising the current
                        startBumperWatchers)

Rules:
- Every geometry function takes and returns WORLD MILLIMETRES. Nothing in engine/
  knows about canvas pixels except camera.ts.
- Every new module gets a test file in tests/engine/. Target >85% coverage of
  engine/.
- lib/robot-runtime.ts stays in place for now but re-exports from engine/ where
  the logic moved, so components/vex-workspace.tsx keeps compiling untouched.
  The characterisation tests from Phase 0 must still pass unchanged.

Done when: the Phase 0 tests pass against the re-exporting shims, new engine tests
pass, and lint/typecheck/build are clean.
```

---

### Phase 2 — Playground contract and registry

```
Introduce the PlaygroundDefinition contract and port the existing Ocean Reef
playground to it. Still no Rover Rescue code.

1. Create playgrounds/types.ts with PlaygroundDefinition exactly as specified in
   docs/ARCHITECTURE.md, plus PlaygroundApiDeps (refs to robot state, world state,
   a console writer, a stop signal, and an rng).
2. Create playgrounds/registry.ts: a Map<string, PlaygroundDefinition> with
   register() and get(), plus a DEFAULT_PLAYGROUND_ID constant.
3. Create playgrounds/ocean-reef/ implementing the contract from the logic
   currently inside components/vex-workspace.tsx and lib/reef-art.ts:
     config.ts    field 2000mm, start pose, battery seconds, trash count
     entities.ts  coral pieces + trash items, generated from a seeded rng
     art.ts       moved from lib/reef-art.ts, but drawing in world mm through the
                  camera transform instead of raw canvas pixels
     render.ts    draws bed, coral, trash, submarine, rulers
     blocks.ts    the magnet + reef-specific sensing blocks
     api.ts       the robot.* methods that are reef-specific
     index.ts     the PlaygroundDefinition object
4. Convert Ocean Reef robot state from canvas pixels to world mm. The visual result
   at both normal and maximized window sizes must be unchanged; the camera simply
   fits the 2000mm field to the canvas at the appropriate zoom.
5. Wire components/vex-workspace.tsx to consume the definition from the registry
   rather than its own inline logic. This is a mechanical substitution — do NOT
   restructure the React component yet, that is Phase 3.
6. Read the playground id from a ?playground= query param, defaulting to
   ocean-reef, so a second playground can be added without a UI change.

Constraints:
- Behaviour parity is the acceptance bar. Before/after, the same block program must
  produce the same robot path, same trash collection, same coral game-over, same
  console output. Add tests/playgrounds/ocean-reef-parity.test.ts driving a short
  scripted program through the api and asserting the resulting pose and score.
- Delete lib/reef-art.ts only after playgrounds/ocean-reef/art.ts fully replaces it.

Done when: parity tests pass, the app looks and behaves identically, lint/typecheck/
test/build clean.
```

---

### Phase 3 — Decompose the React monolith

```
Break components/vex-workspace.tsx (5,600 lines) into focused modules. Behaviour
must not change; this is a pure structural refactor and it is the riskiest phase,
so work in small commits.

Extract, in this order, committing after each step:

1. blocks/fields/ — AngleWheelPicker, CompassPicker, DistanceSliderPicker
   (currently lines ~278-786) into their own components with the same props.
2. blocks/common/ — one file per category, each exporting
   { defineBlocks(Blockly), toolboxEntries, jsGenerators, pythonGenerators }:
     drivetrain.ts logic.ts operators.ts console.ts control.ts events.ts drawing.ts
   Move the corresponding cases out of lib/python-generator.ts into these files so
   a block's definition and both generators live together.
3. blocks/registry.ts + blocks/toolbox.ts — assemble the toolbox from the common
   categories plus playground.blocks from the registry.
4. components/workspace/BlocklyEditor.tsx — Blockly injection, workspace lifecycle,
   the category rail, the trash/undo panel, the widget-div fix. It should receive
   the toolbox as a prop and emit generated code via a callback. No knowledge of
   any playground.
5. components/playground/PlaygroundWindow.tsx — the draggable/minimizable/maximizable
   window chrome, and PlaygroundCanvas.tsx — the canvas element, resize handling,
   the requestAnimationFrame loop calling playground.tick() and playground.render().
6. components/ai-assistant/ — the Get Help panel and its option tree, verbatim.
7. components/workspace/Toolbar.tsx — Start / Reset / Open Playground / Get Help /
   Show Python.
8. hooks/useProgramRunner.ts — code generation, the AsyncFunction execution, the
   event-hat registry, stop/reset handling, console lines.
9. app/page.tsx becomes the composition root wiring all of the above.

Rules:
- No file over 400 lines when you are done. If one wants to be, split it again.
- No behaviour changes, no renamed props visible to users, no new features.
- The Phase 0 characterisation tests and Phase 2 parity tests must pass untouched.
- Delete components/vex-workspace.tsx at the end of the phase, not before.
- Add tests/components/ smoke tests: the editor mounts, the toolbox renders every
  category, Start runs a two-block program, Reset restores the start pose.

Done when: vex-workspace.tsx no longer exists, all tests pass, and a manual pass
through the README's usage guide behaves identically.
```

---

### Phase 4 — Rover Rescue world, terrain and camera

```
Add the Rover Rescue playground as a second entry in the registry. This phase
builds the WORLD ONLY: terrain, zones, river, bridges, base pad, camera, grid and
a rover you can drive with the existing drivetrain blocks. No minerals, no enemies,
no battery, no XP.

Use docs/ROVER-RESCUE-SPEC.md for every constant. Do not invent numbers.

1. playgrounds/rover-rescue/config.ts — field 12000x6000mm, X -6000..6000,
   Y -3000..3000, 500mm grid, start pose at the Base facing north, camera
   { minZoom: 0.25, maxZoom: 3, initialZoom: fit-to-window, follow: true }.
2. playgrounds/rover-rescue/map-spec.ts — a pure data module:
     ZONES: { id, label, polygonMm, tintColor }[]   (use the traced draft in the spec)
     RIVER_CENTERLINE + RIVER_WIDTH_MM
     BRIDGES: { id, centreMm, orientation, widthMm, lengthMm }[]
     BASE: { centreMm, radiusMm }
     TERRAIN_BANDS: coarse polygons for the dark rock, ochre desert and dune areas
   Derive the river hazard polygon by offsetting the centreline, then subtracting
   each bridge deck rectangle.
3. playgrounds/rover-rescue/art/ — procedural canvas drawing, in the style of the
   old lib/reef-art.ts. All drawing in world mm, transformed by the camera:
     terrain.ts  zone tints + terrain bands + a subtle deterministic noise stipple
     river.ts    the flowing green channel with animated highlight bands and banks
     bridges.ts  plank decks with rails
     base.ts     the research base pad with an X marker and a label
     grid.ts     500mm grid lines, thicker every 1000mm, plus axis lines at x=0/y=0
     rover.ts    a top-down 2D rover: 191x147mm chassis, solar panel wings, a
                 heading-obvious nose, glowing accents; must read clearly at 0.25x
   Every art function must be deterministic given (rng seed, entity id) so the
   world looks the same on every reset.
4. Camera controls in components/playground/ZoomControls.tsx:
     mouse wheel zooms about the cursor
     drag with middle mouse or space+drag pans
     +/- buttons, a "fit field" button, and a "follow rover" toggle
     pinch-zoom on touch
   Camera pan clamps so the field edge never leaves the viewport by more than 10%.
5. A coordinate readout in the corner of the playground showing the world (X,Y) mm
   under the cursor, and the rover's own (X,Y) and heading.
6. Level-of-detail: below 0.5x zoom skip stipple/detail passes and draw simplified
   shapes. Cull anything outside camera.visibleWorldRect().
7. Debug overlay behind a ?debug=1 flag: draws zone polygons with vertex handles,
   the river polygon, and bridge rects, and logs the current polygon arrays to the
   console as copy-pasteable TypeScript when you press D. This is how the traced
   draft polygons get tuned.

Constraints:
- No entity, gameplay or HUD code in this phase.
- The river is not yet a hazard; it just renders.
- Performance target: 60 fps at 1x zoom on a mid-range laptop with the whole field
  visible. Add a tests/playgrounds/rover-rescue/render-budget.test.ts that asserts
  the number of canvas path operations per frame stays under a set ceiling.

Done when: you can open ?playground=rover-rescue, see the full 12x6 m map, zoom
from 0.25x to 3x smoothly, pan around, drive the rover with drive/turn blocks, and
read its coordinates.
```

---

### Phase 5 — Entities, zones and spawning

```
Populate the Rover Rescue world. Still no battery, XP or combat resolution — just
the objects, their placement rules, and physical interaction.

1. playgrounds/rover-rescue/entities/:
     mineral.ts   { id, posMm, zoneId, state: "field"|"carried"|"used"|"delivered" }
     obstacle.ts  { id, posMm, kind: "rock"|"plant", radiusMm, artSeed }
     enemy.ts     { id, posMm, kind: "spider"|"serpent", serpentColor: "orange"|
                    "blue"|"purple"|null, level, maxHp, hp, radiation, state:
                    "idle"|"pursuing"|"attacking"|"neutralized", homeMm, artSeed }
   Each gets a matching art module drawing it top-down in world mm. Spiders are
   small dark multi-legged shapes; serpents are longer segmented bodies tinted by
   colour; minerals are glowing cyan crates.

2. playgrounds/rover-rescue/systems/spawn.ts — all placement driven by the seeded
   rng so a given seed reproduces the world exactly:
     - obstacle scatter with a Poisson-disc-ish minimum spacing, denser in the
       rocky terrain bands, never on the base pad, bridges, or in the river
     - initial minerals across every zone
     - respawn timers ONLY in zones C (slow), D (medium), E (fast); zones A and B
       never respawn. Put the intervals in config.ts as tunables.
     - enemies per the zone table: A/B spiders only; C spiders + orange serpents;
       D spiders + blue serpents; E spiders + purple serpents
     - enemy LEVEL scales with distance from the Base, independent of zone:
       level = clamp(1 + floor(distanceFromBaseMm / 2400), 1, 5)
       maxHp and radiation scale with level (put the curve in config.ts)

3. playgrounds/rover-rescue/systems/physics.ts (the playground's own rules; the
   geometry primitives it uses live in engine/collision.ts):
     - obstacles block the rover: driving into one stops it and sets a
       "blocked" flag the drivetrain reports through drive is done?
     - the river is a hazard: the rover's centre entering the river polygon ends
       the mission with reason "river"
     - bridge decks are safe strips over the river
     - the base pad is a trigger region, not an obstacle

4. Enemy movement in systems/enemy-ai.ts — for now only idle wander within a
   radius of homeMm, with deterministic per-enemy phase from the rng. Pursuit and
   attacks come in Phase 7.

5. A SpatialHash from engine/collision.ts indexes all entities; every per-frame
   query (collision, sensing, rendering) goes through it, never a full array scan.

Constraints:
- Entity counts should be roughly: 120-180 obstacles, 40-60 minerals in play,
  35-50 enemies. Expose these as config tunables and verify the frame budget test
  from Phase 4 still passes with a full world.
- Add tests: same seed → identical entity lists; no entity spawns inside the river,
  on a bridge, on the base pad, or overlapping another; zone spawn tables are
  respected; enemy level rises with distance from base.

Done when: the map is populated, the rover is physically blocked by rocks and
plants, driving into the river ends the mission, and bridges let you cross.
```

---

### Phase 6 — Sensing and AI visualisation

```
Implement the rover's sensing model and the two ways of visualising it.

1. playgrounds/rover-rescue/systems/sensing.ts, built on engine/sensors.ts:
     detect()  360°, 800mm radius, minerals and enemies ONLY
     sight()   40° total cone (±20° from heading), 1000mm range; sees minerals,
               enemies, obstacles, hazards (river) and the Base; returns for each:
               kind, label, distanceMm, relativeAngleDeg, and for enemies also
               level and hp/maxHp
     distanceSensor()  forward, max 2000mm, nearest blocking object
     Sight is occluded: an object behind an obstacle is not seen. Detect is not
     occluded (it is a radar, per the docs).

2. Implement these value blocks in playgrounds/rover-rescue/blocks.ts and api.ts,
   with the exact VEX names and dropdowns from docs/ROVER-RESCUE-SPEC.md §1.7:
     rover sees [minerals/enemy/obstacle/hazard/base]?
     rover detects [minerals/enemy]?
     rover direction [minerals/enemy/base]
     rover distance [minerals/enemy/base] in [mm/inches]
     rover location [minerals/enemy/base] [X/Y]
     distance found object?
     object distance in [mm/inches]
   "Nearest" is the selection rule for every one of these when several objects
   match. rover location returns the coordinates of the nearest matching object,
   not the rover's own — the rover's own position stays on the existing position
   sensing block.

3. AI visualisation overlay (playgrounds/rover-rescue/hud/AIOverlay.tsx +
   render pass), toggled by a button in the lower-right of the playground window:
     - detected/seen entities get a glowing outline
     - a floating label above each: "Minerals" / "Enemy" / "Obstacle" with
       Distance: N mm, and Angle: N° for minerals and enemies, and Level + HP for
       enemies
     - labels ONLY for things inside the 1000mm sight cone; detect-only contacts
       get the outline but no attribute text
     - labels must stay legible at every zoom: draw them at a fixed screen size,
       not scaled by the camera

4. Minimap (hud/Minimap.tsx): a small circular radar in the top-right showing the
   rover centred, a purple detect circle, a translucent purple sight cone, and dots
   for contacts inside those ranges. Compass ticks around the rim with N at top.

5. Full map view (hud/MapView.tsx): the whole field with zone tints, the river,
   bridges, base label, grid, a scale bar, and a compass rose — matching the
   reference map. Show the rover's position on it.

6. A single map button in the lower-right cycles: minimap → full map → hidden,
   matching VEX's three-state toggle.

Constraints:
- Sensing must be computed once per tick and cached, not recomputed per block call.
- Add tests for each sensing function: a mineral at 799mm is detected and at 801mm
  is not; an enemy at 19° off heading is seen and at 21° is not; sight is blocked
  by an intervening obstacle; distance sensor caps at 2000mm.

Done when: with AI visualisation on you can drive around and watch labels appear
and update, and all three map states work.
```

---

### Phase 7 — Game systems

```
Make it a game: battery, the mission clock, XP and levels, minerals handling, and
combat. This is the largest gameplay phase — consider splitting it into 7a
(resources + clock + levelling) and 7b (combat) if the diff runs long.

1. systems/battery.ts
     - drains continuously with in-game time, plus an extra rate while driving or
       turning; both rates are config tunables
     - reaching 0% ends the mission with reason "battery"
     - using a mineral sets battery to 100% instantly
     - absorbing radiation adds (absorbPercent/100 * enemyRadiation)

2. systems/mission.ts
     - an in-game day counter; DAY_MS in config controls the real-to-game ratio
       (tune so a normal run reaches 50 days in a few minutes of play)
     - at day 50, pause and surface a dialog with Continue / View Statistics /
       Get Certificate. The program KEEPS RUNNING while the dialog is open.
     - Continue re-irradiates every neutralized enemy (state back to idle, hp and
       radiation restored) and lets the mission carry on
     - View Statistics or Get Certificate ends the mission

3. systems/leveling.ts
     - XP awards: use mineral 2, deliver mineral to base 5, spider 5,
       orange/blue serpent 10, purple serpent 15
     - level thresholds 0 / 10 / 30 / 70 / 125, max level 5
     - per-level Absorb and Capacity from the table in config.ts
     - level-up fires the `when level up` event hat

4. systems/minerals.ts — the `minerals action [pick up/drop/use]` block:
     pick up  nearest mineral within a pickup radius, only if storage < capacity
     drop     place the most recently picked mineral at the rover's position
     use      consume one carried mineral → battery 100%, +2 XP
     delivering to base: entering the base pad with minerals in storage banks them
     all, +5 XP each, and clears storage
     `minerals in storage` and `storage capacity` report the obvious values

5. systems/combat.ts
     - enemies within an aggro radius switch to pursuing, then attacking, draining
       battery per hit; `under attack?` reads true while being hit and fires the
       `when under attack` event hat on the rising edge
     - `absorb radiation` targets the nearest enemy within absorb range, deals
       damage scaled by the rover's level, transfers radiation to battery at the
       absorb %, and neutralizes the enemy when hp reaches 0, awarding XP
     - absorbing a much higher-level enemy should be a losing trade — tune so the
       doc's advice ("only attack enemies near your own level, with a full
       battery") is actually correct in the sim

6. `standby until (N) % battery` — fast-forwards the clock via
   engine/clock.fastForward until battery drops to N%, advancing days rapidly.
   Cap the number of simulated steps so a runaway standby cannot hang the tab.
   Render a visibly sped-up state while it runs.

7. Wire the remaining value blocks: battery level, level, XP, enemy level,
   enemy radiation, under attack?, and the two event hats.

Constraints:
- All balance numbers live in config.ts with a comment saying whether they come
  from the VEX docs (authoritative) or are our tuning (marked TUNABLE).
- Add tests: XP thresholds produce the right level; capacity gates pick up; using
  a mineral restores battery and awards 2 XP; delivering 3 minerals awards 15 XP;
  neutralizing each enemy type awards the documented XP; battery 0 ends the
  mission; standby terminates and advances days.

Done when: a hand-written block program can survive, collect, level up, fight,
and die, and the 50-day dialog appears and behaves correctly.
```

---

### Phase 8 — The `go to` block

```
Implement `go to [minerals/enemy/base]` — the one block that needs real pathing.
Keep it in its own PR; it is the highest-risk single feature.

Requirements:
- Target selection: nearest object of the chosen kind that the rover currently
  DETECTS (800mm) or SEES (1000mm). For `base`, the base position is always known.
  If no target qualifies, the block returns immediately without moving and prints
  a console note.
- The rover drives to the target autonomously, respecting set drive velocity and
  set drive timeout, and stops on arrival (within a small arrival radius) or when
  the timeout expires.
- It must avoid obstacles and must never enter the river — crossing to the far
  bank requires routing over a bridge.
- It must remain interruptible: a stop driving block, the Stop button, or a
  program error cancels it cleanly.

Implementation:
1. systems/navigation.ts. Build a navigation graph once at world creation:
   a coarse grid (500mm cells matching the field grid) marked blocked for river
   cells and for cells containing an obstacle, with bridge cells explicitly walkable.
   Cache it; rebuild only when obstacles change.
2. A* over that grid, then string-pull / line-of-sight smoothing so the rover does
   not visibly zigzag along cell centres.
3. A steering layer that follows the smoothed path with the rover's real turn and
   drive kinematics — turn toward the next waypoint, drive, re-evaluate each tick.
4. Local avoidance for dynamic obstacles (enemies) that the static graph does not
   know about.
5. Re-path if the target moves more than one cell (enemies move) or if the rover
   gets stuck (no progress for N ticks).

Constraints:
- Path search must be bounded: cap expanded nodes and fall back to "drive toward
  the target with local avoidance" if the cap is hit, so the tab never freezes.
- The block yields to the interpreter every tick, exactly like drive-for does, so
  event hats and the Stop button still fire.
- Tests: a path from the Base to a point on the far bank uses a bridge; a path
  around a rock cluster is found; an unreachable target times out rather than
  looping forever; the same seed produces the same path.

Done when: `go to minerals` reliably drives the rover to the nearest mineral across
the map without entering the river or wedging on rocks.
```

---

### Phase 9 — HUD, map views and mission end

```
Build the Rover Rescue playground window chrome to match the reference screenshots.

1. hud/Battery.tsx — a large percentage readout in a battery-shaped frame, filling
   and draining, green → amber → red as it falls. Bottom-left, next to the
   Start/Reset buttons.
2. hud/Strength.tsx — the "Absorb: N / Capacity: N" box to the right of the battery.
3. hud/LevelBox.tsx — "Level N - XP: current/next" with a filling progress bar, and
   "Mission Length N.N Days" beneath it.
4. hud/MissionDialog.tsx — the day-50 panel with Continue / View Statistics /
   Get Certificate, appearing at the bottom of the playground window, non-modal so
   the program keeps running behind it.
5. hud/Stats.tsx — the end-of-mission statistics panel: total XP, days survived,
   enemies neutralized by type, minerals used, minerals delivered, distance
   travelled, final level. Also the data a learner-model would want later, so keep
   it in a plain serialisable object.
6. Replace "Get Certificate" with a local certificate view (name field + a printable
   summary card) rather than linking anywhere external.
7. Lower-right buttons: the three-state map toggle and the AI visualisation toggle,
   styled like the reference.
8. Game-over overlays for each reason: battery depleted, fell in the river,
   mission ended by the player.

Constraints:
- HUD is React over the canvas, not drawn into it, so it stays crisp and
  accessible. Every control needs a title/aria-label.
- The HUD must not re-render every frame. Throttle state pushed from the tick loop
  to ~10 Hz for HUD-only values.
- Keep the Ocean Reef HUD unchanged; this is playground-specific via the
  PlaygroundDefinition.hud slot.

Done when: the playground window matches the reference screenshots in layout and
information, at both normal and maximized sizes.
```

---

### Phase 10 — Python generation, examples and docs

```
Finish the phase set.

1. Extend blocks/generators/python.ts to cover every Rover Rescue block, matching
   VEXcode VR's Python API naming as closely as the block names do
   (drivetrain.drive_for, rover.go_to, rover.absorb_radiation,
   rover.minerals_action, rover.sees, rover.detects, rover.battery_level, etc.).
   Show Python must work for a full Rover Rescue program.
2. Add three example projects, loadable from a new "Examples" menu, one per
   strategy in the VEX docs:
     mineral-focused  standby + collect + use
     enemy-focused    check enemy level vs own level, approach, absorb
     base-focused     fill storage to capacity, go to base, deliver, repeat
   Store them as Blockly XML in playgrounds/rover-rescue/examples/.
3. Update README.md: the two playgrounds, the ?playground= param, the new
   architecture, the camera controls, the block tables.
4. Update docs/ARCHITECTURE.md to describe what was actually built, and record any
   deviation from this plan with the reason.
5. Add a short docs/ADDING-A-PLAYGROUND.md so a third playground is a recipe.

Done when: all three examples run end to end, Show Python emits valid-looking code
for each, and the docs match the code.
```

---

### Phase 11 (later, not now) — Multiplayer and instrumentation

Recorded here so it is not forgotten, deliberately **not** designed into Phases 0–10 per your call:

- The current collab layer (`lib/use-blockly-collab.ts` + `scripts/collab-server.mjs`) is a **last-writer-wins XML broadcast**. Two people typing at once will clobber each other. Real Google-Docs-style co-editing needs a CRDT — Yjs with `y-websocket`, and Blockly's workspace serialized as a `Y.Doc` rather than an XML string.
- Deterministic simulation (fixed timestep + seeded rng) is already an invariant of this plan, so two clients running the same program on the same seed will already agree. That was going to be the hard part and it comes for free.
- The `Stats` object from Phase 9 is the natural seed for a telemetry event stream. When you get there, emit typed events from the systems modules rather than instrumenting the React layer.

---

## Part 5 — Cursor project rules

The living copy is `.cursor/rules/project.mdc` (Appendix A of `docs/CURSOR-PROMPT-PACK.md`).

---

## Part 6 — Things that will bite you

**The pixel-to-mm conversion is load-bearing everywhere.** `MM_PER_PIXEL = 7.5` and `getDefaultRobotPixelPosition(isMaximized)` are threaded through the entire current codebase, including `remapPixelAcrossCanvas` which exists purely to fix up positions when the window resizes. Once state is in mm, that whole class of bug disappears — but the conversion during Phase 2 is exactly where Ocean Reef will silently break. That is what the parity tests are for.

**`go to` is a block, not a helper.** It has to obey `set drive timeout`, be cancellable, yield to event hats, and re-path when its target moves. Treating it as "drive toward a point" will work in an empty field and fail the moment there is a rock or a river.

**The mission dialog does not pause the program.** The docs are explicit: while the day-50 window is open, the robot keeps executing. Easy to get wrong.

**Sight is occluded, detect is not.** Detect is described as a 360° radar; sight is a camera. If you implement both the same way, students' avoidance code will behave strangely near rocks.

**Zone polygons overlap in the reference art.** Zone E sits on top of Zone D's northeast corner, and Zone B appears as two disjoint regions. Model zones as an ordered list where a later zone wins, and make `zoneAt(point)` return exactly one zone.

**Labels must not scale with zoom.** At 0.25x the AI visualisation text will be unreadable if you draw it in world space. Draw entity outlines in world space and text in screen space.

**Balance is not in the documentation.** VEX publishes the XP table and level thresholds but not battery drain rate, absorb-per-level, enemy HP, aggro radius, or day length. Those are all yours to tune, which is why the plan marks them TUNABLE and puts them in one file.

---

## Sources

- *VEXcode VR Rover Rescue Documentation* (VR Premium Documentation combined, 28 August 2025) — supplied PDF, 54 pp.
- [Detailed Guide on Rover Rescue Field](https://api.vex.com/vr/home/playgrounds/rover_rescue/field_details.html)
- [VR Rover — Robot-Specific Blocks](https://api.vex.com/vr/home/robots/rover/robot_specific_blocks.html)
- [Features of the VR Rover](https://kb.vex.com/hc/en-us/articles/4411552432020-Features-of-the-VR-Rover)
- [Using AI in Rover Rescue](https://kb.vex.com/hc/en-us/articles/4411795656084-Using-AI-in-Rover-Rescue)
- [Leveling Up in Rover Rescue](https://kb.vex.com/hc/en-us/articles/4411546369300-Leveling-Up-in-Rover-Rescue)
- [Neutralizing Enemies in Rover Rescue](https://kb.vex.com/hc/en-us/articles/4411548143124-Neutralizing-Enemies-in-Rover-Rescue)
- [Collecting Minerals in Rover Rescue](https://kb.vex.com/hc/en-us/articles/4411770487572-Collecting-Minerals-in-Rover-Rescue)
- [Using the Rover Rescue Playground Window](https://kb.vex.com/hc/en-us/articles/4411772463508-Using-the-Rover-Rescue-Playground-Window-in-VEXcode-VR)
- `Geph/INVITE-VEXcode-VR-Prototyping` @ `Mars-Rover`
