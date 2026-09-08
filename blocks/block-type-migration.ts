/**
 * Rewrites pre-pg_* workspace XML so saved projects and collab snapshots
 * keep working after the block_type rename.
 *
 * Old names live only in this map (and in the logging docs that define it).
 */

/** Standard Blockly/Scratch types that keep their names. */
export const STANDARD_BLOCK_TYPES = [
  "math_number",
  "math_whole_number",
  "math_number_string",
  "math_positive_number",
  "procedures_definition",
  "procedures_call",
  "procedures_prototype",
  "comment_text",
] as const

/**
 * Follow VEX's pg_* convention but were not observed in the production log
 * sample. Confirm or correct these on the next real log export.
 */
export const PROVISIONAL_BLOCK_TYPES = [
  "pg_sensing_object_distance",
  "pg_sensing_ai_sees_direction",
  "pg_sensing_ai_sees_location",
  "pg_sensing_drive_is_done",
] as const

/** Bare type → VEX `pg_*` type. Longer keys first when applying as text. */
export const LEGACY_BLOCK_TYPES: Record<string, string> = {
  rover_distance_found_object: "pg_sensing_distance_found",
  rover_object_distance: "pg_sensing_object_distance",
  rover_direction: "pg_sensing_ai_sees_direction",
  rover_distance: "pg_sensing_ai_sees_distance",
  rover_location: "pg_sensing_ai_sees_location",
  rover_detects: "pg_sensing_ai_smells",
  rover_sees: "pg_sensing_ai_sees",
  distance_found_object: "pg_sensing_distance_found",
  distance_in_units: "pg_sensing_distance",
  set_drive_velocity: "pg_drivetrain_set_drive_velocity",
  set_turn_velocity: "pg_drivetrain_set_turn_velocity",
  set_drive_heading: "pg_drivetrain_set_heading",
  set_drive_rotation: "pg_drivetrain_set_rotation",
  set_drive_timeout: "pg_drivetrain_set_timeout",
  drive_distance: "pg_drivetrain_drive_for",
  drive_simple: "pg_drivetrain_drive",
  drive_is_done: "pg_sensing_drive_is_done",
  turn_to_heading: "pg_drivetrain_turn_to_heading",
  turn_to_rotation: "pg_drivetrain_turn_to_rotation",
  turn_degrees: "pg_drivetrain_turn_for",
  turn_simple: "pg_drivetrain_turn",
  stop_driving: "pg_drivetrain_stop_driving",
  when_started: "pg_events_when_started",
  when_bumper: "pg_events_when_bumper",
  if_elseif_else: "pg_control_if_elseif_else",
  if_then_else: "pg_control_if_then_else",
  if_then: "pg_control_if_then",
  repeat_until: "pg_control_repeat_until",
  repeat_times: "pg_control_repeat",
  forever_loop: "pg_control_forever",
  wait_seconds: "pg_control_wait",
  wait_until: "pg_control_wait_until",
  boolean_not: "pg_operator_not",
  boolean_and: "pg_operator_and_or",
  boolean_or: "pg_operator_and_or",
  random_int: "pg_operator_random",
  set_pen_width: "pg_looks_set_pen_width",
  set_pen_color: "pg_looks_set_pen_color",
  move_pen: "pg_looks_move_pen",
  range_compare: "pg_operator_range",
  math_arithmetic: "pg_operator_arithmetic",
  math_function: "pg_operator_math",
  atan2_function: "pg_operator_atan2",
  round_number: "pg_operator_round",
  text_letter_at: "pg_operator_letter_of",
  text_contains: "pg_operator_contains",
  text_length: "pg_operator_length",
  text_string: "pg_operator_string",
  text_join: "pg_operator_join",
  convert_type: "pg_operator_convert",
  switch_code: "pg_control_switch",
  while_loop: "pg_control_while",
  break_block: "pg_control_break",
  stop_project: "pg_control_stop_project",
  comment_block: "pg_control_comment",
  print_text: "pg_looks_print",
  set_cursor_next_row: "pg_looks_next_row",
  clear_all_rows: "pg_looks_clear",
  set_print_precision: "pg_looks_set_print_precision",
  set_print_color: "pg_looks_set_print_color",
  energize_magnet: "pg_magnet_energize",
  bumper_pressed: "pg_sensing_bumper_pressed",
  eye_is_near: "pg_sensing_eye_near",
  eye_detects_color: "pg_sensing_eye_color",
  eye_brightness: "pg_sensing_eye_brightness",
  position_value: "pg_sensing_position",
  position_angle: "pg_sensing_position_angle",
  compare: "pg_operator_comparison",
  modulo: "pg_operator_modulo",
  forever: "pg_control_forever",
  repeat: "pg_control_repeat",
  wait: "pg_control_wait",
}

const AND_OR_OP: Record<string, string> = {
  boolean_and: "AND",
  boolean_or: "OR",
}

export function migrateBlockType(type: string): string {
  return LEGACY_BLOCK_TYPES[type] ?? type
}

export function migrateWorkspaceXml(xmlText: string): string {
  let out = xmlText
  for (const [oldType, op] of Object.entries(AND_OR_OP)) {
    const open = new RegExp(`<(block|shadow)([^>]*\\btype="${oldType}"[^>]*)>`, "g")
    out = out.replace(open, `<$1$2><field name="OP">${op}</field>`)
  }
  return out.replace(/\btype="([^"]+)"/g, (full, type: string) => {
    const next = migrateBlockType(type)
    return next === type ? full : `type="${next}"`
  })
}

export function migrateWorkspaceDom(dom: Element): void {
  for (const node of Array.from(dom.querySelectorAll("block[type], shadow[type]"))) {
    const oldType = node.getAttribute("type")
    if (!oldType) continue
    const next = migrateBlockType(oldType)
    if (next !== oldType) node.setAttribute("type", next)
    const op = AND_OR_OP[oldType]
    if (op && !Array.from(node.children).some((child) => child.tagName.toLowerCase() === "field" && child.getAttribute("name") === "OP")) {
      const field = dom.ownerDocument?.createElement("field") ?? document.createElement("field")
      field.setAttribute("name", "OP")
      field.textContent = op
      node.insertBefore(field, node.firstChild)
    }
  }
}
