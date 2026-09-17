import { describe, expect, it } from "vitest"
import { createRng, SpatialHash } from "@/engine"
import { createRoverRescueApi } from "@/playgrounds/rover-rescue/api"
import { BATTERY_START_PCT, MINERAL_USE_RANGE_MM, XP_USE_MINERAL } from "@/playgrounds/rover-rescue/config"
import { createMineral, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import { createRoverRescueState, type RoverRescueState } from "@/playgrounds/rover-rescue/state"

/**
 * The block generators call these names, so this is the seam where a working
 * reducer and a working block still add up to nothing if the wiring is wrong.
 */
function harness(mineralAtMm: { x: number; y: number } | null) {
  const base = createRoverRescueState(1)
  const mineral = mineralAtMm ? createMineral("target", mineralAtMm, "C") : null
  const index = new SpatialHash<RoverEntity>(500)
  if (mineral) index.insert(mineral)
  const world = {
    current: {
      ...base,
      minerals: mineral ? [mineral] : [],
      mineralRespawns: [],
      index,
      batteryPercent: 40,
      xp: 0,
      level: 1,
    } as RoverRescueState,
  }
  const robot = { current: { xMm: 0, yMm: 0, headingDeg: 0, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null } }
  const console: Array<{ text: string; color?: string }> = []
  const api = createRoverRescueApi({
    robot,
    world,
    writeConsole: (text: string, color?: string) => console.push({ text, color }),
    stopped: { current: false },
    rng: createRng(1),
  })
  return { api, world, console }
}

describe("rover API resource actions", () => {
  it("refills the battery and awards XP through the block's entry point", () => {
    const { api, world } = harness({ x: 120, y: 0 })
    expect(api.batteryLevel()).toBe(40)
    expect(api.roverExp()).toBe(0)
    expect(api.roverLevel()).toBe(1)

    expect(api.mineralsAction("use")).toBe(true)
    expect(api.batteryLevel()).toBe(BATTERY_START_PCT)
    expect(api.roverExp()).toBe(XP_USE_MINERAL)
    expect(world.current.minerals[0].state).toBe("used")
  })

  it("says so on the console when there is nothing in reach", () => {
    const { api, console } = harness({ x: MINERAL_USE_RANGE_MM + 500, y: 0 })
    expect(api.mineralsAction("use")).toBe(false)
    expect(api.batteryLevel()).toBe(40)
    expect(console.map((line) => line.text)).toContain("No mineral sample within reach.")
  })

  it("does nothing for the actions that storage has not arrived for yet", () => {
    const { api } = harness({ x: 120, y: 0 })
    expect(api.mineralsAction("pickup")).toBe(false)
    expect(api.mineralsAction("drop")).toBe(false)
    expect(api.batteryLevel()).toBe(40)
  })

  it("reports XP as progress through the level, matching the block's tooltip", () => {
    const { api, world } = harness({ x: 120, y: 0 })
    world.current = { ...world.current, xp: 9, level: 1 }
    expect(api.roverExp()).toBe(9)
    api.mineralsAction("use")
    expect(api.roverLevel()).toBe(2)
    // 11 lifetime XP is 1 XP into level 2, not 11.
    expect(api.roverExp()).toBe(1)
  })
})
