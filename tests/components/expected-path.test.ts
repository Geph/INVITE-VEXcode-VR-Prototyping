import { describe, expect, it } from "vitest"
import { programPathMm } from "@/components/ai-assistant/expected-path"
import { OCEAN_REEF_ID } from "@/playgrounds/ocean-reef/config"
import { ROVER_RESCUE_ID } from "@/playgrounds/rover-rescue/config"

interface FakeBlock {
  type: string
  getFieldValue: (name: string) => string
  getInputTargetBlock: () => null
  getNextBlock: () => FakeBlock | null
}

function block(type: string, fields: Record<string, string>, next: FakeBlock | null = null): FakeBlock {
  return {
    type,
    getFieldValue: (name: string) => fields[name] ?? "",
    getInputTargetBlock: () => null,
    getNextBlock: () => next,
  }
}

function hat(next: FakeBlock | null) {
  return {
    type: "pg_events_when_started",
    getAllBlocks: () => [],
    getNextBlock: () => next,
    getFieldValue: () => "",
    getInputTargetBlock: () => null,
  }
}

describe("programPathMm", () => {
  it("drives ocean programs toward decreasing Y", () => {
    const drive = block("pg_drivetrain_drive_for", { DIRECTION: "forward", DISTANCE: "200", UNIT: "mm" })
    const path = programPathMm({ getAllBlocks: () => [hat(drive)] }, { x: 0, y: 0, headingDeg: 0 }, OCEAN_REEF_ID)
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -200 },
    ])
  })

  it("drives rover programs toward increasing Y", () => {
    const drive = block("pg_drivetrain_drive_for", { DIRECTION: "forward", DISTANCE: "200", UNIT: "mm" })
    const path = programPathMm({ getAllBlocks: () => [hat(drive)] }, { x: 10, y: 20, headingDeg: 0 }, ROVER_RESCUE_ID)
    expect(path[1]).toEqual({ x: 10, y: 220 })
  })

  it("turns before the next drive", () => {
    const drive = block("pg_drivetrain_drive_for", { DIRECTION: "forward", DISTANCE: "100", UNIT: "mm" })
    const turn = block("pg_drivetrain_turn_for", { DIRECTION: "right", DEGREES: "90" }, drive)
    const path = programPathMm({ getAllBlocks: () => [hat(turn)] }, { x: 0, y: 0, headingDeg: 0 }, ROVER_RESCUE_ID)
    expect(path[1]?.x).toBeCloseTo(100)
    expect(path[1]?.y).toBeCloseTo(0)
  })
})
