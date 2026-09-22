/**
 * Frozen `block_type` vocabulary. The learner-modelling pipeline keys on
 * these strings and nothing else — a rename is a silent data loss.
 *
 * Sources: docs/LOGGING-SPEC.md and docs/ROVER-RESCUE-LOGGING-PLAN.md §2.8.
 */

import { PROVISIONAL_BLOCK_TYPES, STANDARD_BLOCK_TYPES } from "./block-type-migration"

/**
 * VEX `pg_*` types this prototype registers (common set + Rover Rescue).
 * `PROVISIONAL_BLOCK_TYPES` and `INVITE_BLOCK_TYPES` are listed separately.
 */
export const VEX_BLOCK_TYPES = [
  "pg_actions_interact_with_enemy",
  "pg_actions_interact_with_minerals",
  "pg_actions_standby",
  "pg_control_break",
  "pg_control_comment",
  "pg_control_forever",
  "pg_control_if_elseif_else",
  "pg_control_if_then",
  "pg_control_if_then_else",
  "pg_control_repeat",
  "pg_control_repeat_until",
  "pg_control_stop_project",
  "pg_control_switch",
  "pg_control_wait",
  "pg_control_wait_until",
  "pg_control_while",
  "pg_drivetrain_drive",
  "pg_drivetrain_drive_for",
  "pg_drivetrain_go_to_object",
  "pg_drivetrain_set_drive_velocity",
  "pg_drivetrain_set_heading",
  "pg_drivetrain_set_rotation",
  "pg_drivetrain_set_timeout",
  "pg_drivetrain_set_turn_velocity",
  "pg_drivetrain_stop_driving",
  "pg_drivetrain_turn",
  "pg_drivetrain_turn_for",
  "pg_drivetrain_turn_to_heading",
  "pg_drivetrain_turn_to_rotation",
  "pg_events_broadcast",
  "pg_events_when_broadcasted",
  "pg_events_when_started",
  "pg_events_when_under_attack",
  "pg_looks_clear",
  "pg_looks_move_pen",
  "pg_looks_next_row",
  "pg_looks_print",
  "pg_looks_set_pen_color",
  "pg_looks_set_pen_width",
  "pg_looks_set_print_color",
  "pg_looks_set_print_precision",
  "pg_operator_and_or",
  "pg_operator_arithmetic",
  "pg_operator_atan2",
  "pg_operator_comparison",
  "pg_operator_contains",
  "pg_operator_convert",
  "pg_operator_join",
  "pg_operator_length",
  "pg_operator_letter_of",
  "pg_operator_math",
  "pg_operator_modulo",
  "pg_operator_not",
  "pg_operator_random",
  "pg_operator_range",
  "pg_operator_round",
  "pg_operator_string",
  "pg_sensing_ai_sees",
  "pg_sensing_ai_sees_distance",
  "pg_sensing_ai_smells",
  "pg_sensing_distance_found",
  "pg_sensing_enemy_charge",
  "pg_sensing_position",
  "pg_sensing_position_angle",
  "pg_sensing_robot_battery_capacity",
  "pg_sensing_robot_minerals_stored",
  "pg_sensing_under_attack",
  "pg_variables_set_variable",
] as const

/**
 * No name in VEX's sample export. Frozen INVITE names that follow the
 * `pg_sensing_robot_*` / `pg_events_when_*` families the published names
 * establish. Do not rename these for readability.
 */
export const INVITE_BLOCK_TYPES = [
  "pg_events_when_level_up",
  "pg_sensing_enemy_level",
  "pg_sensing_robot_exp",
  "pg_sensing_robot_level",
  "pg_sensing_robot_minerals_capacity",
] as const

export function knownBlockTypes(): Set<string> {
  return new Set<string>([
    ...STANDARD_BLOCK_TYPES,
    ...VEX_BLOCK_TYPES,
    ...PROVISIONAL_BLOCK_TYPES,
    ...INVITE_BLOCK_TYPES,
  ])
}
