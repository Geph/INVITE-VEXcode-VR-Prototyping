/**
 * Every generated loop body ends with this so the browser can paint and the
 * runtime gets a chance to observe a stop request. Without it a loop whose body
 * is all synchronous blocks freezes the tab.
 */
export const LOOP_YIELD = "await robot.wait(0);\n"

/** Block types that create a JS loop, so `break` is legal inside them. */
export const LOOP_BLOCK_TYPES = new Set([
  "pg_control_repeat",
  "pg_control_forever",
  "pg_control_repeat_until",
  "pg_control_while",
])
