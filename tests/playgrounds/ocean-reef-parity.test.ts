import { describe, expect, it } from "vitest"
import { createRng } from "@/engine"
import {
  CORAL_REEF_START_MM,
  CORAL_REEF_TRASH_COUNT,
  createInitialTrashItems,
  fieldMmToPixel,
  seededRandom,
} from "@/lib/robot-runtime"
import {
  applyDrive,
  coralToPixelPieces,
  createOceanReefState,
  oceanReef,
  reportedPositionMm,
  startRobot,
} from "@/playgrounds/ocean-reef"
import { CORAL_COLORS, CORAL_KINDS } from "@/playgrounds/ocean-reef/art"
import { DEFAULT_PLAYGROUND_ID, get, resolvePlaygroundId } from "@/playgrounds/registry"

function legacyCoral(width: number, height: number) {
  const pieces: Array<{ x: number; y: number; radius: number; color: string; kind: string; angle: number; seed: number }> = []
  const pushPiece = (x: number, y: number, seed: number, angle: number) => {
    pieces.push({
      x,
      y,
      radius: 12 + seededRandom(seed) * 8,
      color: CORAL_COLORS[Math.floor(seededRandom(seed + 1) * CORAL_COLORS.length)]!,
      kind: CORAL_KINDS[Math.floor(seededRandom(seed + 2) * CORAL_KINDS.length)]!,
      angle,
      seed,
    })
  }
  for (let x = 0; x < width; x += 30) {
    pushPiece(x + 15, 15, x, Math.PI)
    pushPiece(x + 15, height - 15, x + 1000, 0)
  }
  for (let y = 30; y < height - 30; y += 30) {
    pushPiece(15, y + 15, y + 2000, Math.PI / 2)
    pushPiece(width - 15, y + 15, y + 3000, -Math.PI / 2)
  }
  return pieces
}

describe("playground registry", () => {
  it("registers ocean-reef as the default", () => {
    expect(DEFAULT_PLAYGROUND_ID).toBe("ocean-reef")
    expect(get("ocean-reef")?.id).toBe("ocean-reef")
    expect(resolvePlaygroundId(null)).toBe("ocean-reef")
    expect(resolvePlaygroundId("missing")).toBe("ocean-reef")
  })
})

describe("ocean-reef entity parity", () => {
  it("generates the same coral and trash as the pixel-space helpers", () => {
    const state = oceanReef.createState(1)
    const coralPx = coralToPixelPieces(state.coral, state.view)
    const legacy = legacyCoral(400, 400)
    expect(coralPx).toHaveLength(legacy.length)
    for (let i = 0; i < legacy.length; i++) {
      expect(coralPx[i]!.x).toBeCloseTo(legacy[i]!.x, 10)
      expect(coralPx[i]!.y).toBeCloseTo(legacy[i]!.y, 10)
      expect(coralPx[i]!.radius).toBeCloseTo(legacy[i]!.radius, 10)
      expect(coralPx[i]!.color).toBe(legacy[i]!.color)
      expect(coralPx[i]!.kind).toBe(legacy[i]!.kind)
      expect(coralPx[i]!.angle).toBe(legacy[i]!.angle)
      expect(coralPx[i]!.seed).toBe(legacy[i]!.seed)
    }

    const legacyTrash = createInitialTrashItems(400, 400, coralPx, CORAL_REEF_TRASH_COUNT)
    expect(state.trash.length).toBe(legacyTrash.length)
    expect(state.trash.length).toBeGreaterThan(0)
    for (let i = 0; i < legacyTrash.length; i++) {
      const px = fieldMmToPixel(state.trash[i]!.xMm, state.trash[i]!.yMm, 400, 400)
      expect(px.x).toBeCloseTo(legacyTrash[i]!.x, 10)
      expect(px.y).toBeCloseTo(legacyTrash[i]!.y, 10)
      expect(state.trash[i]!.type).toBe(legacyTrash[i]!.type)
      expect(state.trash[i]!.scale).toBeCloseTo(0.85 + seededRandom(i) * 0.15, 10)
    }
  })
})

describe("ocean-reef scripted program parity", () => {
  it("drives a short program through the api and matches pose and score", () => {
    const world = { current: createOceanReefState(1) }
    const robot = { current: startRobot() }
    const consoleLines: string[] = []
    const api = oceanReef.createApi({
      robot,
      world,
      writeConsole: (text) => consoleLines.push(text),
      stopped: { current: false },
      rng: createRng(1),
    })

    expect(api.getPosition("X", "mm")).toBe(CORAL_REEF_START_MM.x)
    expect(api.getPosition("Y", "mm")).toBe(CORAL_REEF_START_MM.y)
    expect(api.getPositionAngle()).toBe(0)
    expect(reportedPositionMm(robot.current)).toEqual({ x: 0, y: -800 })

    robot.current = applyDrive(robot.current, "forward", 200, world.current.view)
    expect(api.getPosition("X", "mm")).toBe(0)
    expect(api.getPosition("Y", "mm")).toBe(-1000)

    const target = world.current.trash[0]!
    robot.current = {
      ...robot.current,
      xMm: target.xMm,
      yMm: target.yMm,
    }
    api.energize("magnet", "boost")
    world.current = oceanReef.tick(world.current, 16.67, robot.current)
    expect(world.current.trashCollected).toBeGreaterThanOrEqual(1)
    expect(world.current.trash[0]!.isCollected).toBe(true)
    expect(oceanReef.isMissionOver(world.current).over).toBe(false)

    const coral = world.current.coral[0]!
    robot.current = { ...robot.current, xMm: coral.xMm, yMm: coral.yMm }
    world.current = oceanReef.tick(world.current, 16.67, robot.current)
    const mission = oceanReef.isMissionOver(world.current)
    expect(mission.over).toBe(true)
    expect(mission.reason).toBe("coral")
    expect(mission.won).toBe(false)
    expect(consoleLines).toEqual([])
  })
})
