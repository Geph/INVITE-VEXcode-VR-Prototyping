# Rover Rescue — Cursor Prompt Pack

**This is the execution document.** Fourteen phases in run order, each a self-contained prompt you paste into Cursor. The other two files are reference material the prompts point at:

- `ROVER-RESCUE-BUILD-PLAN.md` — the playground spec (field geometry, zones, XP tables, sensor ranges, block list) and the target architecture
- `ROVER-RESCUE-LOGGING-PLAN.md` — the VEX event schema decoded, and the `pg_*` block-type mapping table

The three amendments from the logging analysis are already folded in here: `pg_*` block naming lands in Phase 3 rather than being retrofitted, the `anddontwait_mutator` is built into Phases 5 and 10, and broadcast/variables blocks join the common set in Phase 3.

---

## Setup, once

**1. Get the reference docs into the repo.**

```bash
git checkout Mars-Rover && git pull
git checkout -b rr/phase-0-baseline
mkdir -p docs
cp ~/Desktop/"Rescue Rover Clone Resources"/ROVER-RESCUE-BUILD-PLAN.md   docs/
cp ~/Desktop/"Rescue Rover Clone Resources"/ROVER-RESCUE-LOGGING-PLAN.md docs/
cp ~/Desktop/"Rescue Rover Clone Resources"/CURSOR-PROMPT-PACK.md        docs/
git add docs && git commit -m "docs: Rover Rescue build plan, logging plan, prompt pack"
```

**2. Create `.cursor/rules/project.mdc`** with the contents in Appendix A. Cursor applies it to every request in the repo, so the prompts below don't restate conventions.

**3. Working loop, every phase.**

```bash
git checkout Mars-Rover && git pull && git checkout -b rr/phase-N-slug
```

- Open Cursor's agent in **Plan mode**. Paste the prompt. Let it produce a plan.
- **Review the file list before letting it execute.** If the plan touches files the prompt didn't mention, ask why.
- Let it execute. Then: `npm run lint && npm run typecheck && npm test && npm run build`.
- If the diff exceeds ~1,500 lines, stop and say: *"Split this into two PRs and give me the file list for each."*
- PR, review, merge. Next phase.

**4. Order matters.** Phases 0–3 are pure refactor with zero Rover Rescue code — Ocean Reef is your regression test, and every later phase depends on the seams they create. Don't skip ahead to Phase 5 because it's the fun one.

---

## Phase 0 — Baseline, guardrails, spec in the repo

> Branch: `rr/phase-0-baseline`

```
We are rewriting this project from a single 5,600-line component into a modular
engine + playground architecture, then adding a second playground (VEXcode VR
"Rover Rescue") as a 2D pan/zoom world with VEX-compatible event logging.

This phase does no refactoring. It only sets up guardrails.

1. Create docs/ARCHITECTURE.md describing the TARGET structure from
   docs/ROVER-RESCUE-BUILD-PLAN.md Part 2 — the directory layout, the
   PlaygroundDefinition interface, and the five invariants. Do not implement anything.

2. Create docs/ROVER-RESCUE-SPEC.md from Part 1 of the build plan: field geometry,
   zone polygons, river and bridges, XP/level tables, sensing ranges, and the block
   list. This becomes the single source of truth for constants — no gameplay number
   may be hard-coded at a call site anywhere in the project.

3. Create docs/LOGGING-SPEC.md from sections 2.1-2.8 of docs/ROVER-RESCUE-LOGGING-PLAN.md:
   the event envelope, raw_message payload, the 21-event taxonomy, the four
   blockEventData shapes, playgroundData parameters, and the pg_* block-type mapping.
   Include the note that VEX's misspellings (enemies_nuetralized, PlaygroundChange)
   are reproduced deliberately for pipeline compatibility.

4. Set up a real test runner. Add vitest and @vitest/coverage-v8 as devDependencies,
   a vitest.config.ts with a node environment, and scripts:
     "test": "vitest run",  "test:watch": "vitest"
   Port scripts/check-bumper-geometry.mjs into tests/engine/bumper-geometry.test.ts
   so `npm test` still covers what it covered.

5. Write characterisation tests for the CURRENT behaviour of lib/robot-runtime.ts:
   clampRobotPosition, distanceToPixels/pixelsToDistance round-trips, normalizeDegrees,
   shortestRotationDelta, driveDurationMs, turnDurationMs, fieldMmToPixel/pixelToFieldMm
   round-trips, raycastToBorder, pointHitsCoral, nearestTrashInFrontMm.
   These lock in Ocean Reef behaviour so Phases 1-3 cannot silently change it.
   Target >80% line coverage of that file.

6. Add the test suite to .github/workflows/ci.yml.

Constraints:
- Do not modify components/vex-workspace.tsx, app/, or any lib/ implementation.
- Tests describe what the code does TODAY, even where it looks wrong. If you find
  behaviour that looks like a bug, assert current behaviour and list it under
  "Known oddities" in docs/ARCHITECTURE.md.

Done when: lint, typecheck, test and build all pass, and the app behaves as before.
```

---

## Phase 1 — Extract the engine

> Branch: `rr/phase-1-engine`

