# VEX-Compatible Event Logging — Analysis & Implementation Plan

Companion to `ROVER-RESCUE-BUILD-PLAN.md`.
Sources analysed: `example.ndjson` (6.5 GB raw VEX event log), `data_dictionary.xlsx` (4-sheet processed-pipeline dictionary), and the `Mars-Rover` branch of `INVITE-VEXcode-VR-Prototyping`.

---

## 1. What logging looks like in our system today

**There is none.** No event stream, no session identity, no run outcomes, no persistence. Concretely, everything in the repo that touches "logging":

| What exists | Where | What it actually does |
|---|---|---|
| `@vercel/analytics` | `app/layout.tsx:3` | Pageview beacons only. No custom events are ever fired. |
| Two debug prints | `components/vex-workspace.tsx:3638, 3770` | `console.log("[v0] Navigate to predict")` — leftovers. |
| Collab server stdout | `scripts/collab-server.mjs:180-183` | Startup banner. Nothing per-event. |
| In-memory room XML | `scripts/collab-server.mjs` | `room.latestXml` holds the last workspace broadcast, in RAM, dropped when the room empties. Never written to disk. |
| `ProgramAnalysis` | `lib/code-review.ts` | Computes block counts, `hasLoop`, `usesDistanceSensor`, `hasMisplacedControlBody`, etc. — but only to render the AI Assistant panel. Discarded immediately. |
| Game state | React state in `vex-workspace.tsx` | Trash collected, battery, game-over reason. Reset wipes it. Never leaves the browser. |

**The good news is that two thirds of the plumbing already exists incidentally:**

- The workspace is already serialised to Blockly XML in three places (`vex-workspace.tsx:2280`, `:2314`, `use-blockly-collab.ts:132`) — the exact artefact VEX logs as `workspace_xml`.
- `use-blockly-collab.ts:328` already attaches a `workspace.addChangeListener` — the exact hook VEX's block events come from.
- `lib/blockly-context-menu.ts` already uses `Blockly.Events.setGroup()` around undo/duplicate operations, which is what makes burst detection (`delete_burst`, `add_block`) resolvable downstream.

So this is not a from-scratch build. It is a capture layer over hooks that are already firing.

**What is genuinely missing:** student/class/session identity (there is no auth or join flow at all), a run-boundary lifecycle (`runProject` → `projectEnd`), playground outcome payloads, an event envelope, a sink, and any notion of an offline buffer.

---

## 2. Making sense of the sample data and the schema

The two files sit at **different layers of the same pipeline**, which is the most important thing to notice:

```
example.ndjson  ──►  [your ingest + derivation pipeline]  ──►  4 tables described by
(raw, what the                                                  data_dictionary.xlsx
 client emits)                                                  (events / micro_actions /
                                                                 episodes / episode_features)
```

**You only have to emit the left-hand box.** Everything in the data dictionary marked `derived` is computed by your existing pipeline and comes for free once the raw layer matches.

### 2.1 The raw NDJSON envelope

One JSON object per line. Seven top-level keys, identical on every row:

```jsonc
{
  "id":          259870,             // global integer sequence from VEX's collector
  "eventType":   "menuOpen",         // duplicated from raw_message, for indexing
  "classCode":   "FPFVDH",           // duplicated
  "studentID":   "WREN-C102",        // duplicated
  "project":     "{...}",            // duplicated — JSON-encoded string
  "raw_message": "{...}",            // THE SOURCE OF TRUTH — JSON-encoded string
  "received_at": "..."               // server receipt time
}
```

`raw_message` is a JSON **string**, and the `project` inside it is a JSON string again, whose `workspace` value is an XML string with its own escaping. So the workspace XML is triple-escaped by the time it reaches disk. Any parser needs `json.loads` twice before it can touch the XML.

### 2.2 The `raw_message` payload

Twelve fields appear on every event; three more are conditional:

| Field | Always? | Notes |
|---|---|---|
| `eventType` | yes | 21 distinct values observed — taxonomy below |
| `classCode` | yes | e.g. `"FPFVDH"`; the dictionary warns of whitespace variants — strip on ingest |
| `studentID` | yes | anonymised as `BIRD-Cnnn` (`WREN-C102`, `CROW-C002`) — site prefix is a bird-species code |
| `sessionID` | yes | raw UUID; **the dictionary explicitly says not to trust it** — a page refresh mints a new one |
| `timestamp` | yes | ISO-8601 UTC with `Z`, millisecond precision |
| `programType` | yes | `Blocks` (37,497) / `Switch` (219) in the sample; `Python` exists in the dictionary |
| `playground` | yes | `RoverRescue` dominates the sample; also `CoralReefRescue`, `ArtCanvas`, `CastleCrasherPlus`, `GOMars` |
| `project` | yes | the full project blob — see below |
| `hasOrphans` | yes | boolean; **true on 60 % of events** — disconnected block stacks are the norm, not the exception |
| `switchBlockCount` | yes | 0 except on `convertBlock` / `convertEnd` |
| `errorMessage` | yes | null in 100 % of the sample |
| `blockEventData` | block events | 4 distinct shapes |
| `playgroundData` | outcome events | per-playground parameter bag |
| `menuName`, `menuItemSelected` | menu events | `edit`/`playgrounds`/`top`/`file`/`tools`/`examples`/`tutorials` |

