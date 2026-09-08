import { describe, expect, it } from "vitest"
import {
  ENEMY_COUNT,
  ENEMY_SPAWN_TABLE,
  MINERAL_COUNT,
  MINERAL_RESPAWN_MS,
  OBSTACLE_COUNT,
} from "@/playgrounds/rover-rescue/config"
import { enemyLevelFromBase } from "@/playgrounds/rover-rescue/entities"
import { pointInRiverHazard, pointOnBasePad, pointOnBridge, zoneFamilyAt } from "@/playgrounds/rover-rescue/map-spec"
import {
  createRoverRescueState,
  entityLists,
  markMineralUsed,
  riverHazardFromState,
  tickRoverRescue,
} from "@/playgrounds/rover-rescue/state"

function snapshot(state: ReturnType<typeof createRoverRescueState>) {
  const lists = entityLists(state)
  return JSON.stringify({
    obstacles: lists.obstacles.map((item) => ({ id: item.id, x: item.xMm, y: item.yMm, kind: item.kind, r: item.radiusMm })),
    minerals: lists.minerals.map((item) => ({ id: item.id, x: item.xMm, y: item.yMm, zone: item.zoneId, state: item.state })),
    enemies: lists.enemies.map((item) => ({
      id: item.id,
      x: item.xMm,
      y: item.yMm,
      kind: item.kind,
      color: item.serpentColor,
      level: item.level,
    })),
  })
}

describe("rover-rescue spawn", () => {
  const world = createRoverRescueState(7)

  it("reproduces the same entity lists for the same seed", () => {
    expect(snapshot(createRoverRescueState(7))).toBe(snapshot(createRoverRescueState(7)))
    expect(snapshot(createRoverRescueState(7))).not.toBe(snapshot(createRoverRescueState(8)))
  })

  it("stays inside the configured population bands", () => {
    expect(world.obstacles.length).toBe(OBSTACLE_COUNT)
    expect(world.minerals.length).toBe(MINERAL_COUNT)
    expect(world.enemies.length).toBe(ENEMY_COUNT)
    expect(world.obstacles.length).toBeGreaterThanOrEqual(120)
    expect(world.obstacles.length).toBeLessThanOrEqual(180)
    expect(world.minerals.length).toBeGreaterThanOrEqual(40)
    expect(world.minerals.length).toBeLessThanOrEqual(60)
    expect(world.enemies.length).toBeGreaterThanOrEqual(35)
    expect(world.enemies.length).toBeLessThanOrEqual(50)
  })

  it("never places an entity in the river, on a bridge, on the base, or on another entity", () => {
    const hazard = riverHazardFromState(world)
    const all = [...world.obstacles, ...world.minerals, ...world.enemies]
    for (const entity of all) {
      const pos = { x: entity.xMm, y: entity.yMm }
      expect(pointInRiverHazard(pos, hazard), entity.id).toBe(false)
      expect(pointOnBridge(pos), entity.id).toBe(false)
      expect(pointOnBasePad(pos), entity.id).toBe(false)
    }
    for (const entity of all) {
      const hits = world.index.queryRadius(entity.xMm, entity.yMm, entity.radiusMm ?? 0)
      const others = hits.filter((item) => item.id !== entity.id)
      for (const other of others) {
        const gap = Math.hypot(other.xMm - entity.xMm, other.yMm - entity.yMm)
        expect(gap, `${entity.id} vs ${other.id}`).toBeGreaterThan(12)
      }
    }
  })

  it("respects the zone enemy table and levels by distance from base", () => {
    for (const enemy of world.enemies) {
      const family = zoneFamilyAt(enemy.posMm)
      expect(family, enemy.id).not.toBeNull()
      const table = ENEMY_SPAWN_TABLE[family!]
      if (enemy.kind === "spider") {
        expect(enemy.serpentColor).toBeNull()
        expect(table.spiders).toBeGreaterThan(0)
      } else {
        expect(enemy.serpentColor).toBe(table.serpentColor)
        expect(table.serpents).toBeGreaterThan(0)
      }
      if (family === "A" || family === "B") expect(enemy.kind).toBe("spider")
      expect(enemy.level).toBe(enemyLevelFromBase(enemy.posMm))
    }
    const nearest = [...world.enemies].sort(
      (a, b) => Math.hypot(a.xMm + 5750, a.yMm + 2650) - Math.hypot(b.xMm + 5750, b.yMm + 2650),
    )[0]
    const farthest = [...world.enemies].sort(
      (a, b) => Math.hypot(b.xMm + 5750, b.yMm + 2650) - Math.hypot(a.xMm + 5750, a.yMm + 2650),
    )[0]
    expect(farthest.level).toBeGreaterThanOrEqual(nearest.level)
  })

  it("respawns minerals only in C, D, and E", () => {
    const field = world.minerals.find((mineral) => mineral.zoneId === "C")
    expect(field).toBeTruthy()
    const used = markMineralUsed(world, field!.id)
    expect(used.mineralRespawns[0]?.zoneId).toBe("C")
    const later = tickRoverRescue(used, MINERAL_RESPAWN_MS.C + 50)
    expect(later.minerals.filter((mineral) => mineral.state === "field").length).toBeGreaterThanOrEqual(world.minerals.length)

    const zoneA = world.minerals.find((mineral) => mineral.zoneId === "A")
    const usedA = markMineralUsed(world, zoneA!.id)
    expect(usedA.mineralRespawns).toHaveLength(0)
  })
})