```
Extract playground-agnostic simulation logic from lib/ into a new engine/ directory
of pure TypeScript modules. No React, no DOM, no canvas calls except where a module
explicitly takes a CanvasRenderingContext2D argument.

Create:
  engine/types.ts       Vec2, RobotState (xMm, yMm, headingDeg, driveVelocity,
                        turnVelocity, driveTimeoutMs), Entity base, Camera, Viewport,
                        TickContext
  engine/units.ts       mm/inch conversion, camera-driven pixelsPerMm (replacing the
                        fixed MM_PER_PIXEL), normalizeDegrees, shortestRotationDelta,
                        angleBetween
  engine/rng.ts         a seeded PRNG (mulberry32 or sfc32) exposing next(),
                        int(min,max), pick(array), and fork(label) so independent
                        subsystems get independent streams from one world seed
  engine/clock.ts       fixed-timestep accumulator (STEP_MS = 1000/60), in-game time
                        scaling, fastForward(untilPredicate, maxSteps)
  engine/camera.ts      Camera { centerMm, zoom }, worldToScreen, screenToWorld,
                        clampToBounds, fitToBounds, zoomAt(screenPoint, factor),
                        visibleWorldRect for culling
  engine/collision.ts   pointInPolygon, polygonsOverlap, circleHitsPolygon,
                        distanceToPolyline, segmentIntersectsPolygon, and a
                        SpatialHash class (insert / queryRadius / queryRect)
  engine/sensors.ts     raycast(origin, headingDeg, maxMm, obstacles),
                        detectRadial(origin, radiusMm, entities, filter),
                        detectCone(origin, headingDeg, halfAngleDeg, rangeMm, entities,
                        filter) — each returning hits sorted by distance, carrying
                        distanceMm and relativeAngleDeg
  engine/motion.ts      driveStep / turnStep from velocity %, plus driveDurationMs and
                        turnDurationMs kept compatible with the current constants
  engine/interpreter.ts the AsyncFunction runner, the ProgramStopped class, and an
                        EventHatRegistry that polls predicates and fires handler bodies
                        with re-entrancy guards — generalising the current
                        startBumperWatchers so it can serve when-under-attack,
                        when-level-up and when-I-receive later

Rules:
- Every geometry function takes and returns WORLD MILLIMETRES. Nothing in engine/
  knows about canvas pixels except camera.ts.
- Every module gets a test file in tests/engine/. Target >85% coverage of engine/.
- lib/robot-runtime.ts stays in place and re-exports from engine/ where logic moved,
  so components/vex-workspace.tsx keeps compiling untouched. The Phase 0
  characterisation tests must pass unchanged against the shims.

Done when: Phase 0 tests pass against the shims, new engine tests pass, lint/typecheck/
build clean.
```

---

## Phase 2 — Playground contract and registry

> Branch: `rr/phase-2-contract`

```
Introduce the PlaygroundDefinition contract and port Ocean Reef to it. Still no
Rover Rescue code.

1. playgrounds/types.ts — PlaygroundDefinition exactly as in docs/ARCHITECTURE.md,
   plus PlaygroundApiDeps (refs to robot state, world state, a console writer, a stop
   signal, an rng). Include an optional method that later phases depend on:
     outcomeParameters(state): Record<string, unknown>
   It returns the playground's end-of-run summary numbers. Ocean Reef implements it
   now; the telemetry layer in Phase 4 is its only consumer.

2. playgrounds/registry.ts — Map<string, PlaygroundDefinition> with register() and
   get(), plus DEFAULT_PLAYGROUND_ID.

3. playgrounds/ocean-reef/ implementing the contract from logic currently inside
   components/vex-workspace.tsx and lib/reef-art.ts:
     config.ts    2000mm field, start pose, battery seconds, trash count
     entities.ts  coral pieces + trash items generated from a seeded rng
     art.ts       moved from lib/reef-art.ts, drawing in world mm through the camera
                  transform rather than raw canvas pixels
     render.ts    bed, coral, trash, submarine, rulers
     blocks.ts    the magnet and reef-specific sensing blocks
     api.ts       the reef-specific robot.* methods
     index.ts     the PlaygroundDefinition object, including outcomeParameters()
                  returning exactly:
                    trash_collected, coral_damaged, battery_remaining,
                    project_stopped_by_user, gps_x_position, gps_y_position
                  These key names match VEX's production logs — see
                  docs/LOGGING-SPEC.md. Do not rename them.

4. Convert Ocean Reef robot state from canvas pixels to world mm. The visual result at
   both normal and maximized window sizes must be unchanged — the camera fits the
   2000mm field to the canvas at the appropriate zoom. This conversion is the single
   most likely place to break Ocean Reef; be careful and lean on the parity test.

5. Wire components/vex-workspace.tsx to consume the definition from the registry
   instead of its own inline logic. Mechanical substitution only — do NOT restructure
   the React component, that is Phase 3.

6. Read the playground id from a ?playground= query param, defaulting to ocean-reef.

Constraints:
- Behaviour parity is the acceptance bar. The same block program must produce the same
  robot path, trash collection, coral game-over and console output before and after.
  Add tests/playgrounds/ocean-reef-parity.test.ts driving a scripted program through
  the api and asserting final pose and score.
- Delete lib/reef-art.ts only once playgrounds/ocean-reef/art.ts fully replaces it.

Done when: parity tests pass, the app behaves identically, lint/typecheck/test/build clean.
```

---

## Phase 3 — Decompose the monolith, and adopt VEX block IDs

> Branch: `rr/phase-3-decompose`
> **Highest-risk phase. Commit after every numbered step.**

