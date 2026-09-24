import { describe, expect, it } from "vitest"
import { createCastleCrashersState, startRobot } from "@/playgrounds/castle-crashers"
import { castleMotionTarget, tickCastlePhysics } from "@/playgrounds/castle-crashers/systems/physics"
import { initialHostRobot } from "@/hooks/playground-host"
import { driveTargetMm } from "@/hooks/playground-motion"
import { fieldMmToPixel } from "@/lib/robot-runtime"
import { createOceanReefState, hitsCoral, oceanReef, startRobot as reefRobot } from "@/playgrounds/ocean-reef"
import { createRng } from "@/engine"

describe("playground units and Castle outcomes", () => {
  it("keeps the Reef start clear of coral at both sizes", () => {
    for (const maximized of [false, true]) {
      expect(hitsCoral(createOceanReefState(1, { maximized }), reefRobot())).toBe(false)
    }
  })
  it("preserves the Castle start heading in the displayed robot state", () => {
    const robot = startRobot()
    expect(initialHostRobot(robot.xMm, robot.yMm, robot.headingDeg).rotation).toBe(-90)
  })

  it("does not clamp a Castle drive at the island edge", () => {
    const pose = { x: 1014, y: 50, rotation: -90 }
    const view = { widthPx: 400, heightPx: 400, maximized: false }
    const target = driveTargetMm("castle-crashers", pose, "forward", 2600, view)
    expect(target.xMm).toBeCloseTo(-1586)
    expect(tickCastlePhysics(createCastleCrashersState(1), 16, { ...startRobot(), ...target }, true).missionReason).toBe("water")
  })

  it("blocks a long movement through a fixed rock without moving it", () => {
    const state = createCastleCrashersState(1)
    const rock = state.pieces.find(p => p.kind === "rock")!
    const before = { ...rock }
    const end = castleMotionTarget({ x: rock.xMm + 400, y: rock.yMm }, { xMm: rock.xMm - 400, yMm: rock.yMm }, [rock])
    expect(end.xMm).toBeGreaterThan(rock.xMm)
    expect(rock).toEqual(before)
  })

  it("accounts for a piece clearing on the same step as a robot fall", () => {
    const state = createCastleCrashersState(1)
    state.pieces = [{ ...state.pieces[0], xMm: -2000, yMm: 0 }]
    const next = tickCastlePhysics(state, 16, { ...startRobot(), xMm: -1800 }, true)
    expect(next.missionReason).toBe("water")
    expect(next.weightClearedKg).toBe(state.pieces[0].weightKg)
    expect(tickCastlePhysics(next, 16, startRobot(), false).weightClearedKg).toBe(next.weightClearedKg)
  })

  it("keeps a 2000-mm reef and a 200-mm drive proportional at both window sizes", () => {
    for (const size of [400, 600]) {
      const left = fieldMmToPixel(-1000, 0, size, size)
      const right = fieldMmToPixel(1000, 0, size, size)
      expect(right.x - left.x).toBe(size)
      expect(fieldMmToPixel(200, 0, size, size).x - size / 2).toBe(size / 10)
    }
    expect(createOceanReefState(1).coral).toEqual(createOceanReefState(1, { maximized: true }).coral)
  })

  it("keeps distance sensor readings in mm when the reef window changes size", () => {
    const world = { current: createOceanReefState(1) }
    world.current.coral = []
    world.current.trash = [{ ...world.current.trash[0], xMm: 0, yMm: -400, isCollected: false }]
    const robot = { current: { ...reefRobot(), xMm: 0, yMm: 0 } }
    const api = oceanReef.createApi({ world, robot, stopped: { current: false }, rng: createRng(1), writeConsole: () => {} })
    // Front probe offset (22 legacy px) and object radius (20 px) are
    // subtracted from the 400-mm centre distance by the existing sensor model.
    expect(api.getDistance("front", "mm")).toBeCloseTo(400 - 42 * 7.5)
    world.current.view = { widthPx: 600, heightPx: 600, maximized: true }
    expect(api.getDistance("front", "mm")).toBeCloseTo(400 - 42 * 7.5)
  })
})
