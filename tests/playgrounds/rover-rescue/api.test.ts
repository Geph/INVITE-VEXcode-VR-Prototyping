import { describe, expect, it } from "vitest"
import { createRng, SpatialHash } from "@/engine"
import { createRoverRescueApi } from "@/playgrounds/rover-rescue/api"
import { BATTERY_START_PCT, MINERAL_USE_RANGE_MM, XP_USE_MINERAL } from "@/playgrounds/rover-rescue/config"
import { capacityForLevel } from "@/playgrounds/rover-rescue/systems/leveling"
import { createEnemy, createMineral, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import { createRoverRescueState, tickRoverRescue, type RoverRescueState } from "@/playgrounds/rover-rescue/state"

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

  it("picks up and drops through the same entry point the block calls", () => {
    const { api, world, console } = harness({ x: 120, y: 0 })
    expect(api.mineralsStored()).toBe(0)
    expect(api.mineralsCapacity()).toBe(capacityForLevel(1))

    expect(api.mineralsAction("pickup")).toBe(true)
    expect(api.mineralsStored()).toBe(1)
    expect(world.current.minerals[0].state).toBe("carried")
    expect(api.batteryLevel()).toBe(40)

    expect(api.mineralsAction("drop")).toBe(true)
    expect(api.mineralsStored()).toBe(0)
    expect(world.current.minerals[0].state).toBe("field")
    expect(console).toHaveLength(0)
  })

  it("says so when pickup has nothing, storage is full, or drop is empty", () => {
    const empty = harness(null)
    expect(empty.api.mineralsAction("pickup")).toBe(false)
    expect(empty.console.map((line) => line.text)).toContain("No mineral sample within reach.")
    expect(empty.api.mineralsAction("drop")).toBe(false)
    expect(empty.console.map((line) => line.text)).toContain("No mineral samples in storage.")

    const full = harness({ x: 80, y: 0 })
    full.world.current = {
      ...full.world.current,
      storage: ["already", "full"],
      minerals: [
        { ...createMineral("already", { x: 0, y: 0 }, "A"), state: "carried" },
        { ...createMineral("full", { x: 0, y: 0 }, "A"), state: "carried" },
        createMineral("target", { x: 80, y: 0 }, "C"),
      ],
    }
    expect(full.api.mineralsAction("pickup")).toBe(false)
    expect(full.console.map((line) => line.text)).toContain("Storage is full.")
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

  it("skips standby when battery is already at or below the threshold", async () => {
    const { api, world } = harness(null)
    expect(world.current.batteryPercent).toBe(40)
    expect(await api.standbyUntil(50)).toBe(false)
    expect(world.current.batteryPercent).toBe(40)
    expect(world.current.standby).toBe(false)
  })
})

describe("rover API combat", () => {
  it("absorbs the nearest enemy and reports 0 stats when none are in detect range", () => {
    const { api, world, console } = harness(null)
    const spawned = createEnemy({
      id: "target",
      posMm: { x: 80, y: 0 },
      kind: "spider",
      serpentColor: null,
      artSeed: 1,
      wanderPhase: 0,
    })
    const enemy = { ...spawned, level: 1, maxHp: 20, hp: 20, radiation: 10 }
    world.current = {
      ...world.current,
      enemies: [enemy],
      index: new SpatialHash<RoverEntity>(500),
      sensing: { ...world.current.sensing, origin: { x: 1, y: 1 } },
    }
    world.current.index.insert(enemy)

    expect(api.enemyLevel()).toBe(1)
    expect(api.enemyRadiation()).toBe(10)
    expect(api.underAttack()).toBe(false)
    expect(api.absorbRadiation()).toBe(true)
    expect(world.current.enemies[0]?.state).toBe("neutralized")
    expect(world.current.xp).toBe(5)
    expect(console).toHaveLength(0)

    world.current = { ...world.current, lastAbsorbAtMs: null }
    expect(api.absorbRadiation()).toBe(false)
    expect(console.map((line) => line.text)).toContain("No enemy within range.")
    expect(api.enemyLevel()).toBe(0)
    expect(api.enemyRadiation()).toBe(0)
  })

  it("reads under attack after a melee tick", () => {
    const { api, world } = harness(null)
    const spawned = createEnemy({
      id: "melee",
      posMm: { x: 80, y: 0 },
      kind: "spider",
      serpentColor: null,
      artSeed: 1,
      wanderPhase: 0,
    })
    world.current = { ...world.current, enemies: [spawned] }
    const next = tickRoverRescue(world.current, 16, worldRobot(), { missionRunning: true })
    world.current = next
    expect(api.underAttack()).toBe(true)
  })
})

function worldRobot() {
  return { xMm: 0, yMm: 0, headingDeg: 0, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null }
}