```
Break components/vex-workspace.tsx (5,600 lines) into focused modules, and rename all
block types to VEX's pg_* namespace. Behaviour must not change.

PART A — decomposition. Extract in this order, committing after each step:

1. blocks/fields/ — AngleWheelPicker, CompassPicker, DistanceSliderPicker (currently
   ~lines 278-786) as separate components with identical props.
2. blocks/common/ — one file per category, each exporting
   { defineBlocks(Blockly), toolboxEntries, jsGenerators, pythonGenerators }:
     drivetrain.ts logic.ts operators.ts console.ts control.ts events.ts drawing.ts
     variables.ts
   Move the matching cases out of lib/python-generator.ts into these files, so a
   block's definition and both its generators live together.
3. blocks/registry.ts + blocks/toolbox.ts — assemble the toolbox from the common
   categories plus playground.blocks from the registry.
4. components/workspace/BlocklyEditor.tsx — Blockly injection, workspace lifecycle,
   category rail, trash/undo panel, the widget-div fix. Receives the toolbox as a prop,
   emits generated code via a callback, knows nothing about any playground.
5. components/playground/PlaygroundWindow.tsx (draggable/minimizable/maximizable window
   chrome) and PlaygroundCanvas.tsx (canvas element, resize handling, the
   requestAnimationFrame loop calling playground.tick() then playground.render()).
6. components/ai-assistant/ — the Get Help panel and its option tree, verbatim.
7. components/workspace/Toolbar.tsx — Start / Reset / Open Playground / Get Help /
   Show Python.
8. hooks/useProgramRunner.ts — code generation, AsyncFunction execution, the event-hat
   registry, stop/reset handling, console lines.
9. app/page.tsx becomes the composition root wiring all of the above.

PART B — block type IDs. Rename every Blockly block type to VEX's pg_* namespace using
the mapping table in docs/LOGGING-SPEC.md (section 2.8 of the logging plan). Examples:
     when_started        -> pg_events_when_started
     drive_distance      -> pg_drivetrain_drive_for
     turn_degrees        -> pg_drivetrain_turn_for
     if_then             -> pg_control_if_then
     repeat_times        -> pg_control_repeat
     compare             -> pg_operator_comparison
     distance_found_object -> pg_sensing_distance_found
Standard Blockly/Scratch types (math_number, math_whole_number, math_number_string,
math_positive_number, procedures_definition, procedures_call, procedures_prototype,
comment_text) keep their names — VEX uses them unchanged.

This is a rename, not a translation layer: no mapping function should survive it. The
reason is that block_type is the only content-level signal our learner-modelling
pipeline reads, so it has to match VEX's vocabulary exactly.

Add a migration in the workspace XML loader rewriting old bare type names to pg_* names,
so saved projects and the collab server's cached XML keep working. Cover it with a test.

PART C — blocks the real student logs show that we are missing. Add to blocks/common/:
     pg_events_broadcast, pg_events_when_broadcasted   (Scratch-style messaging)
     pg_variables_set_variable and a variables category
Match VEX's field names: OBJECT, ACTION, DIRECTION, UNITS, COMPARISON, CHECK, NUM,
VELOCITY, TIMES, CONDITION, SUBSTACK, OPERAND / OPERAND1 / OPERAND2. Parameter sockets
use VEX's shadow types (math_number, math_whole_number, math_number_string,
math_positive_number).

Rules:
- No file over 400 lines when done. If one wants to be, split it again.
- No user-visible changes: same block labels, same props, no new features.
- Phase 0 characterisation tests and Phase 2 parity tests pass untouched.
- Delete components/vex-workspace.tsx at the END of the phase, not before.
- Add tests/components/ smoke tests: the editor mounts, the toolbox renders every
  category, Start runs a two-block program, Reset restores the start pose.
- Add a test asserting every registered block type either starts with "pg_" or is one
  of the allowed standard types.

Done when: vex-workspace.tsx no longer exists, all tests pass, and a manual pass through
the README usage guide behaves identically.
```

---

## Phase 4 — Telemetry core

> Branch: `rr/phase-4-telemetry`
> Wired to Ocean Reef, where behaviour is already known-good. No Rover Rescue code.

```
Add a VEX-compatible event logging layer. docs/LOGGING-SPEC.md is the schema contract.

1. telemetry/types.ts — exact types for the envelope, RawMessage, BlockEventData (a
   discriminated union on eventType with the four variants), PlaygroundData, and the
   _invite extension namespace. No optional fields where VEX always sends one.

2. telemetry/identity.ts
   - join state: classCode (from ?class= or a form) + display name
   - deterministic anonymised studentID in VEX's {SITE}-C{NNN} shape, from hashing
     name + classCode. The display name must never appear in an emitted event.
   - raw sessionID: a fresh UUID per page load, deliberately mimicking VEX's
     unreliable-on-refresh behaviour (the pipeline ignores it and re-derives sessions
     from a 45-minute inactivity gap)
   - persist to localStorage inside try/catch; expose a reset

3. telemetry/emitter.ts
   - emit(eventType, payload) stamps timestamp (ISO-8601 UTC, milliseconds, trailing Z),
     identity, programType, playground, hasOrphans, switchBlockCount, errorMessage
   - builds raw_message by JSON.stringify of the payload, then wraps it in the envelope
     with the duplicated eventType / classCode / studentID / project fields
   - ring buffer, flushed on 50 events, 5 seconds, page hide, or beforeunload
   - coalesces consecutive blockMoved events for the same blockID within 250ms into one
     event carrying the first oldInfo and the last newInfo (Blockly fires a move per
     drag; blockMoved is 45% of VEX's log volume)
   - monotonic client sequence number in _invite.seq

4. telemetry/schema.ts — a validator run on every event in dev and in tests: required
   keys present, no extra top-level keys, timestamp format, correct blockEventData
   variant for the event type. Throw loudly in dev, count-and-continue in production.

5. telemetry/sinks/ — console.ts (dev), indexeddb.ts (offline buffer surviving refresh,
   draining in order on reconnect), http.ts (POST newline-delimited batches to
   NEXT_PUBLIC_TELEMETRY_URL). Sink selection by env var; default console + indexeddb.

6. telemetry/sources/blockly.ts — attach a workspace.addChangeListener and map:
     BLOCK_CREATE -> blockCreated {eventType:"create", blockID, blockType}
     BLOCK_CHANGE -> blockChanged {eventType:"change", blockID, blockType, fieldName,
                                   oldValue, newValue}
     BLOCK_MOVE   -> blockMoved   {eventType:"move", blockID, blockType, oldInfo, newInfo}
     BLOCK_DELETE -> blockDeleted {eventType:"delete", blockID}
   oldInfo/newInfo are {coordinate:{x,y}} for free-floating positions and
   {parent:"<blockId>"} when connected. blockDeleted carries NO blockType. Ignore
   UI-only events (click, selected, viewport).
   CRITICAL: this listener must not fire for changes applied by the collab layer.
   lib/use-blockly-collab.ts wraps remote applies in Blockly.Events.disable() — respect
   that guard, or remote edits will be logged as local ones.

7. telemetry/sources/run.ts — runProject on Start; projectEnd on natural completion,
   error, or Stop. Mint run_id as {studentID}_S{NNN}_run_{NNN}. Do NOT emit projectEnd
   when a run is abandoned by a reset — matching VEX, where runProject outnumbers
   projectEnd by about 5%.

8. telemetry/sources/playground.ts — playgroundOpen / playgroundClosed /
   playgroundHidden / playgroundShow / playgroundReset / PlaygroundChange (capital P —
   it is the only capitalised event type in VEX's taxonomy, reproduce it exactly), and
   playgroundData on projectEnd carrying playground.outcomeParameters().

9. telemetry/sources/nav.ts — pageLoad on mount, login on join, and menuOpen /
   menuSelect / menuClose with menuName and menuItemSelected.

10. Sparse workspace XML. Emit full project.workspace on runProject, projectEnd,
    newProject, PlaygroundChange and a 60-second heartbeat. On every other event emit
    project WITHOUT the workspace string, plus _invite.workspaceHash (a 32-bit hash of
    the XML). Add a TELEMETRY_VEX_COMPAT=full env flag restoring XML on every event for
    conformance testing.
    Rationale: VEX embeds the full workspace on every event, twice, which is what makes
    their logs ~11 KB/event. No derived column in the modelling pipeline reads
    workspace_xml, so sparse mode loses nothing the pipeline can see.

11. A debug inspector at ?telemetry=debug: a floating panel listing the last 50 emitted
    events with eventType, timestamp, run_id, derived session id and payload size, plus
    a "download NDJSON" button.

Constraints:
- telemetry/ imports nothing from components/ or playgrounds/. Sources are registered by
  the composition root in app/page.tsx.
- Zero telemetry code inside playground modules — a playground contributes only through
  outcomeParameters().
- Never log the student's display name, roster data, or any free text a student typed
  except block field values.
- Telemetry failures must never break the app. Wrap every emit in try/catch.

Tests (tests/telemetry/):
- every event type produces an object passing schema.ts
- blockMoved coalescing merges within 250ms and never across blockIDs
- envelope duplicated fields always match their raw_message counterparts
- identity is stable across reloads, changes when the class code changes
- the indexeddb sink drains in order after a simulated offline period
- golden-file test: a scripted 30-event session serialises to NDJSON matching a
  checked-in fixture byte-for-byte

Done when: an Ocean Reef session with ?telemetry=debug produces a complete, schema-valid
event stream, and lint/typecheck/test/build are clean.
```

