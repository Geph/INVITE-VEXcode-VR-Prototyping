import { describe, expect, it } from "vitest"
import { AND_DONT_WAIT_BLOCK_TYPES } from "@/blocks/common/anddontwait"
import { INVITE_BLOCK_TYPES, knownBlockTypes } from "@/blocks/vocabulary"
import { installAllBlocks } from "@/blocks/registry"
import { roverRescueBlocks } from "@/playgrounds/rover-rescue/blocks"

describe("Rover Rescue block vocabulary", () => {
  it("registers only known VEX types or the commented INVITE allow-list", () => {
    const Blockly = { Blocks: {} as Record<string, unknown>, JavaScript: { forBlock: {} as Record<string, unknown> } }
    installAllBlocks(Blockly, { blocks: roverRescueBlocks })

    const allowed = knownBlockTypes()
    const types = Object.keys(Blockly.Blocks)
    expect(types.length).toBeGreaterThan(20)
    for (const type of types) {
      expect(allowed.has(type), type).toBe(true)
    }
  })

  it("keeps the INVITE allow-list explicit so a rename cannot hide in pg_*", () => {
    expect([...INVITE_BLOCK_TYPES]).toEqual([
      "pg_events_when_level_up",
      "pg_sensing_enemy_level",
      "pg_sensing_robot_exp",
      "pg_sensing_robot_level",
      "pg_sensing_robot_minerals_capacity",
    ])
  })

  it("registers pg_drivetrain_go_to_object with the anddontwait field", () => {
    const Blockly = { Blocks: {} as Record<string, unknown>, JavaScript: { forBlock: {} as Record<string, unknown> } }
    installAllBlocks(Blockly, { blocks: roverRescueBlocks })
    expect(Blockly.Blocks).toHaveProperty("pg_drivetrain_go_to_object")
    expect(AND_DONT_WAIT_BLOCK_TYPES).toContain("pg_drivetrain_go_to_object")
  })
})
