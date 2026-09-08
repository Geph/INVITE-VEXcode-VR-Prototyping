import { describe, expect, it } from "vitest"
import { generateWhenStartedJavaScript } from "@/lib/robot-runtime"
import { START_POSE } from "@/playgrounds/ocean-reef"
import { initialHostRobot } from "@/hooks/playground-host"

describe("program runner smoke", () => {
  it("Start emits a two-block when-started program", () => {
    const hat = { type: "pg_events_when_started", isEnabled: () => true }
    const workspace = {
      getAllBlocks: () => [hat],
    }
    const js = {
      blockToCode: (block: { type: string }) => {
        if (block.type !== "pg_events_when_started") return ""
        return "await robot.drive('forward', 200, 'mm');\nawait robot.turn('right', 90);"
      },
    }

    const code = generateWhenStartedJavaScript(workspace, js)
    expect(code).toContain("await robot.drive('forward', 200, 'mm')")
    expect(code).toContain("await robot.turn('right', 90)")
  })

  it("Reset restores the Ocean Reef start pose", () => {
    const reset = initialHostRobot(START_POSE.xMm, START_POSE.yMm)
    expect(reset).toEqual({
      x: 0,
      y: -800,
      rotation: 0,
      driveVelocity: 50,
      turnVelocity: 50,
      heading: 0,
    })
    expect(START_POSE).toEqual({ xMm: 0, yMm: -800, headingDeg: 0 })
  })
})