---

## Phase 5 — Rover Rescue world, terrain, camera

> Branch: `rr/phase-5-world`

```
Add Rover Rescue as a second registry entry. WORLD ONLY: terrain, zones, river, bridges,
base pad, camera, grid, and a rover you can drive with the drivetrain blocks. No
minerals, no enemies, no battery, no XP.

Use docs/ROVER-RESCUE-SPEC.md for every constant. Do not invent numbers.

1. playgrounds/rover-rescue/config.ts — 12000x6000mm field, X -6000..6000,
   Y -3000..3000, 500mm grid, start pose at the Base facing north, camera
   { minZoom: 0.25, maxZoom: 3, initialZoom: fit-to-window, follow: true }.
   Mark every constant DOC (from the VEX documentation, do not change) or TUNABLE.

2. playgrounds/rover-rescue/map-spec.ts — a pure data module:
     ZONES: { id, label, polygonMm, tintColor }[]  — use the traced draft in the spec
     RIVER_CENTERLINE + RIVER_WIDTH_MM
     BRIDGES: { id, centreMm, orientation, widthMm, lengthMm }[]
     BASE: { centreMm, radiusMm }
     TERRAIN_BANDS: coarse polygons for dark rock, ochre desert, dune areas
   Derive the river hazard polygon by offsetting the centreline, then subtracting each
   bridge deck rectangle.
   Zones overlap by design (Zone E sits on Zone D's NE corner; Zone B is two disjoint
   regions), so model them as an ordered list where a later zone wins, and make
   zoneAt(point) return exactly one zone.

3. playgrounds/rover-rescue/art/ — procedural canvas drawing in the style of the old
   lib/reef-art.ts. All drawing in world mm through the camera transform:
     terrain.ts  zone tints, terrain bands, deterministic noise stipple
     river.ts    the flowing green channel with animated highlight bands and banks
     bridges.ts  plank decks with rails
     base.ts     the research base pad with an X marker and label
     grid.ts     500mm lines, thicker every 1000mm, axis lines at x=0 and y=0
     rover.ts    top-down 2D rover, 191x147mm chassis, solar panel wings, an obvious
                 nose, glowing accents; must read clearly at 0.25x zoom
   Every art function is deterministic given (seed, entity id) so the world looks the
   same on every reset.

4. Camera controls in components/playground/ZoomControls.tsx: wheel zooms about the
   cursor; middle-drag or space+drag pans; +/- buttons; a "fit field" button; a "follow
   rover" toggle; pinch-zoom on touch. Pan clamps so the field edge never leaves the
   viewport by more than 10%.

5. A coordinate readout showing world (X,Y) mm under the cursor, plus the rover's own
   (X,Y) and heading.

6. Level of detail: below 0.5x zoom, skip stipple and detail passes and draw simplified
   shapes. Cull anything outside camera.visibleWorldRect().

7. Add the "and don't wait" mutator to the drivetrain blocks. VEX's motion blocks carry
   an `anddontwait_mutator` field (values "true"/"false") on pg_drivetrain_drive_for and
   pg_drivetrain_turn_for. When true the block returns immediately instead of awaiting
   completion, and pg_sensing_drive_is_done becomes the way to wait. Implement it in the
   runtime and expose it as a right-click mutator on those blocks.
   This changes the runtime contract for motion from "always awaits" to "awaits unless
   mutated" — build it in now rather than retrofitting.

8. Debug overlay behind ?debug=1: draws zone polygons with vertex handles, the river
   polygon and bridge rects, and logs the current polygons to the console as
   copy-pasteable TypeScript when you press D. The zone polygons in the spec are traced
   approximations from the reference map image, and this is how you tune them.

9. Telemetry: the playground emits playgroundOpen/Closed/Hidden/Show and PlaygroundChange
   through the existing Phase 4 sources with no new telemetry code. Verify the events
   appear in ?telemetry=debug when you switch playgrounds.

Constraints:
- No entity, gameplay or HUD code this phase. The river renders but is not yet a hazard.
- Performance target: 60fps at 1x zoom with the whole field visible. Add
  tests/playgrounds/rover-rescue/render-budget.test.ts asserting canvas path operations
  per frame stay under a ceiling.

Done when: ?playground=rover-rescue shows the full 12x6m map, zooms 0.25x-3x smoothly,
pans, drives with drive/turn blocks, and reads out coordinates.
```

