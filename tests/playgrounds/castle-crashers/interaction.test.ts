import { describe, expect, it } from "vitest"
import { createCastleCrashersState, insideHex, resetCastleCrashersState } from "@/playgrounds/castle-crashers/state"
import { HEX_RADIUS_MM, PLOW_START, ROBOT_RADIUS_MM } from "@/playgrounds/castle-crashers/config"
import { hexVertices } from "@/playgrounds/castle-crashers/layout"
import { startRobot } from "@/playgrounds/castle-crashers"
import { clampCastleMm, tickCastlePhysics } from "@/playgrounds/castle-crashers/systems/physics"

describe("castle reference layout and interactions", () => {
  it("agrees with every drawn hex vertex and edge, including east/west flats", () => {
    const vertices = hexVertices()
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length]
      for (const p of [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }]) {
        expect(insideHex(p.x * 0.999, p.y * 0.999, HEX_RADIUS_MM)).toBe(true)
        expect(insideHex(p.x * 1.001, p.y * 1.001, HEX_RADIUS_MM)).toBe(false)
      }
    }
    for (let angle = 0; angle < 360; angle += 15) {
      const rad = angle * Math.PI / 180
      const p = clampCastleMm(Math.cos(rad) * 3000, Math.sin(rad) * 3000)
      expect(insideHex(p.xMm, p.yMm)).toBe(true)
    }
  })

  it("leaves the robot clear of masonry and all rocks outside the castle's east wall", () => {
    const state = createCastleCrashersState(1)
    const eastWallX = Math.max(...state.pieces.filter(p => p.id.startsWith("wall-")).map(p => p.xMm))
    const rocks = state.pieces.filter(p => p.kind === "rock")
    expect(rocks).toHaveLength(4)
    for (const p of rocks) {
      expect(p.xMm - p.halfWMm).toBeGreaterThan(eastWallX)
      expect(p.pushable).toBe(false)
    }
    const next = tickCastlePhysics(state, 16, startRobot(), true)
    expect(next.pieces).toEqual(state.pieces)
  })

  it("picks up the plow at the robot's front only while running, and resets it", () => {
    const state = createCastleCrashersState(1, 2)
    const robot = { ...startRobot(), xMm: PLOW_START.xMm, yMm: PLOW_START.yMm - ROBOT_RADIUS_MM, headingDeg: 0 }
    expect(tickCastlePhysics(state, 16, robot, false).plowAttached).toBe(false)
    expect(tickCastlePhysics(state, 16, { ...robot, headingDeg: 180 }, true).plowAttached).toBe(false)
    const picked = tickCastlePhysics(state, 16, robot, true)
    expect(picked.plowAttached).toBe(true)
    expect(state.plowAttached).toBe(false)
    const reset = resetCastleCrashersState(picked, 1)
    expect(reset.plowAttached).toBe(false)
    expect(reset.level).toBe(2)
    expect(reset.pieces.every(p => p.topple === 0 && !p.cleared)).toBe(true)
  })

  it("pushes at the blade's outer edge and topples only contacted masonry", () => {
    const state = createCastleCrashersState(1)
    const piece = { ...state.pieces.find(p => p.kind === "tower")!, xMm: 140, yMm: 110, halfWMm: 25, halfHMm: 25 }
    const fixture = { ...state, pieces: [piece], gpsXMm: 0, gpsYMm: -10 }
    const robot = { ...startRobot(), xMm: 0, yMm: 0, headingDeg: 0 }
    const bare = tickCastlePhysics(fixture, 16, robot, true)
    expect(bare.pieces[0]).toEqual(piece)
    const plowed = tickCastlePhysics({ ...fixture, plowAttached: true }, 16, robot, true)
    expect(plowed.pieces[0].xMm).toBeGreaterThan(piece.xMm)
    expect(plowed.pieces[0].topple).toBeGreaterThan(0)
    expect(piece.topple).toBe(0)
    expect(plowed.weightClearedKg).toBe(0)
    const idle = tickCastlePhysics(plowed, 16, robot, true)
    // The reference debris keeps sliding after contact, with friction.
    expect(idle.pieces[0].xMm).toBeGreaterThan(plowed.pieces[0].xMm)
    expect(idle.pieces[0].vxMmSec).toBeLessThan(plowed.pieces[0].vxMmSec)
  })

  it("does not push a long wall from outside its narrow rotated footprint", () => {
    const state = createCastleCrashersState(1)
    const wall = { ...state.pieces[0], xMm: 0, yMm: 0, halfWMm: 180, halfHMm: 30, headingDeg: 45 }
    const robot = { ...startRobot(), xMm: 125, yMm: 125 }
    const next = tickCastlePhysics({ ...state, pieces: [wall] }, 16, robot, true)
    expect(next.pieces[0]).toEqual(wall)
  })

  it("scores clearing once and leaves rocks fixed", () => {
    const state = createCastleCrashersState(1)
    const piece = state.pieces.find(p => p.pushable)!
    const rock = state.pieces.find(p => p.kind === "rock")!
    const fixture = { ...state, pieces: [{ ...piece, xMm: 1600, yMm: 0 }, rock] }
    const robot = { ...startRobot(), xMm: rock.xMm, yMm: rock.yMm }
    const next = tickCastlePhysics(fixture, 16, robot, true)
    expect(next.weightClearedKg).toBe(piece.weightKg)
    expect(next.pieces[1]).toEqual(rock)
    expect(tickCastlePhysics(next, 16, robot, true).weightClearedKg).toBe(piece.weightKg)
  })

  it("keeps Basic clear of trees and hedges Advanced's right border densely", () => {
    expect(createCastleCrashersState(1, 1).pieces.some((p) => p.kind === "tree")).toBe(false)
    const verts = hexVertices()
    // The hedge runs from the north vertex round the right side to the south vertex.
    const hedgeEdges = [0, 1, 2, 3, 5].map((i) => [verts[i], verts[(i + 1) % 6]] as const)
    const trees = createCastleCrashersState(1, 2).pieces.filter((p) => p.kind === "tree")
    expect(trees.length).toBeGreaterThan(50)
    // Deterministic: the same seed always plants the same forest.
    expect(createCastleCrashersState(9, 2).pieces.filter((p) => p.kind === "tree")).toEqual(trees)
    const robot = startRobot()
    for (const tree of trees) {
      expect(tree.pushable).toBe(false)
      expect(tree.xMm).toBeGreaterThan(-HEX_RADIUS_MM * 0.2)
      expect(insideHex(tree.xMm, tree.yMm)).toBe(true)
      const nearest = Math.min(...hedgeEdges.map(([a, b]) => distanceToSegment(tree.xMm, tree.yMm, a, b)))
      expect(nearest).toBeLessThan(300)
      expect(Math.hypot(tree.xMm - robot.xMm, tree.yMm - robot.yMm)).toBeGreaterThan(ROBOT_RADIUS_MM + tree.halfWMm)
    }
    // Every right-hand edge is lined end to end, not just dotted.
    for (const [a, b] of hedgeEdges.slice(0, 3)) {
      for (let t = 0.05; t < 1; t += 0.1) {
        const x = a.x + (b.x - a.x) * t
        const y = a.y + (b.y - a.y) * t
        expect(trees.some((tree) => Math.hypot(tree.xMm - x, tree.yMm - y) < 260)).toBe(true)
      }
    }
  })
})

function distanceToSegment(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2))
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t))
}
