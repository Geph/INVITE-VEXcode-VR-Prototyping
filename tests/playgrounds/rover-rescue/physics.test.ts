import { describe, expect, it } from "vitest"
import { SpatialHash } from "@/engine"
import {
  FIELD_MAX_Y_MM,
  MINERAL_RADIUS_MM,
  ROVER_HIT_RADIUS_MM,
  ROVER_WIDTH_MM,
  START_POSE,
} from "@/playgrounds/rover-rescue/config"
import { createMineral, createObstacle, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import { createRoverRescueState, riverHazardFromState } from "@/playgrounds/rover-rescue/state"
import { RIVER_CENTERLINE, RIVER_HAZARD, pointInRiverHazard } from "@/playgrounds/rover-rescue/map-spec"
import {
  clampRoverMm,
  isRiverHazard,
  planRoverDrive,
  pushedMinerals,
  resolveRoverMove,
  roverDriveVector,
} from "@/playgrounds/rover-rescue/systems/physics"

describe("rover-rescue physics", () => {
  it("stops the rover against an obstacle and sets blocked", () => {
    const rock = createObstacle("rock-test", { x: 200, y: 0 }, "rock", 60, 1)
    const index = new SpatialHash<RoverEntity>(500)
    index.insert(rock)
    const move = resolveRoverMove({ x: 0, y: 0 }, { x: 400, y: 0 }, index, RIVER_HAZARD)
    expect(move.blocked).toBe(true)
    expect(move.xMm).toBeLessThan(200)
    expect(move.inRiver).toBe(false)
  })

  it("treats the rover centre in the river as a hazard except on a bridge deck", () => {
    const mid = RIVER_CENTERLINE[4]
    expect(pointInRiverHazard(mid, RIVER_HAZARD)).toBe(true)
    expect(isRiverHazard(mid, RIVER_HAZARD)).toBe(true)

    const empty = new SpatialHash<RoverEntity>(500)
    const intoRiver = resolveRoverMove({ x: mid.x, y: mid.y - 600 }, { x: mid.x, y: mid.y }, empty, RIVER_HAZARD)
    expect(intoRiver.inRiver).toBe(true)

    const deck = resolveRoverMove({ x: -3500, y: 400 }, { x: -3500, y: 1240 }, empty, RIVER_HAZARD)
    expect(deck.inRiver).toBe(false)
    expect(deck.blocked).toBe(false)
    expect(deck.xMm).toBe(-3500)
    expect(deck.yMm).toBe(1240)
  })

  it("sweeps a corridor as wide as the rover, not as long as it", () => {
    expect(ROVER_HIT_RADIUS_MM).toBe(ROVER_WIDTH_MM / 2)
  })

  it("drives a clear metre out of the base yard in every direction", () => {
    for (const seed of [1, 7, 21]) {
      const world = createRoverRescueState(seed)
      const hazard = riverHazardFromState(world)
      const from = { x: START_POSE.xMm, y: START_POSE.yMm }
      for (let heading = 0; heading < 360; heading += 15) {
        const rad = (heading * Math.PI) / 180
        const move = resolveRoverMove(
          from,
          { x: from.x + 1000 * Math.sin(rad), y: from.y + 1000 * Math.cos(rad) },
          world.index,
          hazard,
        )
        expect(move.blocked, `seed ${seed} heading ${heading}`).toBe(false)
      }
    }
  })

  it("blocks or hazards a long northbound drive from the base through the populated world", () => {
    const world = createRoverRescueState(1)
    const from = { x: START_POSE.xMm, y: START_POSE.yMm }
    const to = { x: START_POSE.xMm, y: START_POSE.yMm + 4500 }
    const move = resolveRoverMove(from, to, world.index, riverHazardFromState(world))
    expect(move.blocked || move.inRiver).toBe(true)
    expect(move.yMm).toBeLessThan(to.y)
  })
})

describe("planRoverDrive", () => {
  const empty = () => new SpatialHash<RoverEntity>(500)
  /** The origin sits beside the river, so geometry tests run on dry land. */
  const dry = { outer: [], holes: [] }

  it("treats heading 0 as north and reverse as backwards", () => {
    expect(roverDriveVector(0).y).toBeCloseTo(1)
    expect(roverDriveVector(90).x).toBeCloseTo(1)
    expect(roverDriveVector(0, "reverse").y).toBeCloseTo(-1)

    const north = planRoverDrive({
      from: { x: 0, y: 0 },
      headingDeg: 0,
      direction: "forward",
      distanceMm: 500,
      index: empty(),
      hazard: dry,
    })
    expect(north.endMm.y).toBeCloseTo(500)
    expect(north.reachableMm).toBeCloseTo(500)
    expect(north.blocked).toBe(false)

    const back = planRoverDrive({
      from: { x: 0, y: 0 },
      headingDeg: 0,
      direction: "reverse",
      distanceMm: 500,
      index: empty(),
      hazard: dry,
    })
    expect(back.endMm.y).toBeCloseTo(-500)
  })

  it("reports the shortfall when the field edge cuts the drive short", () => {
    const plan = planRoverDrive({
      from: { x: 0, y: 0 },
      headingDeg: 0,
      direction: "forward",
      distanceMm: 6000,
      index: empty(),
      hazard: dry,
    })
    expect(plan.requestedMm).toBe(6000)
    expect(plan.reachableMm).toBeLessThan(6000)
    expect(plan.endMm.y).toBe(clampRoverMm(0, FIELD_MAX_Y_MM).yMm)
  })

  it("stops short of an obstacle and reports how far it got", () => {
    const index = empty()
    index.insert(createObstacle("rock-plan", { x: 0, y: 600 }, "rock", 60, 1))
    const plan = planRoverDrive({
      from: { x: 0, y: 0 },
      headingDeg: 0,
      direction: "forward",
      distanceMm: 2000,
      index,
      hazard: dry,
    })
    expect(plan.blocked).toBe(true)
    expect(plan.reachableMm).toBeLessThan(600)
    expect(plan.reachableMm).toBeGreaterThan(300)
  })

  it("enters the river rather than stopping at the bank, which ends the mission", () => {
    const plan = planRoverDrive({
      from: { x: 0, y: 0 },
      headingDeg: 0,
      direction: "forward",
      distanceMm: 2000,
      index: empty(),
      hazard: RIVER_HAZARD,
    })
    expect(plan.inRiver).toBe(true)
    expect(plan.blocked).toBe(false)
    expect(plan.reachableMm).toBeLessThan(2000)
  })

  it("agrees with resolveRoverMove everywhere, so preview and run cannot diverge", () => {
    const world = createRoverRescueState(1)
    const hazard = riverHazardFromState(world)
    const from = { x: START_POSE.xMm, y: START_POSE.yMm }
    for (let heading = 0; heading < 360; heading += 10) {
      const plan = planRoverDrive({
        from,
        headingDeg: heading,
        direction: "forward",
        distanceMm: 3000,
        index: world.index,
        hazard,
      })
      const unit = roverDriveVector(heading)
      const wall = clampRoverMm(from.x + unit.x * 3000, from.y + unit.y * 3000)
      const move = resolveRoverMove(from, { x: wall.xMm, y: wall.yMm }, world.index, hazard)
      expect(plan.endMm.x, `heading ${heading}`).toBeCloseTo(move.xMm)
      expect(plan.endMm.y, `heading ${heading}`).toBeCloseTo(move.yMm)
      expect(plan.blocked, `heading ${heading}`).toBe(move.blocked)
      expect(plan.inRiver, `heading ${heading}`).toBe(move.inRiver)
    }
  })
})

describe("pushedMinerals", () => {
  const hazard = RIVER_HAZARD

  it("shoves a mineral clear of the hull instead of stopping the rover", () => {
    const mineral = createMineral("m1", { x: 30, y: 0 }, "A")
    const index = new SpatialHash<RoverEntity>(500)
    index.insert(mineral)
    const pushes = pushedMinerals({
      minerals: [mineral],
      rover: { x: 0, y: 0 },
      headingDeg: 90,
      index,
      hazard,
    })
    expect(pushes).toHaveLength(1)
    const gap = Math.hypot(pushes[0].toMm.x, pushes[0].toMm.y)
    expect(gap).toBeGreaterThan(ROVER_HIT_RADIUS_MM + MINERAL_RADIUS_MM)
  })

  it("leaves minerals the rover is nowhere near alone", () => {
    const mineral = createMineral("m2", { x: 900, y: 0 }, "A")
    const index = new SpatialHash<RoverEntity>(500)
    index.insert(mineral)
    expect(
      pushedMinerals({ minerals: [mineral], rover: { x: 0, y: 0 }, headingDeg: 0, index, hazard }),
    ).toHaveLength(0)
  })

  it("pushes a dead-centre hit along the heading", () => {
    const mineral = createMineral("m3", { x: 0, y: 0 }, "A")
    const index = new SpatialHash<RoverEntity>(500)
    index.insert(mineral)
    const pushes = pushedMinerals({
      minerals: [mineral],
      rover: { x: 0, y: 0 },
      headingDeg: 0,
      index,
      hazard,
    })
    expect(pushes).toHaveLength(1)
    expect(pushes[0].toMm.y).toBeGreaterThan(0)
    expect(pushes[0].toMm.x).toBeCloseTo(0)
  })

  it("wedges rather than shoving a mineral into a rock or the river", () => {
    const mineral = createMineral("m4", { x: 30, y: 0 }, "A")
    const index = new SpatialHash<RoverEntity>(500)
    index.insert(mineral)
    index.insert(createObstacle("rock-wedge", { x: 140, y: 0 }, "rock", 80, 1))
    expect(
      pushedMinerals({ minerals: [mineral], rover: { x: 0, y: 0 }, headingDeg: 90, index, hazard }),
    ).toHaveLength(0)

    const bank = RIVER_CENTERLINE[4]
    const inRiver = createMineral("m5", { x: bank.x + 10, y: bank.y }, "A")
    const riverIndex = new SpatialHash<RoverEntity>(500)
    riverIndex.insert(inRiver)
    expect(
      pushedMinerals({
        minerals: [inRiver],
        rover: { x: bank.x, y: bank.y },
        headingDeg: 90,
        index: riverIndex,
        hazard,
      }),
    ).toHaveLength(0)
  })

  it("ignores minerals that are carried, used or delivered", () => {
    const carried = { ...createMineral("m6", { x: 20, y: 0 }, "A"), state: "carried" as const }
    const index = new SpatialHash<RoverEntity>(500)
    expect(
      pushedMinerals({ minerals: [carried], rover: { x: 0, y: 0 }, headingDeg: 0, index, hazard }),
    ).toHaveLength(0)
  })
})
