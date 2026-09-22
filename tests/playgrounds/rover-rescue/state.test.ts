import { describe, expect, it } from "vitest"
import { MINERAL_RADIUS_MM, ROVER_HIT_RADIUS_MM } from "@/playgrounds/rover-rescue/config"
import { createRoverRescueState, tickRoverRescue } from "@/playgrounds/rover-rescue/state"

function pose(xMm: number, yMm: number, headingDeg = 0) {
  return { xMm, yMm, headingDeg, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null }
}

describe("tickRoverRescue mineral pushing", () => {
  it("shoves a mineral the rover drives over out of the corridor", () => {
    const world = createRoverRescueState(1)
    const target = world.minerals.find((mineral) => mineral.state === "field")
    expect(target).toBeDefined()
    const before = { x: target!.xMm, y: target!.yMm }

    // Park the rover on the sample so the hull overlaps it.
    const next = tickRoverRescue(world, 16, pose(before.x - 10, before.y, 90))
    const after = next.minerals.find((mineral) => mineral.id === target!.id)!

    const moved = Math.hypot(after.xMm - before.x, after.yMm - before.y)
    expect(moved).toBeGreaterThan(0)
    const clearance = Math.hypot(after.xMm - (before.x - 10), after.yMm - before.y)
    expect(clearance).toBeGreaterThanOrEqual(ROVER_HIT_RADIUS_MM + MINERAL_RADIUS_MM)
    // The spatial index has to follow the sample, or sensing would lag a frame.
    expect(next.index.queryRadius(after.xMm, after.yMm, 1).some((e) => e.id === after.id)).toBe(true)
    expect(after.state).toBe("field")
  })

  it("leaves the field alone when no mineral is under the rover", () => {
    const world = createRoverRescueState(1)
    const far = tickRoverRescue(world, 16, pose(0, -2900))
    for (const mineral of world.minerals) {
      const same = far.minerals.find((m) => m.id === mineral.id)!
      expect(same.xMm).toBe(mineral.xMm)
      expect(same.yMm).toBe(mineral.yMm)
    }
  })

  it("keeps rocks and plants solid while minerals give way", () => {
    const world = createRoverRescueState(1)
    const rock = world.obstacles[0]
    const next = tickRoverRescue(world, 16, pose(rock.xMm, rock.yMm, 0))
    const same = next.obstacles.find((o) => o.id === rock.id)!
    expect(same.xMm).toBe(rock.xMm)
    expect(same.yMm).toBe(rock.yMm)
  })
})
