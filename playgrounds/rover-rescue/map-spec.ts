/**
 * Pure map data for Rover Rescue. Vertices are the traced draft from
 * ROVER-RESCUE-SPEC.md (world mm, +Y = north). Paint zones in array order
 * so later entries win on overlap.
 */

import { pointInPolygon, type Vec2 } from "@/engine"
import {
  BASE_PAD_CENTRE_MM,
  BASE_PAD_RADIUS_MM,
  FIELD_MAX_X_MM,
  FIELD_MAX_Y_MM,
  FIELD_MIN_X_MM,
  FIELD_MIN_Y_MM,
} from "./config"

export interface ZoneSpec {
  id: string
  label: string
  polygonMm: Vec2[]
  tintColor: string
}

export interface BridgeSpec {
  id: string
  centreMm: Vec2
  orientation: "NS" | "EW"
  widthMm: number
  lengthMm: number
}

export interface TerrainBandSpec {
  id: string
  label: string
  polygonMm: Vec2[]
  fillColor: string
}

export interface RiverHazard {
  outer: Vec2[]
  holes: Vec2[][]
}

const ZONE_B_WEST: Vec2[] = [
  { x: -6000, y: -2800 },
  { x: -6000, y: 1000 },
  { x: -4200, y: 1100 },
  { x: -3000, y: 600 },
  { x: -1400, y: -500 },
  { x: -3000, y: -1200 },
  { x: -4600, y: -1700 },
  { x: -6000, y: -1950 },
]

const ZONE_B_EAST: Vec2[] = [
  { x: 1500, y: -3000 },
  { x: 5900, y: -3000 },
  { x: 5900, y: 300 },
  { x: 2000, y: 300 },
  { x: 1200, y: -1900 },
]

const ZONE_A: Vec2[] = [
  { x: -5930, y: -2790 },
  { x: -5930, y: -1960 },
  { x: -4620, y: -1700 },
  { x: -3020, y: -1170 },
  { x: -1420, y: -490 },
  { x: -40, y: 220 },
  { x: 620, y: 120 },
  { x: 840, y: -1240 },
  { x: 690, y: -2380 },
  { x: 470, y: -2790 },
]

const ZONE_C: Vec2[] = [
  { x: -2440, y: 3000 },
  { x: 3530, y: 3000 },
  { x: 3530, y: 480 },
  { x: 5850, y: 480 },
  { x: 5850, y: -1240 },
  { x: 2070, y: -1240 },
  { x: 2070, y: 620 },
  { x: -2440, y: 480 },
]

const ZONE_D: Vec2[] = [
  { x: 2900, y: 480 },
  { x: 6000, y: 480 },
  { x: 6000, y: 3000 },
  { x: 2900, y: 3000 },
]

const ZONE_E: Vec2[] = [
  { x: 4250, y: 1700 },
  { x: 6000, y: 1700 },
  { x: 6000, y: 3000 },
  { x: 4250, y: 3000 },
]

/** Spec colours: A blue, B grey, C orange, D red, E purple. */
export const ZONES: ZoneSpec[] = [
  { id: "B_WEST", label: "Zone B", polygonMm: ZONE_B_WEST, tintColor: "rgba(120, 124, 132, 0.28)" },
  { id: "B_EAST", label: "Zone B", polygonMm: ZONE_B_EAST, tintColor: "rgba(120, 124, 132, 0.28)" },
  { id: "A", label: "Zone A", polygonMm: ZONE_A, tintColor: "rgba(70, 130, 200, 0.26)" },
  { id: "C", label: "Zone C", polygonMm: ZONE_C, tintColor: "rgba(210, 120, 48, 0.26)" },
  { id: "D", label: "Zone D", polygonMm: ZONE_D, tintColor: "rgba(196, 64, 64, 0.28)" },
  { id: "E", label: "Zone E", polygonMm: ZONE_E, tintColor: "rgba(140, 88, 196, 0.30)" },
]

export const RIVER_CENTERLINE: Vec2[] = [
  { x: -6000, y: 1410 },
  { x: -4760, y: 1200 },
  { x: -3310, y: 980 },
  { x: -2000, y: 1200 },
  { x: -840, y: 980 },
  { x: 330, y: 770 },
  { x: 910, y: 190 },
  { x: 1060, y: -950 },
  { x: 1200, y: -1950 },
  { x: 1490, y: -2670 },
  { x: 2200, y: -3000 },
]

export const RIVER_WIDTH_MM = 800

export const BRIDGES: BridgeSpec[] = [
  { id: "north", centreMm: { x: -3500, y: 1240 }, orientation: "NS", widthMm: 700, lengthMm: 1400 },
  { id: "south", centreMm: { x: 1130, y: -1880 }, orientation: "EW", widthMm: 700, lengthMm: 1400 },
]

export const BASE = {
  centreMm: { x: BASE_PAD_CENTRE_MM.x, y: BASE_PAD_CENTRE_MM.y },
  radiusMm: BASE_PAD_RADIUS_MM,
}

/**
 * Coarse terrain bands reuse the traced zone outlines so every vertex is
 * a spec number. Dark rock = western highlands, ochre = Zone A valley,
 * dunes = eastern shelf.
 */
export const TERRAIN_BANDS: TerrainBandSpec[] = [
  {
    id: "dark-rock",
    label: "Dark rock",
    polygonMm: ZONE_B_WEST,
    fillColor: "#3d342c",
  },
  {
    id: "ochre-desert",
    label: "Ochre desert",
    polygonMm: ZONE_A,
    fillColor: "#c4843a",
  },
  {
    id: "dunes",
    label: "Dunes",
    polygonMm: ZONE_B_EAST,
    fillColor: "#d2a05a",
  },
]

