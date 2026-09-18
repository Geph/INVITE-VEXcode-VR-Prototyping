import { describe, expect, it } from "vitest"
import { SpatialHash } from "@/engine"
import {
  BATTERY_START_PCT,
  MINERAL_USE_RANGE_MM,
  START_POSE,
  XP_MINERAL_TO_BASE,
  XP_USE_MINERAL,
} from "@/playgrounds/rover-rescue/config"
import { createMineral, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import {
  dropLatestMineral,
  nearestUsableMineral,
  parseMineralAction,
  pickupNearestMineral,
} from "@/playgrounds/rover-rescue/systems/minerals"
import { planRoverDrive } from "@/playgrounds/rover-rescue/systems/physics"
import { capacityForLevel } from "@/playgrounds/rover-rescue/systems/leveling"
import {
  createRoverRescueState,
  deliverStorageToBase,
  dropMineral,
  pickupMineral,
  riverHazardFromState,
  tickRoverRescue,
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

  it("leaves cargo alone, because use only consumes a sample on the ground", () => {
    const carried = { ...createMineral("held", { x: 50, y: 0 }, "A"), state: "carried" as const }
    const world = {
      ...worldWithMineralAt(2000, 0),
      minerals: [carried],
      storage: ["held"],
      batteryPercent: 30,
      xp: 4,
    }
    const { state, used } = useMineralOnGround(world, { x: 0, y: 0 })
    expect(used).toBe(false)
    expect(state.storage).toEqual(["held"])
    expect(state.batteryPercent).toBe(30)
  })
})

describe("pickup and drop", () => {
  it("lifts the nearest sample into storage and takes it off the field", () => {
    const mineral = createMineral("near", { x: 80, y: 0 }, "A")
    const far = createMineral("far", { x: 200, y: 0 }, "A")
    const result = pickupNearestMineral([mineral, far], [], { x: 0, y: 0 }, 2)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.storage).toEqual(["near"])
    expect(result.minerals.find((m) => m.id === "near")?.state).toBe("carried")
    expect(result.minerals.find((m) => m.id === "far")?.state).toBe("field")
  })

  it("refuses a third sample at level 1", () => {
    const a = createMineral("a", { x: 40, y: 0 }, "A")
    const b = createMineral("b", { x: 80, y: 0 }, "A")
    const c = createMineral("c", { x: 120, y: 0 }, "A")
    const first = pickupNearestMineral([a, b, c], [], { x: 0, y: 0 }, capacityForLevel(1))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = pickupNearestMineral(first.minerals, first.storage, { x: 0, y: 0 }, capacityForLevel(1))
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const third = pickupNearestMineral(second.minerals, second.storage, { x: 0, y: 0 }, capacityForLevel(1))
    expect(third).toEqual({ ok: false, reason: "full" })
  })

  it("drops the most recently picked sample back at the rover's feet", () => {
    const a = { ...createMineral("a", { x: 40, y: 0 }, "A"), state: "carried" as const }
    const b = { ...createMineral("b", { x: 80, y: 0 }, "A"), state: "carried" as const }
    const dropped = dropLatestMineral([a, b], ["a", "b"], { x: 10, y: 20 })
    expect(dropped.ok).toBe(true)
    if (!dropped.ok) return
    expect(dropped.storage).toEqual(["a"])
    const onGround = dropped.minerals.find((m) => m.id === "b")!
    expect(onGround.state).toBe("field")
    expect(onGround.xMm).toBe(10)
    expect(onGround.yMm).toBe(20)
    expect(dropped.minerals.find((m) => m.id === "a")?.state).toBe("carried")
  })
})

describe("delivering to Base", () => {
  function pose(xMm: number, yMm: number) {
    return { xMm, yMm, headingDeg: 0, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null }
  }

  it("awards 5 XP per sample and clears the hold", () => {
    const held = ["a", "b", "c"].map((id, i) => ({
      ...createMineral(id, { x: i * 10, y: 0 }, i === 2 ? "C" : "A"),
      state: "carried" as const,
    }))
    const world: RoverRescueState = {
      ...createRoverRescueState(1),
      minerals: held,
      storage: ["a", "b", "c"],
      xp: 0,
      level: 1,
      mineralRespawns: [],
    }
    const next = deliverStorageToBase(world)
    expect(next.storage).toEqual([])
    expect(next.xp).toBe(XP_MINERAL_TO_BASE * 3)
    expect(next.level).toBe(2)
    expect(next.minerals.every((m) => m.state === "delivered")).toBe(true)
    // Zone C respawns; A does not.
    expect(next.mineralRespawns).toHaveLength(1)
    expect(next.mineralRespawns[0].zoneId).toBe("C")
  })

  it("banks cargo the moment the rover drives onto the pad", () => {
    const mineral = createMineral("loot", { x: 80, y: 0 }, "A")
    let state: RoverRescueState = {
      ...createRoverRescueState(1),
      minerals: [mineral],
      storage: [],
      index: (() => {
        const index = new SpatialHash<RoverEntity>(500)
        index.insert(mineral)
        return index
      })(),
    }
    state = pickupMineral(state, { x: 0, y: 0 }).state
    expect(state.storage).toEqual(["loot"])

    const banked = tickRoverRescue(state, 16, pose(START_POSE.xMm, START_POSE.yMm))
    expect(banked.storage).toEqual([])
    expect(banked.xp).toBe(XP_MINERAL_TO_BASE)
    expect(banked.minerals[0].state).toBe("delivered")
  })

  it("banks immediately when a sample is picked up while already on the pad", () => {
    const mineral = createMineral("pad", { x: START_POSE.xMm, y: START_POSE.yMm + 80 }, "A")
    const world: RoverRescueState = {
      ...createRoverRescueState(1),
      minerals: [mineral],
      storage: [],
      index: (() => {
        const index = new SpatialHash<RoverEntity>(500)
        index.insert(mineral)
        return index
      })(),
    }
    const { state, picked } = pickupMineral(world, { x: START_POSE.xMm, y: START_POSE.yMm })
    expect(picked).toBe(true)
    expect(state.storage).toEqual([])
    expect(state.xp).toBe(XP_MINERAL_TO_BASE)
    expect(state.minerals[0].state).toBe("delivered")
  })

  it("does not bank a sample that was dropped on the pad", () => {
    const mineral = { ...createMineral("stash", { x: 0, y: 0 }, "A"), state: "carried" as const }
    const world: RoverRescueState = {
      ...createRoverRescueState(1),
      minerals: [mineral],
      storage: ["stash"],
    }
    const rover = { x: START_POSE.xMm, y: START_POSE.yMm }
    const dropped = dropMineral(world, rover).state
    expect(dropped.storage).toEqual([])
    expect(dropped.minerals[0].state).toBe("field")
    const ticked = tickRoverRescue(dropped, 16, pose(START_POSE.xMm, START_POSE.yMm))
    expect(ticked.minerals[0].state).toBe("field")
    expect(ticked.xp).toBe(0)
  })
})
