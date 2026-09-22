# Testing checklist

A working research-prototype checklist, consolidated on 2026-09-22 from the
[Rover build plan](ROVER-RESCUE-BUILD-PLAN.md), [Cursor prompt pack](CURSOR-PROMPT-PACK.md),
[block audit](BLOCK-AUDIT.md), [mineral-use question #3](https://github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/3),
and the Castle/planning change records. Historical phase acceptance criteria are
not proof of implementation. This checklist replaces neither the audit nor the
original reference questions.

## How to use it

For each session, record commit/build URL, date, tester, browser/device, playground,
Basic/Advanced level, seed if known, and exact saved block program. Mark each case
Pass / Fail / Not run / Blocked; attach observations and a short reproduction.
Record prototype results separately from observations in official VEXcode VR.

**Evidence labels below:** Auto = passing automated coverage of representative
behavior; Browser = manually observed in this work session; Pending = still needs
that check; Known gap = unresolved implementation issue. None implies full VEX parity.
P0 = before a research session; P1 = regression/fidelity follow-up.

## Release and learner flow (P0)

| ID | Steps and expected result | Existing evidence / next check |
| --- | --- | --- |
| REL-01 | Run lint, typecheck, `npm test -- --coverage`, build. Require all to pass and `out/index.html` to exist. | Auto: 336 tests in 51 files; 99.32% line coverage in configured engine/runtime scope, not the whole app. |
| REL-02 | Open deployed Castle URL and reload. Assets, editor, Sensing, Get Help and a short program work without a blank screen. | Pending on each deployment. |
| REL-03 | Export a workspace, reload, import it, run again. Preserve field values, stack connections and `pg_*` identifiers; check older saved projects too. | Auto migration checks exist; end-to-end file round trip pending. |
| PLAN-01 | Get Help → Make a plan. Castle, robot start, obstacles and plow appear on canvas; Submit stays disabled until a path is drawn. | Browser: Castle drawing and submit verified. |
| PLAN-02 | Draw → Submit. Prompt asks to assemble blocks. Run a deliberately different route. Blue drawing remains; orange dashed line follows actual travel, not the code's ideal path. | Browser: two complete cycles verified. |
| PLAN-03 | Close Help during a submitted run. On completion, Plan reopens with both paths. Draw another plan and run; prior trace must not leak into the new comparison. | Browser: verified. |
| PLAN-04 | Stop mid-drive; repeat with Reset mid-drive. Review should end at travelled position, without a line teleporting to start. Try Step/Resume too. | Auto reset-transition check; interactive Stop/Reset/Step combinations pending. |
| PLAN-05 | Change playground, refresh page, and change Castle difficulty. Confirm and record plan lifetime. Currently refresh/playground change clears it; plans are not saved to research logs. | Pending; decide whether persistence is needed for the study. |
| UI-01 | Verify no header Plan or separate Predict. Investigate contains movement strategies and useful blocks. Compare says “Compare to previous versions of your code”. | Browser: verified. |
| UI-02 | Resize to classroom laptop size; try mouse, trackpad and touch drawing. Long labels wrap, sidebar scrolls, playground does not cover canvas, controls stay reachable. Keyboard focus remains visible. | Browser: desktop wrapping/overlap verified; target classroom devices/touch/keyboard pending. |

## Castle gameplay and movement (P0 unless marked)

| ID | Steps and expected result | Existing evidence / next check |
| --- | --- | --- |
| CC-01 | Start/Reset Basic and Advanced. Robot starts at (1014, 50) mm facing left; reset restores castle, score, timer and detached plow while keeping blocks. | Auto start/reset; Browser retry/reset. Advanced manual pass pending. |
| CC-02 | Drive 200 mm, then reverse 200 mm in clear space. Repeat with equivalent inches and normal/maximized window. Displacement agrees with units and is independent of display scale. | Auto world-distance/scale checks. Manual reference comparison pending. |
| CC-03 | Compare identical drives/turns at 50% and 100%. Zero speed stays still; Stop cancels. Timing reflects the requested doubled prototype speed. | Auto timing; manual zero-speed cancel and timeout pending. |
| CC-04 | Turn right 270°, 360°, 720° and left 450°. Observe full angle/direction. Set heading/rotation without moving, then turn to that reference. GPS must still report physical heading. | Auto regressions; full animation/reference comparison pending. |
| CC-05 | Drive the robot's front into the plow; try approaching backward and while idle. Attachment occurs by front contact during a run, needs no magnet, widens pushes and resets on a new run. | Auto pickup/idle/backward/reset/blade-edge tests. Official pickup route/animation pending. |
| CC-06 | Push walls, tower, keep and roof; test glancing and secondary contacts. Rocks/Advanced trees stay fixed. Repeated contact must not create sudden large jumps. | Auto contact/sweep/momentum checks; per-piece visual fidelity pending. |
| CC-07 | Push one piece off the hex; note score delta. Revisit it: score only once. Push several while falling into water: same-step cleared pieces still count. | Auto scoring regression. Official per-piece masses and precise score trigger remain unknown. |
| CC-08 | End by water, Stop and natural completion. Timer stops; debris settles, results show final kg and appropriate reason. Retry restores state. Certificate downloads and displays score. | Browser prior water/complete/retry checks; downloaded certificate and Stop outcome pending. |
| CC-09 (P1) | Repeat a fixed route at normal/maximized size and under CPU throttling. Compare path, score and outcome; hide/minimize playground mid-run too. | Pending browser matrix; Castle fixed-step integration exists, not a cross-device equivalence guarantee. |

## Block functionality (P0 for blocks used in the study)

Use the [audit](BLOCK-AUDIT.md) for full reproductions and issue #5. Do not treat
“generator runs without throwing” as proof a block has the right effect.

| ID | Check / expected result | Status |
| --- | --- | --- |
| BLK-01 | For each block in the study's allowed palette, test a normal value, boundary, invalid/empty input where editable, Stop and Reset. Compare result/console/sensors, not only generated text. | Auto generator smoke across all playgrounds; full behavioral matrix pending. |
| BLK-02 | Switch: run drive_for, turn_for, print and repeat; unsupported Python should identify the line, not silently succeed. | Auto; supported subset documented in the planning change record. Full Python is a known gap. |
| BLK-03 | Plain drive/turn continue until stopped/superseded. | Known gap: finite 200-mm/90° commands. |
| BLK-04 | Event-only hats stay active; non-waiting/broadcast work finishes consistently. Stop cancels queued work; timeout and drive-is-done cover turns. | Known gaps in lifecycle and drivetrain tracking. |
| BLK-05 | Castle GPS X/Y/angle and mm/inches match displayed motion. Test imported bumper, distance, eye and magnet blocks separately. | GPS repaired/Auto; remaining Castle APIs are known gaps. |
| BLK-06 | Pen trail is visible in each playground; selected eye sensor changes readings; variables can be read after assignment. | Known Castle/Rover pen, Reef eye and variable-reporter gaps. |
| BLK-07 (P1) | Repeat seeded trials with random blocks. Define whether exact replay is required. | Known gap: random operator is unseeded. |

## Retained Rover and Ocean checks (P1; P0 when used in study)

| ID | Check / expected result | Status |
| --- | --- | --- |
| RR-01 | In official VR: pick up a mineral, move away, use it; record cargo/battery/XP before and after. Then drop/use and deliver cargo to Base. | Retains issue #3 verbatim question: ground-only versus carried use is unresolved. Prototype assumes ground-only. |
| RR-02 | Test minerals capacity, drop/use, battery depletion, absorb, XP/level thresholds, standby, day-50 continuation and end stats. | Representative automated systems tests; end-to-end reference pass pending. |
| RR-03 | Drive across each bridge and into river elsewhere. Test sensing at range/cone boundaries, obstacles, pan/zoom/follow and minimap consistency. | Representative Auto tests; browser/reference pass pending. |
| RR-04 | Go to mineral/enemy/Base must navigate around obstacles and over a bridge. | Known gap: go-to API is empty; do not mark historical navigation acceptance as done. |
| OR-01 | Reef 2000-mm field, collection, coral/battery endings, magnet and sensors behave consistently across window sizes. | Representative Auto parity/scale tests; browser regression pending. |
| OR-02 | Check north/Y position convention against official VR and old saved projects before changing it. | Known gap: Reef retains legacy +Y-down. |

## Research and collaboration checks (P0 before data collection)

- [ ] Two actual classroom devices: join same room, edit/move/delete/undo concurrently,
  disconnect/rejoin and verify final workspace convergence. Distinct rooms stay separate.
- [ ] On the deployed HTTPS site, verify a configured secure WebSocket relay is
  reachable. GitHub Pages alone does not deploy it; report multiplayer as blocked
  if no relay is available, not as a passing UI check.
- [ ] Export a synthetic session's events; verify run IDs, timestamps, block IDs,
  playground names and end outcomes against [LOGGING-SPEC.md](LOGGING-SPEC.md).
  Preserve external spellings; no missing/duplicate events across reset and reconnect.
- [ ] Confirm persistence/collaboration measures and the planned analysis with the
  research team. Identify which help/plan/partner interactions need recording;
  the new drawing/actual-path cycle currently has no dedicated telemetry.
- [ ] Use anonymized observations to check whether learners understand Submit,
  “assemble blocks”, both path colors and how to try again. Record confusion/help
  requests and partner turn-taking without equating task success with learning.
- [ ] Agree which remaining known gaps are acceptable for the specific study task.
  A green software build is not approval of research readiness.

## Result record template

```text
Case ID / date / tester:
Commit and URL / browser and device:
Playground / difficulty / seed / saved program:
Steps and expected result:
Observed result / Pass, Fail, Not run, or Blocked:
Evidence (clip timestamps, screenshot, synthetic log):
Prototype defect vs official-reference uncertainty:
Issue link / next action:
```