---

## Phase 6 — Entities, zones, spawning

> Branch: `rr/phase-6-entities`

```
Populate the world. No battery, XP or combat resolution yet — objects, placement rules,
and physical interaction only.

1. playgrounds/rover-rescue/entities/
     mineral.ts   { id, posMm, zoneId, state: "field"|"carried"|"used"|"delivered" }
     obstacle.ts  { id, posMm, kind: "rock"|"plant", radiusMm, artSeed }
     enemy.ts     { id, posMm, kind: "spider"|"serpent",
                    serpentColor: "orange"|"blue"|"purple"|null, level, maxHp, hp,
                    radiation, state: "idle"|"pursuing"|"attacking"|"neutralized",
                    homeMm, artSeed }
   Each gets an art module drawing it top-down in world mm: spiders are small dark
   multi-legged shapes, serpents longer segmented bodies tinted by colour, minerals
   glowing cyan crates.

2. systems/spawn.ts — all placement from the seeded rng so a seed reproduces the world
   exactly:
   - obstacle scatter with Poisson-disc-ish minimum spacing, denser in rocky terrain
     bands, never on the base pad, bridges, or in the river
   - initial minerals across every zone
   - respawn timers ONLY in zones C (slow), D (medium), E (fast); A and B never respawn
   - enemies per the zone table: A/B spiders only; C spiders + orange serpents;
     D spiders + blue serpents; E spiders + purple serpents
   - enemy LEVEL scales with distance from Base, independent of zone:
       level = clamp(1 + floor(distanceFromBaseMm / 2400), 1, 5)
     with maxHp and radiation curves in config.ts, marked TUNABLE

3. systems/physics.ts (playground rules; geometry primitives come from
   engine/collision.ts):
   - obstacles block the rover: driving into one stops it and sets a "blocked" flag the
     drivetrain reports through pg_sensing_drive_is_done
   - the river is a hazard: the rover's centre entering the river polygon ends the
     mission with reason "river"
   - bridge decks are safe strips over the river
   - the base pad is a trigger region, not an obstacle

4. systems/enemy-ai.ts — idle wander within a radius of homeMm, with a deterministic
   per-enemy phase from the rng. Pursuit and attacks come in Phase 8.

5. Index all entities in a SpatialHash from engine/collision.ts. Every per-frame query
   (collision, sensing, rendering) goes through it, never a full array scan.

Constraints:
- Target counts: 120-180 obstacles, 40-60 minerals in play, 35-50 enemies. Expose as
  config tunables and verify the Phase 5 frame-budget test still passes with a full world.

Tests: same seed produces identical entity lists; nothing spawns in the river, on a
bridge, on the base pad, or overlapping another entity; zone spawn tables are respected;
enemy level rises with distance from base.

Done when: the map is populated, rocks and plants physically block the rover, driving
into the river ends the mission, and bridges let you cross.
```

---

## Phase 7 — Sensing and AI visualisation

> Branch: `rr/phase-7-sensing`

```
Implement the rover's sensing model and both ways of visualising it.

1. systems/sensing.ts on top of engine/sensors.ts:
     detect()   360 degrees, 800mm radius, minerals and enemies ONLY, NOT occluded
     sight()    40 degree total cone (+/-20 from heading), 1000mm range; sees minerals,
                enemies, obstacles, hazards and the Base; returns kind, label,
                distanceMm, relativeAngleDeg, and for enemies level and hp/maxHp;
                IS occluded — an object behind an obstacle is not seen
     distanceSensor()  forward, max 2000mm, nearest blocking object
   The occlusion asymmetry is intentional and confirmed by VEX's internal block naming:
   sight is a camera (pg_sensing_ai_sees), detect is a 360-degree non-directional sense
   (pg_sensing_ai_smells).

2. Implement the value blocks in playgrounds/rover-rescue/blocks.ts and api.ts with
   VEX's exact type IDs and dropdowns (docs/LOGGING-SPEC.md section 2.8):
     pg_sensing_ai_sees            rover sees [minerals/enemy/obstacle/hazard/base]?
     pg_sensing_ai_smells          rover detects [minerals/enemy]?
     pg_sensing_ai_sees_distance   rover distance [target] in [mm/inches]
     pg_sensing_distance_found     distance found object?
     plus rover direction and rover location blocks
   "Nearest" is the selection rule for all of them when several objects match.
   rover location returns the nearest matching OBJECT's coordinates, not the rover's own
   — the rover's position stays on the existing position sensing block.

3. AI visualisation overlay (hud/AIOverlay.tsx plus a render pass), toggled from the
   lower-right of the playground window:
   - detected and seen entities get a glowing outline
   - a floating label above each: "Minerals" / "Enemy" / "Obstacle" with Distance: N mm,
     Angle: N degrees for minerals and enemies, and Level plus HP for enemies
   - labels ONLY for things inside the 1000mm sight cone; detect-only contacts get the
     outline with no attribute text
   - draw outlines in world space but labels at a FIXED SCREEN SIZE, or they become
     unreadable at 0.25x zoom

4. hud/Minimap.tsx — a small circular radar top-right: rover centred, a purple detect
   circle, a translucent purple sight cone, dots for contacts inside those ranges,
   compass ticks with N at top.

5. hud/MapView.tsx — the whole field with zone tints, river, bridges, base label, grid,
   scale bar and compass rose, matching the reference map, with the rover's position on it.

6. One map button in the lower-right cycles minimap -> full map -> hidden, matching VEX's
   three-state toggle.

Constraints:
- Sensing is computed once per tick and cached, never recomputed per block call.

Tests: a mineral at 799mm is detected and at 801mm is not; an enemy at 19 degrees off
heading is seen and at 21 is not; sight is blocked by an intervening obstacle; the
distance sensor caps at 2000mm.

Done when: with AI visualisation on you can drive around watching labels appear and
update, and all three map states work.
```

---

