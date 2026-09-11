import { describe, expect, it } from "vitest"
import { fitToBounds, worldToScreen } from "@/engine"
import {
  DISTANCE_PREVIEW_PX,
  distancePickerTitle,
  drawDistancePickerPreview,
  drivePredictionHint,
  headingFromPreviewPointer,
  pickerMaxDistanceMm,
  playgroundWorldBounds,
  predictDrive,
} from "@/hooks/distance-picker-preview"
import { reefWorldToScreen } from "@/playgrounds/ocean-reef/art"
import { createObstacle } from "@/playgrounds/rover-rescue/entities"
import { oceanReef } from "@/playgrounds/ocean-reef"
import { FIELD_BOUNDS, START_POSE, roverRescue } from "@/playgrounds/rover-rescue"

function mockContext(width = 280, height = 280) {
  const gradient = { addColorStop() {} }
  const ctx: Record<string, unknown> = {
    canvas: { width, height },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  return new Proxy(ctx, {
    get(target, prop) {
      if (typeof prop === "string" && prop in target) return target[prop]
      return () => {}
    },
    set(target, prop, value) {
      if (typeof prop === "string") target[prop] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

describe("distance picker preview", () => {
  it("labels the active playground and its world size", () => {
    expect(distancePickerTitle(oceanReef.name, oceanReef.world.widthMm, oceanReef.world.heightMm)).toBe(
      "Set distance — Ocean Reef (2000×2000 mm)",
    )
    expect(distancePickerTitle(roverRescue.name, roverRescue.world.widthMm, roverRescue.world.heightMm)).toBe(
      "Set distance — Rover Rescue (12000×6000 mm)",
    )
  })

  it("fits each playground world on a centred millimetre bounds", () => {
    expect(playgroundWorldBounds(oceanReef.world)).toEqual({ minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 })
    expect(playgroundWorldBounds(roverRescue.world)).toEqual(FIELD_BOUNDS)
  })

  it("lets the slider run from 0 to the longest field edge", () => {
    expect(pickerMaxDistanceMm(oceanReef.world)).toBe(2000)
    expect(pickerMaxDistanceMm(roverRescue.world)).toBe(12000)
  })

  it("aims Rover Rescue heading from a preview pointer (0° north, clockwise)", () => {
    const pose = { x: START_POSE.xMm, y: START_POSE.yMm }
    const viewport = { widthPx: DISTANCE_PREVIEW_PX, heightPx: DISTANCE_PREVIEW_PX }
    const cam = fitToBounds(playgroundWorldBounds(roverRescue.world), viewport)
    const north = worldToScreen({ x: pose.x, y: pose.y + 2000 }, cam, viewport)
    const east = worldToScreen({ x: pose.x + 2000, y: pose.y }, cam, viewport)
    expect(headingFromPreviewPointer(roverRescue.id, pose, north, roverRescue.world)).toBeCloseTo(0, 5)
    expect(headingFromPreviewPointer(roverRescue.id, pose, east, roverRescue.world)).toBeCloseTo(90, 5)
    expect(headingFromPreviewPointer(roverRescue.id, pose, east, roverRescue.world, "reverse")).toBeCloseTo(270, 5)
    expect(
      headingFromPreviewPointer(roverRescue.id, pose, worldToScreen({ x: pose.x, y: pose.y }, cam, viewport), roverRescue.world),
    ).toBeNull()
  })

  it("aims Ocean Reef heading with historical −Y forward at 0°", () => {
    const pose = { x: 0, y: -800 }
    const viewport = { widthPx: DISTANCE_PREVIEW_PX, heightPx: DISTANCE_PREVIEW_PX }
    const cam = fitToBounds(playgroundWorldBounds(oceanReef.world), viewport)
    const forward = reefWorldToScreen(pose.x, pose.y - 400, cam, viewport)
    const east = reefWorldToScreen(pose.x + 400, pose.y, cam, viewport)
    expect(headingFromPreviewPointer(oceanReef.id, pose, forward, oceanReef.world)).toBeCloseTo(0, 5)
    expect(headingFromPreviewPointer(oceanReef.id, pose, east, oceanReef.world)).toBeCloseTo(90, 5)
  })

  it("predicts the stop the drive will actually make", () => {
    const robot = { x: START_POSE.xMm, y: START_POSE.yMm, rotation: 0 }
    const args = {
      playgroundId: roverRescue.id,
      robot,
      direction: "forward",
      distanceMm: 1000,
      world: roverRescue.world,
    }

    const clear = predictDrive({ ...args, roverState: roverRescue.createState(7) })
    expect(clear.blocked).toBe(false)
    expect(clear.reachableMm).toBeCloseTo(1000, 3)
    expect(drivePredictionHint(clear)).toBe("Path is clear")

    const walled = roverRescue.createState(7)
    walled.index.insert(createObstacle("rock-ahead", { x: robot.x, y: robot.y + 600 }, "rock", 60, 1))
    const stopped = predictDrive({ ...args, roverState: walled })
    expect(stopped.blocked).toBe(true)
    expect(stopped.reachableMm).toBeLessThan(600)
    expect(drivePredictionHint(stopped)).toContain("something is in the way")
  })

  it("reports the field edge when the request runs past it", () => {
    const edge = predictDrive({
      playgroundId: roverRescue.id,
      robot: { x: START_POSE.xMm, y: START_POSE.yMm, rotation: 180 },
      direction: "forward",
      distanceMm: 4000,
      world: roverRescue.world,
      roverState: roverRescue.createState(7),
    })
    expect(edge.reachableMm).toBeLessThan(4000)
    expect(drivePredictionHint(edge)).toContain("field edge")
  })

  it("paints the loaded playground into the preview canvas", () => {
    const roverCtx = mockContext()
    expect(() =>
      drawDistancePickerPreview({
        ctx: roverCtx,
        playgroundId: roverRescue.id,
        playground: roverRescue,
        reefState: oceanReef.createState(1),
        roverState: roverRescue.createState(1),
        robot: { x: START_POSE.xMm, y: START_POSE.yMm, rotation: 0 },
        direction: "forward",
        distanceMm: 200,
      }),
    ).not.toThrow()

    const reefCtx = mockContext()
    expect(() =>
      drawDistancePickerPreview({
        ctx: reefCtx,
        playgroundId: oceanReef.id,
        playground: oceanReef,
        reefState: oceanReef.createState(1),
        roverState: roverRescue.createState(1),
        robot: { x: 0, y: -800, rotation: 0 },
        direction: "forward",
        distanceMm: 200,
      }),
    ).not.toThrow()
  })
})
