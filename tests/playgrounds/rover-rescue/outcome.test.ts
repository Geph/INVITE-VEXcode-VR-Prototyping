import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  ENEMY_HP_BY_LEVEL,
  ENEMY_RADIATION_BY_LEVEL,
  START_POSE,
  XP_USE_MINERAL,
} from "@/playgrounds/rover-rescue/config"
import { buildEntityIndex, createEnemy, createMineral } from "@/playgrounds/rover-rescue/entities"
import { BRIDGES } from "@/playgrounds/rover-rescue/map-spec"
import {
  absorbEnemyRadiation,
  createRoverRescueState,
  deliverStorageToBase,
  tickRoverRescue,
  useMineralOnGround,
} from "@/playgrounds/rover-rescue/state"
import { continuePastDay50 } from "@/playgrounds/rover-rescue/systems/day50"
import { roverPlaygroundData, withStoppedByUser } from "@/playgrounds/rover-rescue/systems/outcome"
import { roverRescue } from "@/playgrounds/rover-rescue"

const FIXTURE = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/telemetry/rover-rescue-outcome.json"), "utf8"),
) as ReturnType<typeof roverPlaygroundData>

const VEX_KEYS = [
  "days_explored",
  "experience_gained",
  "enemies_nuetralized",
  "minerals_consumed",
  "battery_remaining",
  "project_stopped_by_user",
] as const

function pose(xMm: number, yMm: number) {
  return { xMm, yMm, headingDeg: 0, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null }
}

describe("Rover Rescue playgroundData", () => {
  it("matches the checked-in seed-1 fixture, misspelling included", () => {
    const data = roverPlaygroundData(roverRescue.createState(1))
    expect(data).toEqual(FIXTURE)
    expect(Object.keys(data.parameters)).toEqual([...VEX_KEYS])
    expect("enemies_nuetralized" in data.parameters).toBe(true)
    expect("enemies_neutralized" in data.parameters).toBe(false)
  })

  it("does not leak _invite keys or gps into parameters", () => {
    const params = roverRescue.outcomeParameters!(roverRescue.createState(1))
    expect(Object.keys(params).sort()).toEqual([...VEX_KEYS].sort())
    expect(params).not.toHaveProperty("gps_x_position")
    expect(params).not.toHaveProperty("gps_y_position")
    expect(params).not.toHaveProperty("_invite")
    expect(params).not.toHaveProperty("schemaVersion")
    expect(params).not.toHaveProperty("seed")
  })

  it("counts a used sample and a delivered cargo load separately", () => {
    const mineral = createMineral("use-me", { x: 80, y: 0 }, "A")
    const used = useMineralOnGround(
      { ...createRoverRescueState(1), minerals: [mineral], index: buildEntityIndex({ obstacles: [], minerals: [mineral], enemies: [] }) },
      { x: 0, y: 0 },
    ).state
    expect(roverPlaygroundData(used).parameters.minerals_consumed).toBe(1)
    expect(roverPlaygroundData(used).parameters.experience_gained).toBe(XP_USE_MINERAL)

    const cargo = { ...createMineral("bank", { x: 0, y: 0 }, "A"), state: "carried" as const }
    const banked = deliverStorageToBase({
      ...createRoverRescueState(1),
      minerals: [cargo],
      storage: ["bank"],
    })
    const invite = roverPlaygroundData(banked)._invite
    expect(invite.mineralsDelivered).toBe(1)
    expect(roverPlaygroundData(banked).parameters.minerals_consumed).toBe(0)
  })

  it("keeps neutralized counts after Continue re-irradiates the field", () => {
    const spawned = createEnemy({
      id: "prey",
      posMm: { x: 0, y: 80 },
      kind: "spider",
      serpentColor: null,
      artSeed: 1,
      wanderPhase: 0,
    })
    const enemy = {
      ...spawned,
      level: 1,
      maxHp: ENEMY_HP_BY_LEVEL[1],
      hp: ENEMY_HP_BY_LEVEL[1],
      radiation: ENEMY_RADIATION_BY_LEVEL[1],
    }
    const world = {
      ...createRoverRescueState(1),
      enemies: [enemy],
      minerals: [],
      obstacles: [],
      index: buildEntityIndex({ obstacles: [], minerals: [], enemies: [enemy] }),
    }
    const absorbed = absorbEnemyRadiation(world, { x: 0, y: 0 }).state
    expect(roverPlaygroundData(absorbed).parameters.enemies_nuetralized).toBe(1)
    expect(roverPlaygroundData(absorbed)._invite.enemiesByType.spider).toBe(1)

    const continued = continuePastDay50(absorbed)
    expect(continued.enemies[0]?.state).not.toBe("neutralized")
    expect(roverPlaygroundData(continued).parameters.enemies_nuetralized).toBe(1)
  })

  it("accumulates travel, zones, and bridge crossings from the rover pose", () => {
    const start = createRoverRescueState(1)
    const moved = tickRoverRescue(start, 16, pose(START_POSE.xMm, START_POSE.yMm + 500), { missionRunning: true })
    expect(roverPlaygroundData(moved)._invite.distanceTravelledMm).toBeCloseTo(500, 5)

    const onDeck = tickRoverRescue(moved, 16, pose(BRIDGES[0].centreMm.x, BRIDGES[0].centreMm.y), {
      missionRunning: true,
    })
    expect(roverPlaygroundData(onDeck)._invite.bridgeCrossings).toBe(1)
    expect(roverPlaygroundData(onDeck)._invite.zonesVisited.length).toBeGreaterThan(0)
  })

  it("marks a STOP as project_stopped_by_user without widening parameters", () => {
    const stopped = withStoppedByUser(createRoverRescueState(1))
    const data = roverPlaygroundData(stopped)
    expect(data.parameters.project_stopped_by_user).toBe(true)
    expect(data._invite.endReason).toBe("stopped")
    expect(Object.keys(data.parameters)).toEqual([...VEX_KEYS])
  })
})