## Phase 8 — Game systems

> Branch: `rr/phase-8-systems`
> **Largest gameplay phase. Split into 8a (resources, clock, levelling) and 8b (combat) if the diff runs long.**

```
Make it a game: battery, mission clock, XP and levels, minerals handling, combat.

1. systems/battery.ts — drains continuously with in-game time, plus extra while driving
   or turning (both rates TUNABLE). 0% ends the mission with reason "battery". Using a
   mineral sets battery to 100% instantly. Absorbing radiation adds
   (absorbPercent/100 * enemyRadiation).

2. systems/mission.ts — an in-game day counter, DAY_MS controlling the real-to-game
   ratio (tune so a normal run reaches 50 days in a few minutes). At day 50, surface a
   dialog with Continue / View Statistics / Get Certificate.
   THE PROGRAM KEEPS RUNNING WHILE THE DIALOG IS OPEN — the VEX docs are explicit about
   this and it is easy to get wrong.
   Continue re-irradiates every neutralized enemy (state back to idle, hp and radiation
   restored). View Statistics or Get Certificate ends the mission.

3. systems/leveling.ts — XP: use mineral 2, deliver mineral to base 5, spider 5,
   orange/blue serpent 10, purple serpent 15. Thresholds 0 / 10 / 30 / 70 / 125, max
   level 5. Per-level Absorb and Capacity from the config table. Level-up fires the
   pg_events_when_level_up hat.

4. systems/minerals.ts — the pg_actions_interact_with_minerals block, ACTION field
   pickup / drop / use:
     pickup  nearest mineral within a pickup radius, only if storage < capacity
     drop    place the most recently picked mineral at the rover's position
     use     consume the nearest mineral ON THE GROUND -> battery 100%, +2 XP
             (this line used to read "one carried mineral", which contradicted
             ROVER-RESCUE-SPEC.md and the VEX documentation: a sample is used
             where it lies and cargo cannot be used. The spec wins.)
   Entering the base pad with minerals banks them all, +5 XP each, clears storage.
   pg_sensing_robot_minerals_stored and the storage capacity block report the obvious
   values.

5. systems/combat.ts
   - enemies within an aggro radius switch to pursuing, then attacking, draining battery
     per hit; pg_sensing_under_attack reads true while being hit and fires the
     pg_events_when_under_attack hat on the rising edge
   - pg_actions_interact_with_enemy (absorb radiation) targets the nearest enemy in
     absorb range, deals damage scaled by rover level, transfers radiation to battery at
     the absorb %, neutralizes at 0 hp and awards XP
   - tune so the documentation's advice is actually TRUE in the sim: attacking a much
     higher-level enemy should be a losing trade, and attacking near your own level with
     a full battery should be a winning one

6. pg_actions_standby — "standby until (N) % battery" fast-forwards via
   engine/clock.fastForward until battery drops to N%, advancing days rapidly. Cap
   simulated steps so a runaway standby cannot hang the tab. Render a visibly sped-up
   state while it runs.

7. Wire the remaining value blocks: pg_sensing_robot_battery_capacity, level, XP,
   enemy level, pg_sensing_enemy_charge, pg_sensing_under_attack, and both event hats.

Constraints:
- Every balance number lives in config.ts marked DOC or TUNABLE. The VEX documentation
  publishes the XP table and level thresholds but NOT battery drain, absorb-per-level,
  enemy HP, aggro radius or day length — those are all ours.

Tests: XP thresholds produce the right level; capacity gates pickup; using a mineral
restores battery and awards 2 XP; delivering 3 minerals awards 15 XP; each enemy type
awards its documented XP; battery 0 ends the mission; standby terminates and advances days.

Done when: a hand-written program can survive, collect, level up, fight and die, and the
50-day dialog appears and behaves correctly.
```

---

## Phase 9 — Rover Rescue telemetry payload

> Branch: `rr/phase-9-rr-telemetry`
> Small phase. Sits here because Phase 8 is where the outcome numbers first exist.

```
Make Rover Rescue emit outcome data indistinguishable from VEX's production logs.

1. Implement outcomeParameters() on the Rover Rescue PlaygroundDefinition, returning
   parameters BYTE-IDENTICAL to VEX's schema:

     { "days_explored":          <float>,
       "experience_gained":      <int>,
       "enemies_nuetralized":    <int>,      // [sic] — misspelled in VEX's own schema
       "minerals_consumed":      <int>,
       "battery_remaining":      <int 0-100>,
       "project_stopped_by_user": <bool> }

   Put a comment above the misspelled key pointing at docs/LOGGING-SPEC.md so nobody
   "fixes" it, and add a test asserting the exact spelling. Our learner-modelling
   pipeline keys on these names; a correction here is a silent data loss.

   Note that RoverRescue does NOT carry gps_x_position / gps_y_position, unlike
   CoralReefRescue and CastleCrasher. Do not add them to `parameters`.

2. Put our richer telemetry in the extension namespace ONLY — never by adding keys to
   `parameters`:

     playgroundData._invite = {
       schemaVersion: 1, finalLevel, mineralsDelivered, distanceTravelledMm,
       endReason, zonesVisited, bridgeCrossings, enemiesByType, seed }

   `seed` matters: with the deterministic simulation, seed + workspace XML is enough to
   replay a student's run exactly.

3. Add _invite.actorID and _invite.workspaceID to the envelope in telemetry/emitter.ts.
   Single-player sets actorID = studentID and workspaceID = the derived session id.
   This is the only multiplayer accommodation in this cycle. derived_session_id is
   {student}_S{NNN}, which assumes one student per workspace; when co-editing lands,
   every block event needs to say who did it and in which shared workspace. Two fields
   now, versus re-deriving sessions across a prior dataset later.

4. Audit the full Rover Rescue block vocabulary against docs/LOGGING-SPEC.md section 2.8.
   Every block the playground registers must use VEX's pg_* type ID with VEX's field
   names. Add a test enumerating registered types and asserting they are all either in
   the known VEX vocabulary or on an explicit, commented allow-list of ours.

5. Confirm pg_drivetrain_go_to_object carries the anddontwait_mutator field, alongside
   pg_drivetrain_drive_for and pg_drivetrain_turn_for from Phase 5. (The block itself is
   implemented in Phase 10; register the field now so the schema is stable.)

Constraints:
- No changes to telemetry/ internals beyond step 3. The playground contributes data only
  through outcomeParameters().

Tests: emitted Rover Rescue playgroundData matches a checked-in fixture exactly,
misspelling included; the _invite namespace never leaks into `parameters`.

Done when: a full Rover Rescue session emits a log whose block_type vocabulary and
outcome payload are indistinguishable from VEX's, modulo the _invite namespace.
```

