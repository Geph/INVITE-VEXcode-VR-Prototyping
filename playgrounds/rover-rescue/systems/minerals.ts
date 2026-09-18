/**
 * Mineral handling. Per the VEX documentation a sample is used where it lies —
 * cargo cannot be used — so `use` looks at the ground. Pick up and drop are
 * the cargo path: carry samples back to Base for the larger XP award.
 *
 * See github.com/Geph/INVITE-VEXcode-VR-Prototyping/issues/3 if a live
 * VEXcode session ever shows `use` consuming cargo instead.
 */

import type { Vec2 } from "@/engine"
import { MINERAL_USE_RANGE_MM } from "../config"
import type { MineralEntity } from "../entities"

/** Closest sample on the ground the rover could use or pick up from here. */
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

export type PickupFail = "none" | "full"

export type PickupPatch =
  | { ok: true; minerals: MineralEntity[]; storage: string[] }
  | { ok: false; reason: PickupFail }

/**
 * Lift the nearest sample into storage. Capacity is the rover's current
 * level, so a full hold is a no-op rather than kicking something out.
 */
export function pickupNearestMineral(
  minerals: readonly MineralEntity[],
  storage: readonly string[],
  rover: Vec2,
  capacity: number,
): PickupPatch {
  if (storage.length >= capacity) return { ok: false, reason: "full" }
  const target = nearestUsableMineral(minerals, rover)
  if (!target) return { ok: false, reason: "none" }
  return {
    ok: true,
    minerals: minerals.map((mineral) =>
      mineral.id === target.id ? { ...mineral, state: "carried" as const } : mineral,
    ),
    storage: [...storage, target.id],
  }
}

export type DropPatch = { ok: true; minerals: MineralEntity[]; storage: string[] } | { ok: false }

/**
 * Put the most recently picked sample back on the ground at the rover's
 * feet. Next tick will shove it clear of the hull the same way a drive does.
 */
export function dropLatestMineral(
  minerals: readonly MineralEntity[],
  storage: readonly string[],
  rover: Vec2,
): DropPatch {
  if (storage.length === 0) return { ok: false }
  const id = storage[storage.length - 1]
  const rest = storage.slice(0, -1)
  return {
    ok: true,
    storage: rest,
    minerals: minerals.map((mineral) => {
      if (mineral.id !== id) return mineral
      return {
        ...mineral,
        xMm: rover.x,
        yMm: rover.y,
        posMm: { x: rover.x, y: rover.y },
        state: "field" as const,
      }
    }),
  }
}

export type DeliveryPatch = { minerals: MineralEntity[]; delivered: MineralEntity[] } | null

/** Mark every carried sample delivered. XP is applied by the state wrapper. */
export function markStorageDelivered(
  minerals: readonly MineralEntity[],
  storage: readonly string[],
): DeliveryPatch {
  if (storage.length === 0) return null
  const ids = new Set(storage)
  const delivered: MineralEntity[] = []
  const next = minerals.map((mineral) => {
    if (!ids.has(mineral.id) || mineral.state !== "carried") return mineral
    const banked = { ...mineral, state: "delivered" as const }
    delivered.push(banked)
    return banked
  })
  if (delivered.length === 0) return null
  return { minerals: next, delivered }
}
