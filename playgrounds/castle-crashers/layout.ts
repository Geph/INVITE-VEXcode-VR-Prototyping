/**
 * Initial Castle Crasher+ layout in world millimetres.
 * Positions are TUNABLE approximations of the official start/cleared screenshots;
 * they are not DOC numbers.
 */

import { HEX_RADIUS_MM } from "./config"

export type PieceKind = "wall" | "tower" | "keep" | "rock" | "tree" | "roof"

export interface CastlePieceSpec {
  id: string
  kind: PieceKind
  xMm: number
  yMm: number
  headingDeg: number
  /** Half-extents for axis-aligned push boxes before rotation. */
  halfWMm: number
  halfHMm: number
  /** DOC telemetry reports weight_cleared in kg. Rocks/trees are not pushable. */
  weightKg: number
  pushable: boolean
}

/** Pointy-top hex vertices, centered at origin. */
export function hexVertices(radiusMm = HEX_RADIUS_MM): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < 6; i++) {
    const angle = (-90 + i * 60) * (Math.PI / 180)
    points.push({ x: radiusMm * Math.cos(angle), y: radiusMm * Math.sin(angle) })
  }
  return points
}

/** Outer wall ring sits inside the red border. */
const WALL_R = HEX_RADIUS_MM * 0.72

export function level1Layout(): CastlePieceSpec[] {
  const walls: CastlePieceSpec[] = []
  for (let i = 0; i < 6; i++) {
    // Leave the east face open so the robot can enter, matching the start screenshot.
    if (i === 1) continue
    const a0 = (-90 + i * 60) * (Math.PI / 180)
    const a1 = (-90 + (i + 1) * 60) * (Math.PI / 180)
    const x = ((Math.cos(a0) + Math.cos(a1)) / 2) * WALL_R
    const y = ((Math.sin(a0) + Math.sin(a1)) / 2) * WALL_R
    const headingDeg = (-60 + i * 60)
    walls.push({
      id: `wall-${i}`,
      kind: "wall",
      xMm: x,
      yMm: y,
      headingDeg,
      halfWMm: 220,
      halfHMm: 55,
      weightKg: 40,
      pushable: true,
    })
    walls.push({
      id: `turret-${i}`,
      kind: "tower",
      xMm: Math.cos(a0) * WALL_R,
      yMm: Math.sin(a0) * WALL_R,
      headingDeg: 0,
      halfWMm: 70,
      halfHMm: 70,
      weightKg: 55,
      pushable: true,
    })
  }

  const keep: CastlePieceSpec[] = [
    { id: "keep-base", kind: "keep", xMm: -80, yMm: 40, headingDeg: 0, halfWMm: 160, halfHMm: 160, weightKg: 120, pushable: true },
    { id: "keep-nw", kind: "tower", xMm: -220, yMm: 180, headingDeg: 0, halfWMm: 45, halfHMm: 45, weightKg: 25, pushable: true },
    { id: "keep-ne", kind: "tower", xMm: 60, yMm: 180, headingDeg: 0, halfWMm: 45, halfHMm: 45, weightKg: 25, pushable: true },
    { id: "keep-sw", kind: "tower", xMm: -220, yMm: -100, headingDeg: 0, halfWMm: 45, halfHMm: 45, weightKg: 25, pushable: true },
    { id: "keep-se", kind: "tower", xMm: 60, yMm: -100, headingDeg: 0, halfWMm: 45, halfHMm: 45, weightKg: 25, pushable: true },
    { id: "keep-ramp", kind: "wall", xMm: 200, yMm: 40, headingDeg: 0, halfWMm: 80, halfHMm: 40, weightKg: 20, pushable: true },
  ]

  const rocks: CastlePieceSpec[] = [
    { id: "rock-a", kind: "rock", xMm: 620, yMm: 420, headingDeg: 15, halfWMm: 70, halfHMm: 55, weightKg: 0, pushable: false },
    { id: "rock-b", kind: "rock", xMm: 760, yMm: 360, headingDeg: -20, halfWMm: 60, halfHMm: 50, weightKg: 0, pushable: false },
    { id: "rock-c", kind: "rock", xMm: 700, yMm: 250, headingDeg: 40, halfWMm: 55, halfHMm: 45, weightKg: 0, pushable: false },
    { id: "rock-d", kind: "rock", xMm: 780, yMm: -380, headingDeg: 0, halfWMm: 75, halfHMm: 60, weightKg: 0, pushable: false },
  ]

  return [...walls, ...keep, ...rocks]
}

export function level2Trees(): CastlePieceSpec[] {
  return [
    { id: "tree-1", kind: "tree", xMm: 400, yMm: -500, headingDeg: 0, halfWMm: 50, halfHMm: 50, weightKg: 0, pushable: false },
    { id: "tree-2", kind: "tree", xMm: -500, yMm: 300, headingDeg: 0, halfWMm: 50, halfHMm: 50, weightKg: 0, pushable: false },
    { id: "tree-3", kind: "tree", xMm: 200, yMm: 600, headingDeg: 0, halfWMm: 50, halfHMm: 50, weightKg: 0, pushable: false },
  ]
}
