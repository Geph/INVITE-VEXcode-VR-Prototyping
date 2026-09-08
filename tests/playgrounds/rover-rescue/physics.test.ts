import { describe, expect, it } from "vitest"
import { SpatialHash } from "@/engine"
import { START_POSE } from "@/playgrounds/rover-rescue/config"
import { createObstacle, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import { createRoverRescueState, riverHazardFromState } from "@/playgrounds/rover-rescue/state"
import { RIVER_CENTERLINE, RIVER_HAZARD, pointInRiverHazard } from "@/playgrounds/rover-rescue/map-spec"
import { isRiverHazard, resolveRoverMove } from "@/playgrounds/rover-rescue/systems/physics"

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

  it("blocks or hazards a long northbound drive from the base through the populated world", () => {
    const world = createRoverRescueState(1)
    const from = { x: START_POSE.xMm, y: START_POSE.yMm }
    const to = { x: START_POSE.xMm, y: START_POSE.yMm + 4500 }
    const move = resolveRoverMove(from, to, world.index, riverHazardFromState(world))
    expect(move.blocked || move.inRiver).toBe(true)
    expect(move.yMm).toBeLessThan(to.y)
  })
})
