/**
 * Mineral handling. Per the VEX documentation a sample is used where it lies —
 * the rover drives up to it and consumes it — so `use` looks at the ground
 * rather than at cargo.
 */

import type { Vec2 } from "@/engine"
import { MINERAL_USE_RANGE_MM } from "../config"
import type { MineralEntity } from "../entities"

/** Closest sample on the ground the rover could use from where it is standing. */
export function nearestUsableMineral(
  minerals: readonly MineralEntity[],
  rover: Vec2,
  rangeMm = MINERAL_USE_RANGE_MM,
): MineralEntity | null {
  let best: MineralEntity | null = null
  let bestGap = Infinity
  for (const mineral of minerals) {
    if (mineral.state !== "field") continue
    const gap = Math.hypot(mineral.xMm - rover.x, mineral.yMm - rover.y)
    if (gap > rangeMm || gap >= bestGap) continue
    best = mineral
    bestGap = gap
  }
  return best
}

export function parseMineralAction(raw: string): "use" | "pickup" | "drop" | null {
  const key = String(raw).trim().toLowerCase()
  if (key === "use") return "use"
  if (key === "pickup" || key === "pick up") return "pickup"
  if (key === "drop") return "drop"
  return null
}
