import { SpatialHash, createRng, pointInPolygon, type SeededRng, type Vec2 } from "@/engine"
import {
  ENEMY_SPAWN_TABLE,
  FIELD_BOUNDS,
  MINERAL_COUNT,
  MINERAL_RESPAWN_MS,
  MINERALS_PER_ZONE,
  MINERAL_RADIUS_MM,
  OBSTACLE_COUNT,
  OBSTACLE_SPACING_MM,
  OBSTACLE_SPACING_ROCKY_MM,
  PLANT_RADIUS_MAX_MM,
  PLANT_RADIUS_MIN_MM,
  ROCK_RADIUS_MAX_MM,
  ROCK_RADIUS_MIN_MM,
  SERPENT_RADIUS_MM,
  SPIDER_RADIUS_MM,
} from "../config"
import {
  createEnemy,
  createMineral,
  createObstacle,
  type EnemyEntity,
  type MineralEntity,
  type ObstacleEntity,
  type RoverEntity,
} from "../entities"
import {
  TERRAIN_BANDS,
  ZONES,
  zoneFamilyAt,
  zoneFamilyId,
  type BridgeSpec,
  type RiverHazard,
  type ZoneFamily,
  type ZoneSpec,
} from "../map-spec"
import { isForbiddenEnemySpawn, isForbiddenSpawn } from "./physics"

export interface SpawnedWorld {
  obstacles: ObstacleEntity[]
  minerals: MineralEntity[]
  enemies: EnemyEntity[]
}

export function spawnWorld(
  seed: number,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  zones: readonly ZoneSpec[] = ZONES,
): SpawnedWorld {
  const rng = createRng(seed)
  const index = new SpatialHash<RoverEntity>(500)
  const obstacles = scatterObstacles(rng.fork("obstacles"), index, hazard, bridges)
  const minerals = scatterMinerals(rng.fork("minerals"), index, hazard, bridges, zones)
  const enemies = scatterEnemies(rng.fork("enemies"), index, hazard, bridges, zones)
  return { obstacles, minerals, enemies }
}

function scatterObstacles(
  rng: SeededRng,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
): ObstacleEntity[] {
  const out: ObstacleEntity[] = []
  let attempts = 0
  const maxAttempts = OBSTACLE_COUNT * 60
  while (out.length < OBSTACLE_COUNT && attempts < maxAttempts) {
    attempts++
    const pos = randomFieldPoint(rng)
    const rocky = isRocky(pos)
    const radius = rocky
      ? rng.int(ROCK_RADIUS_MIN_MM, ROCK_RADIUS_MAX_MM)
      : rng.int(PLANT_RADIUS_MIN_MM, PLANT_RADIUS_MAX_MM)
    if (isForbiddenSpawn(pos, hazard, bridges)) continue
    const spacing = rocky ? OBSTACLE_SPACING_ROCKY_MM : OBSTACLE_SPACING_MM
    if (tooClose(pos, radius, spacing, index)) continue
    const kind = rocky || rng.next() < 0.35 ? "rock" : "plant"
    const entity = createObstacle(`${kind}-${out.length}`, pos, kind, radius, rng.int(1, 1_000_000))
    out.push(entity)
    index.insert(entity)
  }
  return out
}

function scatterMinerals(
  rng: SeededRng,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  zones: readonly ZoneSpec[],
): MineralEntity[] {
  const out: MineralEntity[] = []
  for (const [family, count] of Object.entries(MINERALS_PER_ZONE) as [ZoneFamily, number][]) {
    const polygons = zonesForFamily(zones, family)
    let placed = 0
    let attempts = 0
    while (placed < count && attempts < count * 80) {
      attempts++
      const polygon = rng.pick(polygons)
      const pos = samplePolygon(rng, polygon.polygonMm)
      if (!pos || isForbiddenSpawn(pos, hazard, bridges)) continue
      if (zoneFamilyAt(pos, zones) !== family) continue
      if (tooClose(pos, MINERAL_RADIUS_MM, MINERAL_RADIUS_MM * 2, index)) continue
      const entity = createMineral(`mineral-${out.length}`, pos, family)
      out.push(entity)
      index.insert(entity)
      placed++
    }
  }
  if (out.length !== MINERAL_COUNT) {
    // Counts are config — keep going on leftover field samples if a zone was tight.
    let attempts = 0
    while (out.length < MINERAL_COUNT && attempts < 400) {
      attempts++
      const zone = rng.pick(zones)
      const pos = samplePolygon(rng, zone.polygonMm)
      if (!pos || isForbiddenSpawn(pos, hazard, bridges)) continue
      if (tooClose(pos, MINERAL_RADIUS_MM, MINERAL_RADIUS_MM * 2, index)) continue
      const entity = createMineral(`mineral-${out.length}`, pos, zoneFamilyId(zone.id))
      out.push(entity)
      index.insert(entity)
    }
  }
  return out
}

function scatterEnemies(
  rng: SeededRng,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  zones: readonly ZoneSpec[],
): EnemyEntity[] {
  const out: EnemyEntity[] = []
  for (const [family, table] of Object.entries(ENEMY_SPAWN_TABLE) as [
    ZoneFamily,
    (typeof ENEMY_SPAWN_TABLE)[ZoneFamily],
  ][]) {
    const polygons = zonesForFamily(zones, family)
    const jobs: Array<{ kind: "spider" | "serpent" }> = [
      ...Array.from({ length: table.spiders }, () => ({ kind: "spider" as const })),
      ...Array.from({ length: table.serpents }, () => ({ kind: "serpent" as const })),
    ]
    for (const job of jobs) {
      const entity = placeEnemyInZone(rng, job.kind, table.serpentColor, family, polygons, index, hazard, bridges, out.length)
      if (entity) {
        out.push(entity)
        index.insert(entity)
      }
    }
  }
  return out
}

