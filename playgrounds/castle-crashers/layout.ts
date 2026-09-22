/**
 * Initial Castle Crasher+ layout in world millimetres.
 * Positions are TUNABLE approximations of the official start/cleared screenshots;
 * they are not DOC numbers.
 */

import { createRng } from "@/engine/rng"
import { HEX_RADIUS_MM, PIECE_WEIGHT_KG } from "./config"

export type PieceKind = "wall" | "turret" | "castle-wall" | "tower" | "keep" | "rock" | "tree" | "roof" | "ramp"

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

export function level1Layout(): CastlePieceSpec[] {
  // Traced proportions from the reference, not official measured coordinates.
  // The castle is left of the island centre; the robot and rocks occupy the east lawn.
  const ring = [
    { x: -380, y: 880 }, { x: 310, y: 450 }, { x: 310, y: -550 },
    { x: -380, y: -940 }, { x: -1060, y: -550 }, { x: -1040, y: 450 },
  ]
  const pieces: CastlePieceSpec[] = []
  const add = (id: string, kind: PieceKind, xMm: number, yMm: number, halfWMm: number,
    halfHMm: number, weightKg: number, headingDeg = 0) => {
    pieces.push({ id, kind, xMm, yMm, halfWMm, halfHMm, weightKg: PIECE_WEIGHT_KG[kind], headingDeg, pushable: weightKg > 0 })
  }
  for (let i = 0; i < 6; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const angle = Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI
    // Separate wall sections remain identifiable when scattered across the lawn.
    for (let j = 0; j < 3; j++) {
      const t = (j + 0.5) / 3
      add(`wall-${i}-${j}`, "wall", a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t,
        length / 6 + 1, 46, 40 / 3, angle)
    }
    add(`turret-${i}`, i >= 4 ? "tower" : "turret", a.x, a.y, 66, 66, 55, i >= 4 ? -10 : 0)
  }
  const cx = -450, cy = -45, r = 280
  add("keep-base", "keep", cx, cy, 216, 216, 120)
  add("keep-ramp", "ramp", cx + 418, cy, 82, 62, 20)
  for (let side = 0; side < 4; side++) {
    for (let j = 0; j < 2; j++) {
      const t = (j === 0 ? -1 : 1) * 108
      add(`inner-wall-${side}-${j}`, "castle-wall", cx + (side % 2 ? (side === 1 ? r : -r) : t),
        cy + (side % 2 ? t : (side === 0 ? r : -r)), 106, 48, 20, side % 2 ? 90 : 0)
    }
  }
  for (const [name, x, y] of [["nw", -r, r], ["ne", r, r], ["sw", -r, -r], ["se", r, -r]] as const) {
    add(`keep-${name}`, "tower", cx + x, cy + y, 59, 59, 25)
  }
  add("keep-spire-nw", "tower", cx - 145, cy + 140, 54, 54, 25)
  add("keep-spire-se", "tower", cx + 145, cy - 140, 54, 54, 25)
  add("keep-roof", "roof", cx, cy, 74, 74, 30)
  add("rock-a", "rock", 550, 595, 82, 78, 0, 15)
  add("rock-b", "rock", 795, 585, 70, 67, 0, -20)
  add("rock-c", "rock", 690, 440, 44, 45, 0, 40)
  add("rock-d", "rock", 520, -680, 70, 68, 0, 5)
  return pieces
}

/** TUNABLE: the Advanced hedge, traced from the reference's dense right-hand tree line. */
const HEDGE_ROWS = [
  { insetMm: 110, stepMm: 98, minHalfMm: 56, maxHalfMm: 86 },
  { insetMm: 228, stepMm: 126, minHalfMm: 46, maxHalfMm: 70 },
]
const HEDGE_JITTER_MM = 26
/** Fixed seed so Advanced always lays out the same forest. */
const HEDGE_SEED = 0x5eed

/**
 * Advanced only: an unbroken band of immovable trees hugging the red border
 * down the whole right side, spilling just past the north and south vertices.
 */
export function level2Trees(): CastlePieceSpec[] {
  const verts = hexVertices()
  // Vertex order: S, SE, NE, N, NW, SW. Walk the hedge from just before N round to just after S.
  const runs: Array<{ edge: number; from: number; to: number }> = [
    { edge: 3, from: 0, to: 0.12 },
    { edge: 2, from: 0, to: 1 },
    { edge: 1, from: 0, to: 1 },
    { edge: 0, from: 0, to: 1 },
    { edge: 5, from: 0.88, to: 1 },
  ]
  const rng = createRng(HEDGE_SEED).fork("castle-hedge")
  const trees: CastlePieceSpec[] = []
  for (const [rowIndex, row] of HEDGE_ROWS.entries()) {
    for (const run of runs) {
      const a = verts[run.edge]
      const b = verts[(run.edge + 1) % verts.length]
      const edgeLen = Math.hypot(b.x - a.x, b.y - a.y)
      const tx = (b.x - a.x) / edgeLen
      const ty = (b.y - a.y) / edgeLen
      // Regular hex centred at origin: the inward normal points from the edge midpoint to the centre.
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const midLen = Math.hypot(midX, midY)
      const nx = -midX / midLen
      const ny = -midY / midLen
      // Stagger the back row so canopies interleave instead of stacking.
      const start = run.from * edgeLen + (rowIndex % 2) * row.stepMm * 0.5
      for (let s = start; s <= run.to * edgeLen; s += row.stepMm) {
        const along = s + (rng.next() - 0.5) * 2 * HEDGE_JITTER_MM
        const inset = row.insetMm + (rng.next() - 0.5) * 2 * HEDGE_JITTER_MM
        const half = rng.int(row.minHalfMm, row.maxHalfMm)
        trees.push({
          id: `tree-r${rowIndex}-e${run.edge}-${trees.length}`,
          kind: "tree",
          xMm: Math.round(a.x + tx * along + nx * inset),
          yMm: Math.round(a.y + ty * along + ny * inset),
          headingDeg: rng.int(0, 359),
          halfWMm: half,
          halfHMm: half,
          weightKg: 0,
          pushable: false,
        })
      }
    }
  }
  return trees
}
