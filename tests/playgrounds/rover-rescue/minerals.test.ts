import { describe, expect, it } from "vitest"
import { SpatialHash } from "@/engine"
import {
  BATTERY_START_PCT,
  MINERAL_USE_RANGE_MM,
  START_POSE,
  XP_USE_MINERAL,
} from "@/playgrounds/rover-rescue/config"
import { createMineral, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import { nearestUsableMineral, parseMineralAction } from "@/playgrounds/rover-rescue/systems/minerals"
import { planRoverDrive } from "@/playgrounds/rover-rescue/systems/physics"
import {
  createRoverRescueState,
  riverHazardFromState,
  useMineralOnGround,
  type RoverRescueState,
} from "@/playgrounds/rover-rescue/state"

describe("nearestUsableMineral", () => {
  const rover = { x: 0, y: 0 }

  it("picks the closest sample in reach", () => {
    const near = createMineral("near", { x: 120, y: 0 }, "A")
    const far = createMineral("far", { x: 200, y: 0 }, "A")
    expect(nearestUsableMineral([far, near], rover)?.id).toBe("near")
  })

  it("ignores a sample just out of reach", () => {
    const outside = createMineral("outside", { x: MINERAL_USE_RANGE_MM + 1, y: 0 }, "A")
    expect(nearestUsableMineral([outside], rover)).toBeNull()
    const inside = createMineral("inside", { x: MINERAL_USE_RANGE_MM - 1, y: 0 }, "A")
    expect(nearestUsableMineral([inside], rover)?.id).toBe("inside")
  })

  /** Pushing shoves samples to about 108 mm, so the range has to clear that. */
  it("can still reach a sample the rover has nudged aside", () => {
    const pushed = createMineral("pushed", { x: 108, y: 0 }, "A")
    expect(nearestUsableMineral([pushed], rover)?.id).toBe("pushed")
  })

  it("only considers samples still on the ground", () => {
    const carried = { ...createMineral("carried", { x: 50, y: 0 }, "A"), state: "carried" as const }
    const used = { ...createMineral("used", { x: 50, y: 0 }, "A"), state: "used" as const }
    expect(nearestUsableMineral([carried, used], rover)).toBeNull()
  })
})

describe("parseMineralAction", () => {
  it("accepts the dropdown values and the label spelling", () => {
    expect(parseMineralAction("use")).toBe("use")
    expect(parseMineralAction(" USE ")).toBe("use")
    expect(parseMineralAction("pickup")).toBe("pickup")
    expect(parseMineralAction("pick up")).toBe("pickup")
    expect(parseMineralAction("drop")).toBe("drop")
    expect(parseMineralAction("eat")).toBeNull()
  })
})

/**
 * Battery drain makes reaching a sample the whole game, so if spawning or the
 * collision radius ever strands the rover at Base the mission is unwinnable
 * before the player writes a line. This guards the opening move.
 */
describe("the opening move", () => {
  it("leaves a sample within one straight drive of Base, and in reach once there", () => {
    const world = createRoverRescueState(1)
    const from = { x: START_POSE.xMm, y: START_POSE.yMm }
    const hazard = riverHazardFromState(world)

    const reachable = world.minerals
      .filter((mineral) => mineral.state === "field")
      .map((mineral) => {
        const gapMm = Math.hypot(mineral.xMm - from.x, mineral.yMm - from.y)
        // Heading 0 is north and north is +Y, so the bearing is atan2(dx, dy).
        const headingDeg = (Math.atan2(mineral.xMm - from.x, mineral.yMm - from.y) * 180) / Math.PI
        const plan = planRoverDrive({
          from,
          headingDeg,
          direction: "forward",
          distanceMm: gapMm,
          index: world.index,
          hazard,
        })
        return { mineral, gapMm, plan }
      })
      .filter((route) => !route.plan.blocked && !route.plan.inRiver)
      .sort((a, b) => a.gapMm - b.gapMm)

    expect(reachable.length).toBeGreaterThan(0)
    const first = reachable[0]
    // A full battery covers 20 days of driving, so the first sample must be near.
    expect(first.gapMm).toBeLessThan(2000)
    expect(first.plan.reachableMm).toBeCloseTo(first.gapMm, 3)
    expect(nearestUsableMineral(world.minerals, first.plan.endMm)?.id).toBe(first.mineral.id)
  })
})

describe("useMineralOnGround", () => {
  function worldWithMineralAt(x: number, y: number, zoneId = "A"): RoverRescueState {
    const base = createRoverRescueState(1)
    const mineral = createMineral("target", { x, y }, zoneId)
    const index = new SpatialHash<RoverEntity>(500)
    index.insert(mineral)
    return { ...base, minerals: [mineral], mineralRespawns: [], index }
  }

  it("refills the battery and awards the documented 2 XP", () => {
    const world = { ...worldWithMineralAt(100, 0), batteryPercent: 12, xp: 0, level: 1 }
    const { state, used } = useMineralOnGround(world, { x: 0, y: 0 })
    expect(used).toBe(true)
    expect(state.batteryPercent).toBe(BATTERY_START_PCT)
    expect(state.xp).toBe(XP_USE_MINERAL)
    expect(state.minerals[0].state).toBe("used")
  })

  it("levels the rover up once enough samples are used", () => {
    let state = { ...worldWithMineralAt(100, 0), xp: 8, level: 1 }
    state = useMineralOnGround(state, { x: 0, y: 0 }).state
    expect(state.xp).toBe(10)
    expect(state.level).toBe(2)
  })

  it("does nothing when there is no sample in reach", () => {
    const world = { ...worldWithMineralAt(2000, 0), batteryPercent: 30, xp: 4 }
    const { state, used } = useMineralOnGround(world, { x: 0, y: 0 })
    expect(used).toBe(false)
    expect(state.batteryPercent).toBe(30)
    expect(state.xp).toBe(4)
    expect(state).toBe(world)
  })

  it("queues an outer-zone sample for respawn so the far field does not run dry", () => {
    const outer = useMineralOnGround(worldWithMineralAt(100, 0, "C"), { x: 0, y: 0 }).state
    expect(outer.mineralRespawns).toHaveLength(1)
    expect(outer.mineralRespawns[0].zoneId).toBe("C")

    // Zones A and B are not on the respawn table, so their samples are finite.
    const inner = useMineralOnGround(worldWithMineralAt(100, 0, "A"), { x: 0, y: 0 }).state
    expect(inner.mineralRespawns).toHaveLength(0)
  })
})
