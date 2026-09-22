# 2026-09-22 — Plan cycle and five block repairs

## Request and status

Explain/fix the five documented expected failures, verify plow pickup, and replace
separate prediction/planning controls with a repeatable drawing → blocks → run →
comparison cycle. These changes are local on `Mars-Rover`, not committed or pushed.
The broader audit remains open in [issue #5](https://github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/5).
A [follow-up status comment](https://github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/5#issuecomment-5783018724) records these local repairs and remaining limits.

## Runtime changes

- `engine/motion.ts` permits 0% speed. A nonzero move at zero speed has infinite
  duration, so the animation stays still until canceled; a zero-distance command
  still completes. Drive timeout can cancel a zero-speed drive. Active motions
  still capture velocity at command start; changing velocity from another stack
  does not retime an already-running animation.
- `program-robot-api.ts` keeps independent per-run heading and rotation offsets.
  Setters no longer change the physical pose. Turn-to-heading uses the shortest
  signed angle in the re-zeroed heading frame. Relative turns and turn-to-rotation
  preserve total angle. `useRobotAnimation.ts` interpolates unwrapped rotation.
- Castle GPS reads the physical host pose, supports X/Y in mm/inches and a wrapped
  position angle. The two reporters are available in Castle's Sensing category.
  Other Castle sensor APIs are still listed as unresolved in the audit.
- Switch calls `robot.runSwitchCode` instead of generating a comment. The explicit
  adapter in `engine/switch-python.ts` validates an entire Switch block before
  executing it through the host API. No dependency or remote runtime was added.

### Switch scope

Supported: drivetrain drive/drive_for, turn/turn_for, turn_to_heading/rotation,
set_drive_velocity/turn_velocity, set_heading/rotation, set_timeout and stop;
wait; print/brain.print/new_line/clear; pen.move/set_pen_color; stop_project.
Arguments are numeric/string/boolean literals or listed VEX constants. Drive/turn
for accept `wait=False`. Constant-count `for i in range(3):` repeats use four-space
indentation and yield to Stop each iteration. The index variable is not available
as an expression. A repeat is limited to 10000 iterations. Blank lines/comments
and `pass` are accepted.

This is **not full Python**. Imports, expressions, variable assignment, sensor
expressions, arbitrary control flow and libraries produce a line-numbered error.
Plain drive/turn inherit the existing finite 200-mm/90° behavior; that separate
audit item is still open. The tooltip discloses supported syntax.

## Planning and menus

- Removed the inert header Plan button and the separate Predict menu option.
  Number shortcuts now match the five remaining help choices.
- Make a Plan opens only a map for drawing a path. Castle uses the actual renderer
  and a fresh map at the selected level, including castle pieces, rocks and plow.
- Submit locks the blue drawing and prompts the learner to assemble blocks.
  Actual robot positions feed an orange dashed trace during the next run.
  Completion/Stop opens the comparison with an invitation to draw a new plan.
- `AIAssistant` owns state independently of its rendered menu/window. Closing Help
  or visiting another menu preserves the plan and tracking. `plan-cycle.ts` owns
  transitions; `plan-panel.tsx` renders drawing and comparison. The original
  prediction renderer supplies shared projection/backdrop helpers.
- Actual samples are world mm, separated by at least 2 mm; drawn strokes use fixed
  320×260 preview pixels. Reset's teleport is excluded from the actual trace.
  A fresh plan clears the old drawing/trace. Page reload or playground change
  clears this session-local data; persistence/research logging was not added.
- Moved movement strategies and useful-block guidance to Investigate. Renamed the
  comparison option to “Compare to previous versions of your code”. Menu buttons
  wrap and grow vertically. The floating playground shifts beside the open sidebar
  so it cannot cover the drawing canvas on the tested desktop viewport.

## Plow behavior (verified, not changed)

During a running mission, the robot's front probe (75 mm ahead of its center) must
come within 85 mm of the plow at `(145, 1120)` mm. Pickup is automatic: no magnet
command is involved. The attached blade adds contact samples across a 230-mm width,
105 mm ahead of the robot. Reset/new Castle runs detach it. Tests cover front versus
back approach, no pickup while idle, reset, and pushing with the blade's outer edge.

## Validation

- 51 test files, **336 passing tests**, zero expected failures. The original five
  `.fails` cases are ordinary regressions. Added offset/full-turn, executable Switch,
  unsupported-syntax, and plan-cycle/reset regressions.
- Updated the two historical tests that expected the obsolete 5% minimum velocity;
  this is the requested intentional behavior change, not a hidden baseline update.
- Typecheck, lint and production static-export build passed.
- In-app browser: drew/submitted a Castle plan, ran the existing learner program,
  verified blue/orange comparison, drew/submitted a second plan, closed Help, ran
  again and verified Plan reopened with the second comparison. Verified the longer
  Compare label wraps onto two lines and the header Plan/Predict controls are absent.
- The learner's block program was not modified. Automated plow tests passed; no
  manual plow route was substituted into their workspace. Coverage gate not run.

## Remaining limits

The full audit is not closed. In particular, continuous motion, other Castle sensors,
full Python, pen rendering and event/queued-command lifetime still need work. Existing
Castle art, masses and physics remain approximations documented in the earlier record.