---

## Phase 10 — The `go to` navigation block

> Branch: `rr/phase-10-navigation`
> **Highest-risk single feature. Keep it in its own PR.**

```
Implement pg_drivetrain_go_to_object — "go to [minerals/enemy/base]" — the one block
that needs real pathfinding.

Requirements:
- Target selection: nearest object of the chosen kind that the rover currently DETECTS
  (800mm) or SEES (1000mm). For `base`, the position is always known. With no qualifying
  target the block returns immediately without moving and prints a console note.
- Drives to the target autonomously, respecting set drive velocity and set drive timeout,
  stopping on arrival (a small arrival radius) or when the timeout expires.
- Must avoid obstacles and must NEVER enter the river — crossing to the far bank requires
  routing over a bridge.
- Must remain interruptible: stop driving, the Stop button, or a program error cancels
  cleanly.
- Must honour the anddontwait_mutator from Phase 5: when set, return immediately and let
  pg_sensing_drive_is_done report completion.

Implementation:
1. systems/navigation.ts. Build a navigation graph once at world creation: a coarse grid
   (500mm cells matching the field grid), cells marked blocked for river and obstacles,
   bridge cells explicitly walkable. Cache it; rebuild only when obstacles change.
2. A* over that grid, then string-pull / line-of-sight smoothing so the rover does not
   visibly zigzag between cell centres.
3. A steering layer following the smoothed path with the rover's real turn and drive
   kinematics — turn toward the next waypoint, drive, re-evaluate each tick.
4. Local avoidance for dynamic obstacles (enemies) the static graph does not know about.
5. Re-path when the target moves more than one cell (enemies move) or when the rover
   makes no progress for N ticks.

Constraints:
- Bound the search: cap expanded nodes and fall back to "drive toward the target with
  local avoidance" if the cap is hit, so the tab never freezes.
- Yield to the interpreter every tick exactly as drive-for does, so event hats and the
  Stop button still fire.

Tests: a path from the Base to a point on the far bank uses a bridge; a path around a
rock cluster is found; an unreachable target times out rather than looping; the same seed
produces the same path; the and-don't-wait variant returns before arrival.

Done when: `go to minerals` reliably crosses the map to the nearest mineral without
entering the river or wedging on rocks.
```

---

## Phase 11 — HUD, map views, mission end

> Branch: `rr/phase-11-hud`

```
Build the Rover Rescue playground window chrome to match the reference screenshots.

1. hud/Battery.tsx — a large percentage readout in a battery-shaped frame, filling and
   draining, green -> amber -> red. Bottom-left, beside Start/Reset.
2. hud/Strength.tsx — the "Absorb: N / Capacity: N" box to the right of the battery.
3. hud/LevelBox.tsx — "Level N - XP: current/next" with a filling progress bar, and
   "Mission Length N.N Days" beneath.
4. hud/MissionDialog.tsx — the day-50 panel with Continue / View Statistics / Get
   Certificate, at the bottom of the playground window, NON-MODAL so the program keeps
   running behind it.
5. hud/Stats.tsx — end-of-mission statistics: total XP, days survived, enemies
   neutralized by type, minerals used, minerals delivered, distance travelled, final
   level. Build it from the SAME serialisable object Phase 9 feeds to
   playgroundData._invite — one source, two consumers.
6. Replace "Get Certificate" with a local certificate view (name field plus a printable
   summary card). Do not link anywhere external.
7. Lower-right buttons: the three-state map toggle and the AI visualisation toggle,
   styled like the reference.
8. Game-over overlays per reason: battery depleted, fell in the river, ended by the player.

Constraints:
- HUD is React over the canvas, not drawn into it, so it stays crisp and accessible.
  Every control needs a title/aria-label.
- The HUD must not re-render every frame. Throttle tick-loop state pushed to HUD-only
  values to ~10Hz.
- Ocean Reef's HUD is unchanged; this is playground-specific through
  PlaygroundDefinition.hud.

Done when: the playground window matches the reference screenshots in layout and
information, at normal and maximized sizes.
```

---

## Phase 12 — Python generation, examples, docs

> Branch: `rr/phase-12-polish`

```
Finish the feature set.

1. Extend blocks/generators/python.ts to cover every Rover Rescue block, matching
   VEXcode VR's Python API naming as closely as the block names do: drivetrain.drive_for,
   rover.go_to, rover.absorb_radiation, rover.minerals_action, rover.sees, rover.detects,
   rover.battery_level. Show Python must work for a full Rover Rescue program.

2. Add three example projects loadable from an Examples menu, one per strategy in the VEX
   documentation:
     mineral-focused  standby + collect + use
     enemy-focused    check enemy level against own level, approach, absorb
     base-focused     fill storage to capacity, go to base, deliver, repeat
   Store as Blockly XML in playgrounds/rover-rescue/examples/. Selecting one must emit
   the menuSelect and newProject telemetry events.

3. Update README.md: both playgrounds, the ?playground= param, the new architecture,
   camera controls, block tables, and the telemetry env vars.

4. Update docs/ARCHITECTURE.md to describe what was actually built, recording any
   deviation from the plan with its reason.

5. Add docs/ADDING-A-PLAYGROUND.md so a third playground is a recipe.

Done when: all three examples run end to end, Show Python emits valid-looking code for
each, and the docs match the code.
```

---

## Phase 13 — Conformance harness

> Branch: `rr/phase-13-conformance`