export const FIELD_RECT_MM: Vec2[] = [
  { x: FIELD_MIN_X_MM, y: FIELD_MIN_Y_MM },
  { x: FIELD_MAX_X_MM, y: FIELD_MIN_Y_MM },
  { x: FIELD_MAX_X_MM, y: FIELD_MAX_Y_MM },
  { x: FIELD_MIN_X_MM, y: FIELD_MAX_Y_MM },
]

export function cloneVec2(point: Vec2): Vec2 {
  return { x: point.x, y: point.y }
}

export function clonePolygon(polygon: readonly Vec2[]): Vec2[] {
  return polygon.map(cloneVec2)
}

export function offsetPolyline(centerline: readonly Vec2[], halfWidthMm: number): { left: Vec2[]; right: Vec2[] } {
  const left: Vec2[] = []
  const right: Vec2[] = []
  if (centerline.length === 0) return { left, right }
  if (centerline.length === 1) {
    left.push({ x: centerline[0].x, y: centerline[0].y + halfWidthMm })
    right.push({ x: centerline[0].x, y: centerline[0].y - halfWidthMm })
    return { left, right }
  }

  for (let i = 0; i < centerline.length; i++) {
    const prev = centerline[Math.max(0, i - 1)]
    const next = centerline[Math.min(centerline.length - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const p = centerline[i]
    left.push({ x: p.x + nx * halfWidthMm, y: p.y + ny * halfWidthMm })
    right.push({ x: p.x - nx * halfWidthMm, y: p.y - ny * halfWidthMm })
  }
  return { left, right }
}

export function riverOuterPolygon(centerline: readonly Vec2[], widthMm: number): Vec2[] {
  const { left, right } = offsetPolyline(centerline, widthMm / 2)
  return [...left, ...right.slice().reverse()]
}

export function bridgeDeckRect(bridge: BridgeSpec): Vec2[] {
  const halfAcross = bridge.widthMm / 2
  const halfAlong = bridge.lengthMm / 2
  const hx = bridge.orientation === "NS" ? halfAcross : halfAlong
  const hy = bridge.orientation === "NS" ? halfAlong : halfAcross
  const { x, y } = bridge.centreMm
  return [
    { x: x - hx, y: y - hy },
    { x: x + hx, y: y - hy },
    { x: x + hx, y: y + hy },
    { x: x - hx, y: y + hy },
  ]
}

export function deriveRiverHazard(
  centerline: readonly Vec2[] = RIVER_CENTERLINE,
  widthMm: number = RIVER_WIDTH_MM,
  bridges: readonly BridgeSpec[] = BRIDGES,
): RiverHazard {
  return {
    outer: riverOuterPolygon(centerline, widthMm),
    holes: bridges.map(bridgeDeckRect),
  }
}

export const RIVER_HAZARD: RiverHazard = deriveRiverHazard()

/** Even-odd: inside the offset channel, outside every bridge deck. */
export function pointInRiverHazard(point: Vec2, hazard: RiverHazard = RIVER_HAZARD): boolean {
  if (!pointInPolygon(point, hazard.outer)) return false
  for (const hole of hazard.holes) {
    if (pointInPolygon(point, hole)) return false
  }
  return true
}

export type ZoneFamily = "A" | "B" | "C" | "D" | "E"

export function zoneFamilyId(zoneId: string): ZoneFamily {
  if (zoneId === "B_WEST" || zoneId === "B_EAST" || zoneId === "B") return "B"
  if (zoneId === "A" || zoneId === "C" || zoneId === "D" || zoneId === "E") return zoneId
  return "A"
}

/** Later-painted zones win on overlap, matching the spec paint order. */
export function zoneAt(point: Vec2, zones: readonly ZoneSpec[] = ZONES): ZoneSpec | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (pointInPolygon(point, zones[i].polygonMm)) return zones[i]
  }
  return null
}

export function zoneFamilyAt(point: Vec2, zones: readonly ZoneSpec[] = ZONES): ZoneFamily | null {
  const zone = zoneAt(point, zones)
  return zone ? zoneFamilyId(zone.id) : null
}

export function pointOnBridge(point: Vec2, bridges: readonly BridgeSpec[] = BRIDGES): boolean {
  return bridges.some((bridge) => pointInPolygon(point, bridgeDeckRect(bridge)))
}

export function pointOnBasePad(point: Vec2, base = BASE): boolean {
  return Math.hypot(point.x - base.centreMm.x, point.y - base.centreMm.y) <= base.radiusMm
}

export function formatMapSpecAsTypeScript(input: {
  zones: readonly ZoneSpec[]
  riverCenterline: readonly Vec2[]
  bridges: readonly BridgeSpec[]
}): string {
  const pts = (polygon: readonly Vec2[]) =>
    `[${polygon.map((p) => `[${Math.round(p.x)},${Math.round(p.y)}]`).join(",")}]`
  const zones = input.zones
    .map((zone) => `  ${zone.id}: ${pts(zone.polygonMm)},`)
    .join("\n")
  const bridges = input.bridges
    .map(
      (b) =>
        `  { id: "${b.id}", centre: [${Math.round(b.centreMm.x)}, ${Math.round(b.centreMm.y)}], orientation: "${b.orientation}", widthMm: ${b.widthMm}, lengthMm: ${b.lengthMm} },`,
    )
    .join("\n")
  return [
    "ZONE_POLYGONS = {",
    zones,
    "}",
    `RIVER_CENTERLINE: ${pts(input.riverCenterline)}`,
    "BRIDGES: [",
    bridges,
    "]",
  ].join("\n")
}
