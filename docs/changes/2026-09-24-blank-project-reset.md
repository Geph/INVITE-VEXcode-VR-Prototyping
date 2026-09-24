# 2026-09-24 — Make blank-project reset visible

## Purpose and status

Fix the local `main` workspace reset after a learner deleted the “when started” hat. This change is local and not yet committed or deployed.

## Before and after

File → New blank project cleared the workspace and recreated the hat, but kept Blockly's previous pan and zoom. The new hat could be off screen, making the action appear broken. The command now restores 100% zoom and the initial top-left view, where the hat is visible beside the floating playground. It also stops and resets the current playground run, clears run output, and returns from Python to Blocks view.

## Implementation map

- `components/workspace/FileMenu.tsx` clears blocks, creates the hat, and resets Blockly's view.
- `components/workspace/WorkspaceHeader.tsx` passes the new-project callback through the header.
- `components/workspace/VexWorkbench.tsx` resets the active playground session and code view after confirmation.

## Evidence and decisions

Blockly's `centerOnBlock` placed the hat beneath the floating playground on the tested desktop viewport. `scroll(0, 0)` restores the same top-left placement used by a fresh workspace. The existing confirmation remains in place because the action discards unsaved blocks.

## Validation

Typecheck and ESLint pass. In the Castle browser preview, accepting New blank project leaves exactly one visible “when started” block at the left of the workspace and resets the Castle HUD clock and score.

## Open work and continuation

The new-project command resets the active playground; it does not change the selected playground or preserve unsaved blocks. Verify any future workspace layout change keeps the hat visible when a playground window is open.