```
Prove our logs are pipeline-compatible rather than assuming it.

1. scripts/telemetry-replay.mjs — a headless driver (Playwright against the pre-installed
   Chromium) running a scripted Rover Rescue session: join, pageLoad, login, open
   playground, build a program block by block, run, reset, edit, run again, play to
   mission end. Writes captured NDJSON to fixtures/telemetry/session-golden.ndjson with
   TELEMETRY_VEX_COMPAT=full.

2. tests/telemetry/conformance.test.ts — parse the generated NDJSON and assert structural
   equivalence with the real VEX sample:
   - top-level envelope keys exactly: id, eventType, classCode, studentID, project,
     raw_message, received_at
   - raw_message parses to an object whose key set matches one of the six observed
     variants in docs/LOGGING-SPEC.md
   - every emitted eventType is in the 21-value taxonomy
   - blockEventData matches the right variant for its event type
   - timestamps are ISO-8601 UTC with milliseconds and a trailing Z, monotonically
     non-decreasing within a session
   - the duplicated envelope fields equal their raw_message counterparts

3. A derivation smoke test. Implement just enough of the pipeline to prove the derived
   columns are computable from our output — a compatibility check, not a reimplementation:
   - derived_session_id via the 2700-second gap rule
   - run_id from runProject to projectEnd
   - micro_id assignment (every event gets exactly one)
   - episode segmentation into RUN / CODE / RESET / INACTIVE_PAUSE / POST_RUN_PAUSE
   Assert: no event lacks a micro_id; episode ranges are exclusive and non-overlapping;
   run_id is null outside run windows; a clean run has has_project_end=True and
   had_actions_while_running=False.

4. docs/LOGGING-CONFORMANCE.md — a short report: which of the 33 events-table columns our
   logs populate, which are null by design, and where we deliberately diverge (sparse
   workspace XML, the _invite namespace).

5. Size check: assert a 30-minute simulated session in sparse mode is under a tenth of
   the bytes of the same session in TELEMETRY_VEX_COMPAT=full mode. Record both numbers
   in the conformance doc.

Done when: the harness runs in CI, conformance tests pass, and the doc states plainly
what a modelling run would and would not see from our prototype.
```

---

## Appendix A — `.cursor/rules/project.mdc`

```md
---
alwaysApply: true
---

# INVITE VEXcode VR Prototyping — project rules

## Architecture
- engine/ is pure TypeScript: no React, no DOM, no imports from components/ or app/.
- playgrounds/ may import engine/ and blocks/, never components/ or app/.
- telemetry/ imports nothing from components/ or playgrounds/.
- components/ may import anything.
- All simulation state is in world millimetres. Pixels exist only in engine/camera.ts and
  inside render functions. Never store a position in pixels.
- A block's definition, its JavaScript generator and its Python generator live in the
  same file.

## Block naming
- Every playground block type uses VEX's namespace: pg_<category>_<action>. See
  docs/LOGGING-SPEC.md for the mapping. Standard Blockly/Scratch types (math_*,
  procedures_*, comment_text) keep their names.
- block_type is the only content-level signal our learner-modelling pipeline reads.
  Never rename one for readability.

## Telemetry
- The event schema in docs/LOGGING-SPEC.md is a compatibility contract with an external
  pipeline. Reproduce it exactly, including VEX's misspellings (enemies_nuetralized) and
  its one capitalised event type (PlaygroundChange). Do not "fix" them.
- Our own additions go under the _invite namespace, never by widening a VEX field.
- Telemetry failures never break the app. Wrap every emit in try/catch.

## Style
- TypeScript strict. No `any` in new code; if a Blockly type is unavoidable, define a
  minimal structural type.
- No file over 400 lines. Split before you exceed it.
- Prefer pure functions with explicit arguments over closures over React refs.
- Comments explain WHY. Delete commented-out code.

## Simulation
- tick(state, dtMs) is pure and deterministic given the same seed.
- Fixed timestep of 1000/60 ms, accumulated. Never scale physics by frame time.
- All randomness comes from engine/rng.ts, seeded per world. Never call Math.random().

## Constants
- Every gameplay number lives in the playground's config.ts, marked DOC (from the VEX
  documentation, do not change) or TUNABLE.
- Never hard-code a number from docs/ROVER-RESCUE-SPEC.md at a call site.

## Testing
- Every engine/, systems/ and telemetry/ module has a test file. UI gets smoke tests.
- Never change a characterisation, parity or conformance test to make new code pass. If
  behaviour must change, say so explicitly and update the test in its own commit.

## Process
- Work one phase from docs/CURSOR-PROMPT-PACK.md at a time.
- Run `npm run lint && npm run typecheck && npm test && npm run build` before calling a
  phase done.
- If a change exceeds ~1,500 lines of diff, stop and propose a split.
```

---

## Appendix B — Phase dependency map

```
0 baseline
└─ 1 engine
   └─ 2 playground contract ── Ocean Reef ported, pixels → mm
      └─ 3 decompose + pg_* rename ── highest structural risk
         ├─ 4 telemetry core ──────────────────────┐
         └─ 5 RR world + camera + anddontwait      │
            └─ 6 entities + spawning               │
               └─ 7 sensing + AI viz               │
                  └─ 8 game systems                │
                     └─ 9 RR telemetry payload ←───┘
                        ├─ 10 go-to navigation
                        └─ 11 HUD + mission end
                           └─ 12 python + examples + docs
                              └─ 13 conformance harness
```

Phases 10 and 11 are independent of each other and can run in parallel if you have the
appetite for two branches at once. Everything else is a strict chain.

## Appendix C — Where the risk actually is

| Phase | Why it's risky | Mitigation already in the prompt |
|---|---|---|
| 2 | The pixel→mm conversion touches every Ocean Reef behaviour | Parity test driving a scripted program |
| 3 | 5,600-line decomposition plus a global rename, at once | Commit per numbered step; XML migration test; characterisation tests must pass untouched |
| 8 | Largest gameplay surface, most tunables | Explicit split point into 8a/8b |
| 10 | Pathfinding that must not freeze the tab or drown the rover | Bounded search with a documented fallback |
| 13 | Discovering a schema mismatch after a classroom deployment | Runs in CI against a golden fixture |
```