The `project` blob carries `mode`, `hardwareTarget`, **`workspace` (full Blockly XML)**, `robotConfig`, `slot`, `platform` (`"PG"`), `sdkVersion`, `appVersion`, `minVersion`, `fileFormat`, `targetBrainGen`, `v5SoundsEnabled`, `downloadLanguage`, `aiVisionSettings`, `virtualSkillsYear`, `playground`, `monitorList`, `robotModel` (`"rover"`).

> **Why the file is 6.5 GB.** Every single event — including `menuOpen` and `pageLoad` — embeds a complete workspace XML snapshot, and embeds it *twice* (once in the envelope's `project`, once inside `raw_message.project`). The sample averages **~11 KB per event**. This is the one design choice I would not copy; §3.3 explains the alternative.

### 2.3 Event taxonomy

21 types, from a 300 MB sample (27,346 events). Grouped the way the episode classifier groups them:

| Group | Event types | Sample share |
|---|---|---|
| **Code edits** | `blockMoved` (12,477), `blockChanged` (2,880), `blockCreated` (2,563), `blockDeleted` (1,040) | 69 % |
| **Run boundaries** | `runProject` (1,939), `projectEnd` (1,852) | 14 % |
| **Resets** | `playgroundReset` (1,541), `PlaygroundChange` (142), `newProject` (1) | 6 % |
| **Playground UI** | `playgroundData` (799), `playgroundOpen` (168), `playgroundClosed` (121), `playgroundHidden` (120), `playgroundShow` (117) | 5 % |
| **Nav / UI** | `menuSelect` (1,296), `playgroundOpen`, `menuOpen` (152), `pageLoad` (61), `login` (52), `menuClose` (23) | 6 % |
| **Switch** | `convertBlock` (1), `convertEnd` (1) | <0.1 % |

Two gotchas: `PlaygroundChange` is the only event with a **capital** first letter, and `runProject` outnumbers `projectEnd` by ~5 % — runs that are interrupted never emit an end, which is exactly what `has_late_project_end` and `time_to_project_end_s` in `episode_features` exist to handle.

### 2.4 `blockEventData` — four shapes

```jsonc
// blockCreated
{"eventType":"create","blockID":"{OkbnVM(M]fIHe/QPe{M","blockType":"pg_control_wait_until"}

// blockChanged  (parameter edits — the richest signal in the whole log)
{"eventType":"change","blockID":"L^!]RHz6Uc*V~!:LS+io","blockType":"pg_looks_set_pen_width",
 "fieldName":"WIDTHS","oldValue":"extra_wide","newValue":"extra_thin"}

// blockMoved
{"eventType":"move","blockID":"{OkbnVM(M]fIHe/QPe{M","blockType":"pg_control_wait_until",
 "oldInfo":{"coordinate":{"x":102,"y":521}},
 "newInfo":{"parent":"cVqRzd6{3$^POh=bXi]v"}}

// blockDeleted  (note: NO blockType — the block is already gone)
{"eventType":"delete","blockID":"V=/F(^29H$A]TCIV}:._"}
```

`oldInfo`/`newInfo` carry either a free-floating `coordinate` or a `parent` block id. That distinction is what separates "dragged a block around the canvas" from "connected a block into a stack" — the difference between fiddling and composing, and a signal the `move` micro-action type depends on.

Note also that `blockMoved` on its own accounts for 45 % of all events. Blockly fires a move for every drag, so the micro-action layer's burst-collapsing is doing heavy lifting.

### 2.5 `playgroundData` — the outcome payload

This is the only place actual **task performance** is recorded, and the parameter set is per-playground:

```jsonc
// RoverRescue  (1,332 rows in the scanned 2 GB)
{"playground":"RoverRescue","parameters":{
  "days_explored": 0.3,
  "experience_gained": 2,
  "enemies_nuetralized": 0,     // ← [sic] misspelled in VEX's schema
  "minerals_consumed": 1,
  "battery_remaining": 5,
  "project_stopped_by_user": true }}

// CoralReefRescue
{"parameters":{"trash_collected":85,"coral_damaged":false,"battery_remaining":1,
               "project_stopped_by_user":true,"gps_x_position":-350,"gps_y_position":283}}

// CastleCrasherPlus  (note: logged as "CasteCrasherPlus" [sic] inside playgroundData)
{"parameters":{"weight_cleared":225,"elapsedtime":22.7,"difficulty_level":1,
               "project_stopped_by_user":false,"gps_x_position":340,"gps_y_position":2066}}
```

Three things worth flagging:

1. **`enemies_nuetralized` is misspelled in VEX's own schema.** If your pipeline keys on it, we must reproduce the typo exactly. Same for `CasteCrasherPlus` in the nested `playground` field.
2. **RoverRescue carries no `gps_x_position` / `gps_y_position`**, unlike CoralReef and CastleCrasher. If we want position in our clone we should add it under an extension namespace, not by silently widening VEX's parameter set.
3. There is no per-level, per-zone, or per-mineral detail — the whole 50-day mission collapses to six numbers. That is a real ceiling on what the existing modelling can see, and an argument for our extension namespace (§3.5).

### 2.6 The processed layer (`data_dictionary.xlsx`)

Four tables, each keyed to the next:

**`events`** (33 columns) — the flattened raw log plus derivations. The load-bearing ones:

- `derived_session_id` = `{student_id}_S{NNN}`, cut on a **2,700 s (45 min) inactivity gap**. The dictionary is emphatic that the raw `session_id` must not be used.
- `run_id` = `{student_id}_S{NNN}_run_{NNN}`, set on `runProject` and propagated to `projectEnd`. Null for 52 % of events.
- `playground_visibility` — state-tracked per session from open/close/hide/show events, carried on *every* event.
- `playground_primary` — the modal playground across a session; the recommended subsetting field.
- `micro_id` — every event belongs to exactly one micro-action.
- `block_event_type` / `block_id` / `block_type` — flattened out of `blockEventData`; 30–35 % null.
- Three columns (`total_block_count`, `active_block_count`, `orphan_block_count`) are **documented but absent from this release**.

**`micro_actions`** (11 columns) — event bursts collapsed into intent units. Compound types: `add_block`, `param_edit`, `move`, `delete_burst`. Atomic fallbacks: `atomic_code_edit`, `atomic_run`, `atomic_reset`, `atomic_nav_ui`, `atomic_noise`. Index range is **inclusive**.

**`episodes`** (16 columns) — `RUN`, `CODE`, `RESET`, `INACTIVE_PAUSE` (≥ 5 min), `POST_RUN_PAUSE`. Index range is **exclusive** — the dictionary calls this contrast out explicitly, so it has bitten someone before. Carries quality flags: `has_overlap` (117 flagged), `has_gap_before`/`has_gap_after` (201 each).

**`episode_features`** (19 columns) — the modelling feature vector. RUN episodes get `has_project_end`, `had_actions_while_running`, `has_late_project_end`, `time_to_project_end_s`, `playground_visible_at_start`, `playground_reset_before_run`, `playground_visibility_changed`. The dictionary defines a *clean run* as `has_project_end=True AND had_actions_while_running=False`.

### 2.7 What the model actually consumes — and the compatibility surface

Working backwards from the four tables, the derivation pipeline only reads **twelve** raw fields:

```
studentID · classCode · sessionID · timestamp · eventType · programType · playground
hasOrphans · switchBlockCount · errorMessage
blockEventData.{eventType, blockID, blockType, fieldName, oldValue, newValue, oldInfo, newInfo}
playgroundData.{playground, parameters}
```

Everything else — `appVersion`, `sdkVersion`, `aiVisionSettings`, `monitorList`, `targetBrainGen`, `virtualSkillsYear`, `v5SoundsEnabled` — is passenger data the pipeline never touches. That is a much smaller compatibility surface than the 6.5 GB suggests, and it means an exact clone is a couple of days of work rather than a couple of weeks.

**The one content-level signal is `block_type`.** Episode and micro-action classification is structural (timing and event type), but any question of the form *"is this student learning to use conditionals?"* or *"did they discover the `go to` block?"* resolves through `block_type` strings. Which leads to the biggest single finding:

### 2.8 Our block type IDs do not match VEX's — and this is the main compatibility risk

VEX namespaces every playground block `pg_<category>_<action>`. Our 65 blocks use bare names. Nothing in the pipeline would crash, but every content-level feature would silently read as an unknown vocabulary.

| VEX `block_type` | Our current type | Rover Rescue block |
|---|---|---|
| `pg_events_when_started` | `when_started` | when started |
| `pg_control_forever` | `forever` / `forever_loop` | forever |
| `pg_control_if_then` | `if_then` | if / then |
| `pg_control_if_then_else` | `if_then_else` | if / then / else |
| `pg_control_if_elseif_else` | `if_elseif_else` | if / else if / else |
| `pg_control_repeat` | `repeat_times` | repeat (n) |
| `pg_control_repeat_until` | `repeat_until` | repeat until |
| `pg_control_wait` | `wait_seconds` | wait (n) seconds |
| `pg_control_wait_until` | `wait_until` | wait until |
| `pg_drivetrain_drive` | `drive_simple` | drive [fwd/rev] |
| `pg_drivetrain_drive_for` | `drive_distance` | drive for |
| `pg_drivetrain_turn` | `turn_simple` | turn [L/R] |
| `pg_drivetrain_turn_for` | `turn_degrees` | turn for |
| `pg_drivetrain_stop_driving` | `stop_driving` | stop driving |
| `pg_drivetrain_set_drive_velocity` | `set_drive_velocity` | set drive velocity |
| `pg_drivetrain_set_turn_velocity` | `set_turn_velocity` | set turn velocity |
| `pg_operator_comparison` | `compare` | comparison |
| `pg_operator_and_or` | `boolean_and` / `boolean_or` | and / or |
| `pg_operator_not` | `boolean_not` | not |
| `pg_operator_random` | `random_int` | random |
| `pg_sensing_distance_found` | `distance_found_object` | distance found object? |
| `pg_variables_set_variable` | — | set variable |
| `pg_looks_set_pen_width` | `set_pen_width` | set pen width |
| **`pg_drivetrain_go_to_object`** | — (new) | go to object |
| **`pg_actions_interact_with_minerals`** | — (new) | minerals action |
| **`pg_actions_interact_with_enemy`** | — (new) | absorb radiation |
| **`pg_actions_standby`** | — (new) | standby until % battery |
| **`pg_sensing_ai_sees`** | — (new) | rover sees |
| **`pg_sensing_ai_smells`** | — (new) | rover **detects** |
| **`pg_sensing_ai_sees_distance`** | — (new) | rover distance |
| **`pg_sensing_under_attack`** | — (new) | under attack? |
| **`pg_sensing_robot_battery_capacity`** | — (new) | battery level |
| **`pg_sensing_robot_minerals_stored`** | — (new) | minerals in storage |
| **`pg_sensing_enemy_charge`** | — (new) | enemy radiation |
| **`pg_events_when_under_attack`** | — (new) | when under attack |
| **`pg_events_broadcast`** / `pg_events_when_broadcasted` | — (new) | broadcast / when I receive |
| `math_number`, `math_whole_number`, `math_number_string`, `math_positive_number`, `procedures_call`, `procedures_definition`, `procedures_prototype`, `comment_text` | partial | standard Blockly/Scratch types, unchanged |

**Three findings hiding in that table that affect the build plan:**

1. **`pg_sensing_ai_smells` is the "rover detects" block.** VEX's internal metaphor is that *sight* is a camera and *detect* is a smell — a 360° non-directional sense. That is a useful confirmation of the occlusion model in the build plan (sight occluded, detect not).
2. **`anddontwait_mutator` is a real field** on `pg_drivetrain_drive_for`, `pg_drivetrain_turn_for` and `pg_drivetrain_go_to_object`. VEX's motion blocks have an **"and don't wait"** mutator that makes them non-blocking. The build plan does not currently include it, and it changes the runtime contract for every motion block. **This should be added to Phase 4 and Phase 8.**
3. **`pg_events_broadcast` / `pg_events_when_broadcasted` exist** — Scratch-style message passing. Not in the VEX Rover blocks documentation page, but students are clearly using them (102 events). Worth adding to the common block set.

---

## 3. Recommendation

### 3.1 Shape of the thing

A `telemetry/` module in the engine, three layers, with the source layer bound to hooks that already exist:

```
telemetry/
  types.ts          VexEvent envelope, RawMessage, BlockEventData, PlaygroundData
  emitter.ts        emit(type, payload) → enrich → buffer → flush
  identity.ts       studentID / classCode / derived sessionID; persistence + rotation
  sinks/
    console.ts      dev
    indexeddb.ts    offline buffer, survives refresh, drains on reconnect
    http.ts         POST batched NDJSON to a collector
  sources/
    blockly.ts      workspace.addChangeListener → blockCreated/Moved/Changed/Deleted
    run.ts          runProject / projectEnd, run_id minting, run duration
    playground.ts   playgroundOpen/Closed/Hidden/Show/Reset/Change, playgroundData
    nav.ts          pageLoad / login / menuOpen / menuSelect / menuClose
  schema.ts         a validator that asserts every emitted event matches VEX's shape
```

`emitter.ts` is the only thing that knows about identity and the envelope; sources emit `(type, payload)` and stay ignorant. Sinks are pluggable so the same emitter works in dev, offline, and against a real collector.

### 3.2 Emit VEX's raw format verbatim — typos and all

This is the recommendation I would defend hardest. Compatibility beats cleanliness here, because the entire value of the exercise is that your existing modelling pipeline runs unchanged.

That means reproducing:

- the `raw_message` double-encoding, and the triple-escaped workspace XML inside it
- the duplicated `eventType` / `classCode` / `studentID` / `project` in the envelope
- `enemies_nuetralized` (misspelled)
- `PlaygroundChange` (capitalised, unlike every sibling)
- `hasOrphans`, `switchBlockCount`, `errorMessage` on every event, even when meaningless

It looks silly in code review. Add a comment pointing at this document and move on. The alternative is a translation shim you maintain forever, and shims are where compatibility quietly rots.

### 3.3 Do **not** embed workspace XML on every event

This is the one place to deliberately diverge. VEX's 11 KB/event is what turns 600 k events into 6.5 GB, and it is nearly all redundant — the workspace changes on maybe a third of events and is byte-identical on the rest.

**Emit instead:**

- full `project.workspace` XML on `runProject`, `projectEnd`, `newProject`, `PlaygroundChange`, and on a 60-second heartbeat
- `workspaceHash` (a cheap 32-bit hash) on **every** event, so a consumer can detect a change it does not have a snapshot for
- everything else identical

Then add a `TELEMETRY_VEX_COMPAT=full` build flag that rehydrates the XML onto every event. Use compat mode for pipeline conformance testing (§3.6), sparse mode for real classroom runs. You get a log roughly **15× smaller** with no loss the pipeline can see, since `workspace_xml` is marked `relevant_for_subsetting: no` in the dictionary and no derived column reads it.

### 3.4 Identity — the actual blocker

There is no auth, no student concept, and no class code in the app today, and none of the derived tables can be built without them. Recommended minimum, in rough order of effort:

1. A join screen: class code + display name → deterministic hash → `{SITE}-C{NNN}` anonymised ID, matching VEX's `BIRD-Cnnn` shape. Store in `localStorage`, expose a "not you?" reset.
2. `classCode` from the URL (`?class=FPFVDH`) so a teacher can hand out one link.
3. Raw `sessionID` = a UUID minted per page load — deliberately mimicking VEX's unreliable-on-refresh behaviour, since your pipeline already ignores it and re-derives sessions from the 45-minute gap rule.
4. Emit `login` on join and `pageLoad` on mount, so the session-start events your episode builder expects are present.

Worth deciding early whether the bird-prefix namespace should be shared with the real VEX dataset or held separate — mixing prototype and classroom IDs in one modelling run would be hard to undo.

### 3.5 Extend under a namespace, never by widening VEX's fields

RoverRescue's six outcome numbers are a thin view of a 50-day mission. Everything richer goes in a namespaced key the pipeline ignores:

```jsonc
"playgroundData": {
  "playground": "RoverRescue",
  "parameters": {                      // ← byte-identical to VEX
    "days_explored": 12.4, "experience_gained": 45, "enemies_nuetralized": 6,
    "minerals_consumed": 9, "battery_remaining": 62, "project_stopped_by_user": false
  },
  "_invite": {                         // ← ours; unknown keys are dropped downstream
    "schemaVersion": 1,
    "finalLevel": 3, "mineralsDelivered": 7, "distanceTravelledMm": 48210,
    "endReason": "battery", "zonesVisited": ["A","B","C"], "bridgeCrossings": 2,
    "enemiesByType": {"spider": 4, "serpentOrange": 2},
    "seed": 8412719
  }
}
```

Same treatment for the envelope: `_invite: { actorID, workspaceID, appBuild }`.

**On multiplayer** — you said keep it minimal, and I'd hold to that everywhere except one line. `derived_session_id` is `{student}_S{NNN}`, which assumes one student per workspace. When two people co-edit, every block event needs to say *who did it* and *which shared workspace it happened in*. Adding `_invite.actorID` and `_invite.workspaceID` now costs two fields and no design work; retrofitting them later means either re-deriving sessions across an entire prior dataset or throwing that data away. That is the cheapest insurance in this document.

### 3.6 Prove it with a conformance harness, not by eyeballing

The deliverable that actually de-risks this is a round-trip test:

1. Script a realistic Rover Rescue session in the prototype (join → open playground → build → run → reset → edit → run → mission end).
2. Capture the emitted NDJSON.
3. Run it through the **same** derivation pipeline that produced `data_dictionary.xlsx`.
4. Assert the four output tables have identical column sets and dtypes to the dictionary, and that spot-check invariants hold: every event has exactly one `micro_id`; episode index ranges are exclusive; `run_id` is null outside run windows; a clean run has `has_project_end=True, had_actions_while_running=False`.

Also worth building as a debug page: a live event inspector in the app (`?telemetry=debug`) showing the last 50 emitted events with their derived `run_id` and session id. Catching a wrong `eventType` at emit time is minutes; catching it after a classroom deployment is a lost dataset.

### 3.7 Two risks to name now

**Volume.** Blockly fires a `move` for every drag; `blockMoved` is 45 % of VEX's log. At 30 students × 45 minutes that is realistically 50–100 k events per class period. Coalesce `move` events for the same `blockID` within ~250 ms at the emitter, and let the micro-action layer do the rest. Do *not* silently drop them — the burst structure is signal.

**Order and loss.** NDJSON batched over HTTP arrives out of order and sometimes not at all. Give every event a monotonic client sequence number in `_invite`, and have the collector assign VEX's global `id`. Buffer in IndexedDB so a closed laptop lid does not lose the session.

---

## 4. Cursor prompts

Three new phases. Placement relative to `ROVER-RESCUE-BUILD-PLAN.md`: **L1 after Phase 3**, **L2 after Phase 7**, **L3 after Phase 10**. L1 deliberately lands before any Rover Rescue code so it is validated against Ocean Reef, where the behaviour is already known-good.

---

### Phase L1 — Telemetry core (run after Phase 3)

```
Add a VEX-compatible event logging layer. Read docs/LOGGING-SPEC.md (created in this
phase, from ROVER-RESCUE-LOGGING-PLAN.md sections 2 and 3) as the schema contract.
This phase wires telemetry to the EXISTING Ocean Reef playground only — no Rover
Rescue code.

1. docs/LOGGING-SPEC.md — copy sections 2.1 through 2.8 of ROVER-RESCUE-LOGGING-PLAN.md
   verbatim as the authoritative event schema, including the note that VEX's typos
   (enemies_nuetralized, PlaygroundChange) are reproduced deliberately.

2. telemetry/types.ts — exact TypeScript types for the envelope, RawMessage,
   BlockEventData (4 variants as a discriminated union on eventType), PlaygroundData,
   and the _invite extension namespace. No optional fields where VEX always sends one.

3. telemetry/identity.ts
   - join flow state: classCode (from ?class= or a form) + display name
   - deterministic anonymised studentID in VEX's {SITE}-C{NNN} shape, derived by
     hashing name+classCode; never store the display name in an emitted event
   - raw sessionID: a fresh UUID per page load (mimicking VEX's refresh behaviour)
   - persist to localStorage behind try/catch; expose a reset

4. telemetry/emitter.ts
   - emit(eventType, payload): stamps timestamp (ISO-8601 UTC, ms, trailing Z),
     identity, programType, playground, hasOrphans, switchBlockCount, errorMessage
   - builds raw_message by JSON.stringify of the payload, then wraps it in the
     envelope with the duplicated eventType/classCode/studentID/project fields
   - ring buffer + flush on: 50 events, 5 seconds, page hide, or beforeunload
   - coalesces consecutive blockMoved events with the same blockID inside 250ms into
     one event carrying the first oldInfo and the last newInfo
   - assigns a monotonic client sequence number into _invite.seq

5. telemetry/schema.ts — a validator run on every event in dev (and in tests) that
   asserts the emitted object matches the spec exactly: required keys present, no
   extra top-level keys, timestamp format, correct blockEventData variant for the
   event type. Throw loudly in dev, count-and-continue in production.

6. telemetry/sinks/ — console.ts (dev), indexeddb.ts (offline buffer that survives
   refresh and drains on reconnect), http.ts (POST newline-delimited batches to
   NEXT_PUBLIC_TELEMETRY_URL). Sink selection by env var; default console+indexeddb.

7. telemetry/sources/blockly.ts — attach a workspace.addChangeListener and map:
     Blockly.Events.BLOCK_CREATE  -> blockCreated  {eventType:"create", blockID, blockType}
     Blockly.Events.BLOCK_CHANGE  -> blockChanged  {eventType:"change", blockID, blockType,
                                                    fieldName, oldValue, newValue}
     Blockly.Events.BLOCK_MOVE    -> blockMoved    {eventType:"move", blockID, blockType,
                                                    oldInfo, newInfo}
     Blockly.Events.BLOCK_DELETE  -> blockDeleted  {eventType:"delete", blockID}
   oldInfo/newInfo are {coordinate:{x,y}} for free-floating positions and
   {parent:"<blockId>"} when connected — matching the sample data exactly. Note
   blockDeleted carries NO blockType. Ignore UI-only events (click, selected, viewport).
   IMPORTANT: this listener must not fire for changes applied by the collab layer —
   check use-blockly-collab.ts's Blockly.Events.disable() guard and respect it, or
   remote edits will be logged as local ones.

8. telemetry/sources/run.ts — emit runProject on Start and projectEnd on natural
   completion, error, or Stop. Mint run_id as {studentID}_S{NNN}_run_{NNN}. Do not
   emit projectEnd if the run was abandoned by a reset — matching VEX, where
   runProject outnumbers projectEnd by ~5%.

9. telemetry/sources/playground.ts — playgroundOpen / playgroundClosed /
   playgroundHidden / playgroundShow / playgroundReset / PlaygroundChange (capital P),
   and playgroundData on projectEnd carrying the playground's outcome parameters.
   Ocean Reef's parameters, matching the sample data exactly:
     trash_collected, coral_damaged, battery_remaining, project_stopped_by_user,
     gps_x_position, gps_y_position

10. telemetry/sources/nav.ts — pageLoad on mount, login on join, and
    menuOpen/menuSelect/menuClose with menuName and menuItemSelected.

11. Sparse workspace XML: emit the full project.workspace on runProject, projectEnd,
    newProject, PlaygroundChange and a 60s heartbeat. On every other event emit
    project WITHOUT the workspace string, plus _invite.workspaceHash (a 32-bit hash
    of the XML). Add a TELEMETRY_VEX_COMPAT=full env flag that restores XML on every
    event for conformance testing.

12. A debug inspector at ?telemetry=debug: a floating panel listing the last 50
    emitted events with eventType, timestamp, run_id, derived session id, and payload
    size, plus a "download NDJSON" button.

Constraints:
- telemetry/ imports nothing from components/ or playgrounds/. Sources are registered
  by the composition root in app/page.tsx.
- Zero telemetry code inside playground modules. A playground contributes outcome
  parameters through the PlaygroundDefinition contract only — add an optional
  `outcomeParameters(state): Record<string, unknown>` method to PlaygroundDefinition.
- Never log the student's display name, raw class roster data, or any free text a
  student typed except block field values.
- Telemetry failures must never break the app. Wrap every emit in try/catch.

Tests (tests/telemetry/):
- every event type produces an object that passes schema.ts
- blockMoved coalescing merges within 250ms and does not merge across blockIDs
- the envelope's duplicated fields always match raw_message
- identity is stable across reloads and changes when the class code changes
- the indexeddb sink drains in order after a simulated offline period
- a golden-file test: a scripted 30-event session serialises to NDJSON that matches
  a checked-in fixture byte-for-byte

Done when: playing an Ocean Reef session with ?telemetry=debug produces a complete,
schema-valid event stream, and npm run lint && typecheck && test && build are clean.
```

---

### Phase L2 — Rover Rescue block IDs and outcome payload (run after Phase 7)

```
Make the Rover Rescue playground emit block types and outcome data that match VEX's
production logs, so the same learner-modelling pipeline can consume our logs.

1. RENAME every Blockly block type to VEX's pg_* namespace, using the mapping table in
   ROVER-RESCUE-LOGGING-PLAN.md section 2.8. These become the canonical type strings
   throughout blocks/ and playgrounds/ — this is a rename, not a translation layer, so
   no mapping function should survive the change.
   Add a one-time migration in the workspace XML loader that rewrites old bare type
   names to pg_* names, so saved projects and the collab server's cached XML keep
   working. Cover it with a test.

2. Add the block types the sample logs show but our plan missed:
     pg_events_broadcast, pg_events_when_broadcasted   (Scratch-style messaging)
     pg_variables_set_variable and the variables category
     pg_sensing_ai_sees_distance, pg_sensing_enemy_charge,
     pg_sensing_robot_minerals_stored, pg_sensing_robot_battery_capacity
   Match VEX's field names exactly: OBJECT, ACTION, DIRECTION, UNITS, COMPARISON,
   CHECK, NUM, VELOCITY, TIMES, CONDITION, SUBSTACK, OPERAND / OPERAND1 / OPERAND2.
   Parameter sockets use the shadow types VEX uses: math_number, math_whole_number,
   math_number_string, math_positive_number.

3. Add the "and don't wait" mutator. VEX's motion blocks carry an
   `anddontwait_mutator` field (values "true"/"false") on pg_drivetrain_drive_for,
   pg_drivetrain_turn_for and pg_drivetrain_go_to_object. When true the block returns
   immediately instead of awaiting completion, and `drive is done?` becomes the way to
   wait. Implement it in the runtime and expose it as a right-click mutator on those
   three blocks. Update the Phase 8 navigation code so `go to object` honours it.

4. Emit playgroundData for Rover Rescue on projectEnd, with parameters BYTE-IDENTICAL
   to VEX's schema — including the misspelling:
     { "days_explored": <float>, "experience_gained": <int>,
       "enemies_nuetralized": <int>, "minerals_consumed": <int>,
       "battery_remaining": <int 0-100>, "project_stopped_by_user": <bool> }
   Add a comment above the misspelled key pointing at docs/LOGGING-SPEC.md so nobody
   "fixes" it. Add a test asserting the exact key spelling.

5. Put our richer telemetry in the extension namespace only, never by adding keys to
   `parameters`:
     playgroundData._invite = { schemaVersion, finalLevel, mineralsDelivered,
       distanceTravelledMm, endReason, zonesVisited, bridgeCrossings, enemiesByType,
       seed }
   `seed` matters: with the deterministic simulation from the build plan, seed +
   workspace XML is enough to replay a student's run exactly.

6. Add _invite.actorID and _invite.workspaceID to the envelope. Single-player sets
   actorID = studentID and workspaceID = derived session id. This is the only
   multiplayer accommodation in this cycle — it exists so the schema does not have to
   change when co-editing lands.

Constraints:
- No change to telemetry/ internals; this phase only supplies data through the
  PlaygroundDefinition.outcomeParameters contract added in L1.
- The pg_* rename must not change any user-visible block label.

Tests:
- every block type registered by the Rover Rescue playground starts with "pg_" or is
  one of the standard Blockly/Scratch types (math_*, procedures_*, comment_text)
- a saved pre-rename workspace XML loads correctly after migration
- the emitted Rover Rescue playgroundData matches a checked-in fixture exactly,
  misspelling included
- an "and don't wait" drive block returns before motion completes, and drive is done?
  reports false then true

Done when: a full Rover Rescue session emits a log whose block_type vocabulary and
outcome payload are indistinguishable from VEX's, modulo the _invite namespace.
```

---

### Phase L3 — Conformance harness (run after Phase 10)

```
Prove our logs are pipeline-compatible, rather than assuming it.

1. scripts/telemetry-replay.mjs — a headless driver (Playwright against the
   pre-installed Chromium) that runs a scripted Rover Rescue session: join, pageLoad,
   login, open playground, build a program block by block, run, reset, edit, run
   again, play to mission end. Writes the captured NDJSON to
   fixtures/telemetry/session-golden.ndjson with TELEMETRY_VEX_COMPAT=full.

2. tests/telemetry/conformance.test.ts — parse the generated NDJSON and assert
   structural equivalence with the real sample:
     - top-level envelope keys exactly: id, eventType, classCode, studentID, project,
       raw_message, received_at
     - raw_message parses to an object whose key set matches one of the 6 observed
       variants in section 2.2
     - every eventType emitted is in the 21-value taxonomy
     - blockEventData matches the right variant for its event type
     - timestamps are ISO-8601 UTC with milliseconds and a trailing Z, and are
       monotonically non-decreasing within a session
     - the duplicated envelope fields equal their raw_message counterparts

3. A derivation smoke test. Implement just enough of the pipeline to prove the derived
   columns are computable from our output — this is a compatibility check, not a
   reimplementation:
     - derived_session_id via the 2700s gap rule
     - run_id from runProject → projectEnd
     - micro_id assignment (every event gets exactly one)
     - episode segmentation into RUN / CODE / RESET / INACTIVE_PAUSE / POST_RUN_PAUSE
   Assert: no event lacks a micro_id; episode ranges are exclusive and non-overlapping;
   run_id is null outside run windows; a clean run has has_project_end=True and
   had_actions_while_running=False.

4. docs/LOGGING-CONFORMANCE.md — a short report: which of the 33 events-table columns
   our logs can populate, which are null by design, and which we deliberately diverge
   on (sparse workspace XML, the _invite namespace).

5. Size check: assert that a 30-minute simulated session in sparse mode is under
   1/10th the bytes of the same session in TELEMETRY_VEX_COMPAT=full mode, and record
   both numbers in the conformance doc.

Done when: the harness runs in CI, the conformance tests pass, and the doc states
plainly what a modelling run would and would not see from our prototype.
```

---

## 5. Amendments to `ROVER-RESCUE-BUILD-PLAN.md`

Three things the sample logs revealed that the build plan should absorb:

1. **Block type IDs become `pg_*` from the start.** Phase 4 onward should name blocks with VEX's namespace rather than renaming in L2. If you prefer to keep the phases as written, L2 does the rename — but doing it up front is strictly cheaper.
2. **The "and don't wait" mutator** belongs in Phase 4 (drivetrain) and Phase 8 (`go to object`). It changes the runtime contract for motion blocks from "always awaits" to "awaits unless mutated", which is much easier to build in than to retrofit.
3. **Broadcast / when-I-receive and a variables category** are in real student code and should join the common block set in Phase 3.

I can fold all three into the build plan directly if you want it kept as one document.

---

## Sources

- [computer://C:\Users\Geph\Desktop\Rescue Rover Clone Resources\example.ndjson](computer://C%3A%5CUsers%5CGeph%5CDesktop%5CRescue%20Rover%20Clone%20Resources%5Cexample.ndjson) — 6.5 GB raw VEX event log
- [computer://C:\Users\Geph\Desktop\Rescue Rover Clone Resources\data_dictionary.xlsx](computer://C%3A%5CUsers%5CGeph%5CDesktop%5CRescue%20Rover%20Clone%20Resources%5Cdata_dictionary.xlsx) — events / micro_actions / episodes / episode_features
- `Geph/INVITE-VEXcode-VR-Prototyping` @ `Mars-Rover` — `app/layout.tsx`, `components/vex-workspace.tsx`, `lib/use-blockly-collab.ts`, `lib/blockly-context-menu.ts`, `lib/code-review.ts`, `scripts/collab-server.mjs`
- [VR Rover — Robot-Specific Blocks](https://api.vex.com/vr/home/robots/rover/robot_specific_blocks.html)