function placeEnemyInZone(
  rng: SeededRng,
  kind: "spider" | "serpent",
  serpentColor: "orange" | "blue" | "purple" | null,
  family: ZoneFamily,
  polygons: readonly ZoneSpec[],
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  ordinal: number,
): EnemyEntity | null {
  for (let attempt = 0; attempt < 80; attempt++) {
    const polygon = rng.pick(polygons)
    const pos = samplePolygon(rng, polygon.polygonMm)
    if (!pos || isForbiddenEnemySpawn(pos, hazard, bridges)) continue
    if (zoneFamilyAt(pos) !== family) continue
    const radius = kind === "serpent" ? SERPENT_RADIUS_MM : SPIDER_RADIUS_MM
    if (tooClose(pos, radius, radius * 1.6, index)) continue
    return createEnemy({
      id: `${kind}-${family}-${ordinal}`,
      posMm: pos,
      kind,
      serpentColor,
      artSeed: rng.int(1, 1_000_000),
      wanderPhase: rng.next(),
    })
  }
  return null
}

function tooClose(pos: Vec2, radiusMm: number, minSpacing: number, index: SpatialHash<RoverEntity>): boolean {
  const hits = index.queryRadius(pos.x, pos.y, minSpacing + radiusMm)
  return hits.some((item) => Math.hypot(item.xMm - pos.x, item.yMm - pos.y) < minSpacing + (item.radiusMm ?? 0) * 0.35)
}

function isRocky(pos: Vec2): boolean {
  const rock = TERRAIN_BANDS.find((band) => band.id === "dark-rock")
  return rock ? pointInPolygon(pos, rock.polygonMm) : false
}

function zonesForFamily(zones: readonly ZoneSpec[], family: ZoneFamily): ZoneSpec[] {
  return zones.filter((zone) => zoneFamilyId(zone.id) === family)
}

function randomFieldPoint(rng: SeededRng): Vec2 {
  return {
    x: FIELD_BOUNDS.minX + rng.next() * (FIELD_BOUNDS.maxX - FIELD_BOUNDS.minX),
    y: FIELD_BOUNDS.minY + rng.next() * (FIELD_BOUNDS.maxY - FIELD_BOUNDS.minY),
  }
}

export interface MineralRespawn {
  zoneId: ZoneFamily
  dueMs: number
}

export function scheduleMineralRespawn(
  mineral: MineralEntity,
  elapsedMs: number,
): MineralRespawn | null {
  if (mineral.state === "field") return null
  const family = mineral.zoneId as ZoneFamily
  const delay = MINERAL_RESPAWN_MS[family as keyof typeof MINERAL_RESPAWN_MS]
  if (delay == null) return null
  return { zoneId: family, dueMs: elapsedMs + delay }
}

export function applyMineralRespawns(
  minerals: readonly MineralEntity[],
  queue: readonly MineralRespawn[],
  elapsedMs: number,
  rng: SeededRng,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  zones: readonly ZoneSpec[] = ZONES,
): { minerals: MineralEntity[]; queue: MineralRespawn[] } {
  const nextMinerals = minerals.slice()
  const nextQueue: MineralRespawn[] = []
  for (const job of queue) {
    if (job.dueMs > elapsedMs) {
      nextQueue.push(job)
      continue
    }
    const spawned = tryRespawnMineral(rng, job.zoneId, nextMinerals.length, index, hazard, bridges, zones)
    if (spawned) {
      nextMinerals.push(spawned)
      index.insert(spawned)
    } else {
      nextQueue.push({ ...job, dueMs: elapsedMs + 1000 })
    }
  }
  return { minerals: nextMinerals, queue: nextQueue }
}

function tryRespawnMineral(
  rng: SeededRng,
  family: ZoneFamily,
  ordinal: number,
  index: SpatialHash<RoverEntity>,
  hazard: RiverHazard,
  bridges: readonly BridgeSpec[],
  zones: readonly ZoneSpec[],
): MineralEntity | null {
  const polygons = zonesForFamily(zones, family)
  if (polygons.length === 0) return null
  for (let i = 0; i < 40; i++) {
    const polygon = rng.pick(polygons)
    const pos = samplePolygon(rng, polygon.polygonMm)
    if (!pos || isForbiddenSpawn(pos, hazard, bridges)) continue
    if (zoneFamilyAt(pos, zones) !== family) continue
    if (tooClose(pos, MINERAL_RADIUS_MM, MINERAL_RADIUS_MM * 2, index)) continue
    return createMineral(`mineral-${ordinal}-${family}`, pos, family)
  }
  return null
}

function samplePolygon(rng: SeededRng, polygon: readonly Vec2[]): Vec2 | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of polygon) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  for (let i = 0; i < 40; i++) {
    const pos = { x: minX + rng.next() * (maxX - minX), y: minY + rng.next() * (maxY - minY) }
    if (pointInPolygon(pos, polygon)) return pos
  }
  return null
}
