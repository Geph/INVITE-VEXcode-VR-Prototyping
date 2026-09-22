import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  LEGACY_BLOCK_TYPES,
  STANDARD_BLOCK_TYPES,
  migrateWorkspaceXml,
} from "@/blocks/block-type-migration"
import { installAllBlocks } from "@/blocks/registry"
import { oceanReefBlocks } from "@/playgrounds/ocean-reef/blocks"
import { roverRescueBlocks } from "@/playgrounds/rover-rescue/blocks"

const STANDARD = new Set<string>(STANDARD_BLOCK_TYPES)

describe("live block type registry", () => {
  it("registers only pg_* types or the allowed standard Blockly types", () => {
    const Blockly = { Blocks: {} as Record<string, unknown>, JavaScript: { forBlock: {} as Record<string, unknown> } }
    installAllBlocks(Blockly, { blocks: [...oceanReefBlocks, ...roverRescueBlocks] })

    const types = Object.keys(Blockly.Blocks)
    expect(types.length).toBeGreaterThan(20)
    for (const type of types) {
      const allowed = type.startsWith("pg_") || STANDARD.has(type)
      expect(allowed, type).toBe(true)
    }
  })
})

describe("pre-rename workspace XML migration", () => {
  it("rewrites a checked-in pre-pg_* project to current type names", () => {
    const fixture = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../fixtures/pre-rename-workspace.xml"),
      "utf8",
    )
    const migrated = migrateWorkspaceXml(fixture)

    expect(migrated).toContain('type="pg_events_when_started"')
    expect(migrated).toContain('type="pg_drivetrain_drive_for"')
    expect(migrated).toContain('type="pg_control_forever"')
    expect(migrated).toContain('type="pg_control_wait"')
    expect(migrated).toContain('type="pg_operator_and_or"')
    expect(migrated).toContain('<field name="OP">AND</field>')
    expect(migrated).toContain('<field name="OP">OR</field>')
    expect(migrated).toContain('type="pg_sensing_bumper_pressed"')
    expect(migrated).toContain('type="pg_sensing_distance_found"')
    expect(migrated).toContain('type="math_number"')

    for (const oldType of Object.keys(LEGACY_BLOCK_TYPES)) {
      expect(migrated.includes(`type="${oldType}"`), oldType).toBe(false)
    }
  })
})
