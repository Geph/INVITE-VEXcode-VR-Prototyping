import { describe, expect, it } from "vitest"
import { createRng, SpatialHash } from "@/engine"
import { GRID_MM, ROVER_DISTANCE_SENSOR_MAX_MM, START_POSE } from "@/playgrounds/rover-rescue/config"
import { createRoverRescueApi } from "@/playgrounds/rover-rescue/api"
import { createEnemy, createMineral, createObstacle, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import { createRoverRescueState, tickRoverRescue } from "@/playgrounds/rover-rescue/state"
import { detect, distanceSensor, sight } from "@/playgrounds/rover-rescue/systems/sensing"
import type { RiverHazard } from "@/playgrounds/rover-rescue/map-spec"

const FAR_HAZARD: RiverHazard = {
  outer: [
    { x: 20000, y: 20000 },
    { x: 20100, y: 20000 },
    { x: 20100, y: 20100 },
    { x: 20000, y: 20100 },
  ],
  holes: [],
}

const ORIGIN = { x: 0, y: 0 }

function indexOf(...entities: RoverEntity[]) {
  const hash = new SpatialHash<RoverEntity>(GRID_MM)
  for (const entity of entities) hash.insert(entity)
  return hash
}

describe("rover-rescue sensing", () => {
  it("detects a mineral at 799 mm and not at 801 mm", () => {
    const near = createMineral("m-near", { x: 0, y: 799 }, "A")
    const far = createMineral("m-far", { x: 0, y: 801 }, "A")
    expect(detect(ORIGIN, indexOf(near)).map((hit) => hit.id)).toEqual(["m-near"])
    expect(detect(ORIGIN, indexOf(far))).toEqual([])
  })

  it("sees an enemy at 19° off heading and not at 21°", () => {
    const range = 500
    const at = (deg: number) => {
      const rad = (deg * Math.PI) / 180
      return createEnemy({
        id: `e-${deg}`,
        posMm: { x: range * Math.sin(rad), y: range * Math.cos(rad) },
        kind: "spider",
        serpentColor: null,
        artSeed: 1,
        wanderPhase: 0,
      })
    }
    const seen = sight(ORIGIN, 0, indexOf(at(19)), FAR_HAZARD, [])
    const missed = sight(ORIGIN, 0, indexOf(at(21)), FAR_HAZARD, [])
    expect(seen.some((hit) => hit.kind === "enemy")).toBe(true)
    expect(missed.some((hit) => hit.kind === "enemy")).toBe(false)
  })

  it("does not see a mineral behind an intervening obstacle", () => {
    const mineral = createMineral("m1", { x: 0, y: 500 }, "A")
    const rock = createObstacle("rock1", { x: 0, y: 200 }, "rock", 40, 1)
    const clear = sight(ORIGIN, 0, indexOf(mineral), FAR_HAZARD, [])
    const blocked = sight(ORIGIN, 0, indexOf(mineral, rock), FAR_HAZARD, [])
    expect(clear.some((hit) => hit.id === "m1")).toBe(true)
    expect(blocked.some((hit) => hit.id === "m1")).toBe(false)
    expect(blocked.some((hit) => hit.id === "rock1")).toBe(true)
  })

  it("caps the distance sensor at 2000 mm", () => {
    const far = createObstacle("far-rock", { x: 0, y: 2500 }, "rock", 40, 1)
    const near = createObstacle("near-rock", { x: 0, y: 1500 }, "rock", 40, 1)
    const miss = distanceSensor(ORIGIN, 0, indexOf(far), FAR_HAZARD, [])
    const hit = distanceSensor(ORIGIN, 0, indexOf(near), FAR_HAZARD, [])
    expect(miss.foundObject).toBe(false)
    expect(miss.distanceMm).toBe(ROVER_DISTANCE_SENSOR_MAX_MM)
    expect(hit.foundObject).toBe(true)
    expect(hit.distanceMm).toBeCloseTo(1460, 0)
    expect(hit.distanceMm).toBeLessThanOrEqual(ROVER_DISTANCE_SENSOR_MAX_MM)
  })

  it("reuses the per-tick snapshot instead of recomputing on each block read", () => {
    const world = createRoverRescueState(1)
    const robot = {
      xMm: START_POSE.xMm,
      yMm: START_POSE.yMm,
      headingDeg: START_POSE.headingDeg,
      driveVelocity: 50,
      turnVelocity: 50,
      driveTimeoutMs: null,
    }
    const ticked = tickRoverRescue(world, 16, robot)
    const cached = ticked.sensing
    const api = createRoverRescueApi({
      robot: { current: robot },
      world: { current: ticked },
      writeConsole: () => {},
      stopped: { current: false },
      rng: createRng(1),
    })
    api.sees("minerals")
    api.detects("enemy")
    api.distanceFoundObject()
    expect(ticked.sensing).toBe(cached)
  })
})
