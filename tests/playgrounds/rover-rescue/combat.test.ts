import { describe, expect, it } from "vitest"
import { SpatialHash } from "@/engine"
import {
  BATTERY_START_PCT,
  ENEMY_AGGRO_RANGE_MM,
  ENEMY_ATTACK_COOLDOWN_MS,
  ENEMY_ATTACK_RANGE_MM,
  ENEMY_HP_BY_LEVEL,
  ENEMY_LEASH_RANGE_MM,
  ENEMY_RADIATION_BY_LEVEL,
  LEVEL_UP_SIGNAL_MS,
  SERPENT_HP_BONUS,
  XP_SERPENT,
  XP_SERPENT_PURPLE,
  XP_SPIDER,
  XP_USE_MINERAL,
} from "@/playgrounds/rover-rescue/config"
import { buildEntityIndex, createEnemy, type EnemyEntity, type RoverEntity } from "@/playgrounds/rover-rescue/entities"
import {
  absorbEnemyRadiation,
  createRoverRescueState,
  tickRoverRescue,
  useMineralOnGround,
  type RoverRescueState,
} from "@/playgrounds/rover-rescue/state"
import {
  absorbNearestEnemy,
  attackDrainPct,
  tickCombat,
  xpForNeutralizing,
} from "@/playgrounds/rover-rescue/systems/combat"
import type { RiverHazard } from "@/playgrounds/rover-rescue/map-spec"

const FAR_HAZARD: RiverHazard = {
  outer: [
    { x: 20000, y: 20000 },
    { x: 20100, y: 20000 },
    { x: 20100, y: 20100 },
    { x: 20000, y: 20100 },
  ],
  holes: [],
}

function pose(xMm: number, yMm: number) {
  return { xMm, yMm, headingDeg: 0, driveVelocity: 50, turnVelocity: 50, driveTimeoutMs: null }
}

function spider(id: string, posMm: { x: number; y: number }, level = 1): EnemyEntity {
  const spawned = createEnemy({
    id,
    posMm,
    kind: "spider",
    serpentColor: null,
    artSeed: 1,
    wanderPhase: 0,
  })
  return {
    ...spawned,
    level,
    maxHp: ENEMY_HP_BY_LEVEL[level],
    hp: ENEMY_HP_BY_LEVEL[level],
    radiation: ENEMY_RADIATION_BY_LEVEL[level],
  }
}

function serpent(
  id: string,
  posMm: { x: number; y: number },
  color: "orange" | "blue" | "purple",
  level = 1,
): EnemyEntity {
  const spawned = createEnemy({
    id,
    posMm,
    kind: "serpent",
    serpentColor: color,
    artSeed: 1,
    wanderPhase: 0,
  })
  const maxHp = ENEMY_HP_BY_LEVEL[level] + SERPENT_HP_BONUS
  return {
    ...spawned,
    level,
    maxHp,
    hp: maxHp,
    radiation: ENEMY_RADIATION_BY_LEVEL[level],
  }
}

function combatInput(enemy: EnemyEntity, rover: { x: number; y: number }, extra: Partial<Parameters<typeof tickCombat>[0]> = {}) {
  const index = new SpatialHash<RoverEntity>(500)
  return {
    enemies: [enemy],
    rover,
    roverLevel: 1,
    batteryPercent: BATTERY_START_PCT,
    elapsedMs: 16,
    dtMs: 16,
    running: true,
    index,
    hazard: FAR_HAZARD,
    bridges: [],
    ...extra,
  }
}

describe("xpForNeutralizing", () => {
  it("awards the documented XP for each enemy type", () => {
    expect(xpForNeutralizing(spider("s", { x: 0, y: 0 }))).toBe(XP_SPIDER)
    expect(xpForNeutralizing(serpent("o", { x: 0, y: 0 }, "orange"))).toBe(XP_SERPENT)
    expect(xpForNeutralizing(serpent("b", { x: 0, y: 0 }, "blue"))).toBe(XP_SERPENT)
    expect(xpForNeutralizing(serpent("p", { x: 0, y: 0 }, "purple"))).toBe(XP_SERPENT_PURPLE)
  })
})

describe("tickCombat", () => {
  it("leaves idle enemies alone when the rover is outside aggro range", () => {
    const enemy = spider("far", { x: 0, y: ENEMY_AGGRO_RANGE_MM + 50 })
    const result = tickCombat(combatInput(enemy, { x: 0, y: 0 }))
    expect(result.underAttack).toBe(false)
    expect(result.enemies[0]?.state).toBe("idle")
    expect(result.batteryPercent).toBe(BATTERY_START_PCT)
  })

  it("pursues inside aggro range and attacks in melee, draining battery", () => {
    const chase = tickCombat(combatInput(spider("mid", { x: 0, y: ENEMY_ATTACK_RANGE_MM + 80 }), { x: 0, y: 0 }))
    expect(chase.enemies[0]?.state).toBe("pursuing")
    expect(chase.underAttack).toBe(false)

    const melee = tickCombat(combatInput(spider("close", { x: 0, y: ENEMY_ATTACK_RANGE_MM - 10 }), { x: 0, y: 0 }))
    expect(melee.enemies[0]?.state).toBe("attacking")
    expect(melee.underAttack).toBe(true)
    expect(melee.batteryPercent).toBe(BATTERY_START_PCT - attackDrainPct(1, 1))
  })

  it("drops aggro past the leash", () => {
    const chasing = { ...spider("leash", { x: 0, y: ENEMY_LEASH_RANGE_MM + 20 }), state: "pursuing" as const }
    const result = tickCombat(combatInput(chasing, { x: 0, y: 0 }))
    expect(result.enemies[0]?.state).toBe("idle")
    expect(result.underAttack).toBe(false)
  })

  it("does not hit twice inside the attack cooldown", () => {
    const first = tickCombat(combatInput(spider("hit", { x: 0, y: 80 }), { x: 0, y: 0 }, { elapsedMs: 16 }))
    const second = tickCombat({
      ...combatInput(first.enemies[0]!, { x: 0, y: 0 }, { elapsedMs: 16 + ENEMY_ATTACK_COOLDOWN_MS - 1 }),
      batteryPercent: first.batteryPercent,
    })
    expect(second.batteryPercent).toBe(first.batteryPercent)
  })
})

describe("absorbNearestEnemy", () => {
  it("one-shots a same-level spider, charges the battery, and awards spider XP", () => {
    const enemy = spider("prey", { x: 0, y: 80 })
    const result = absorbNearestEnemy({
      enemies: [enemy],
      rover: { x: 0, y: 0 },
      roverLevel: 1,
      batteryPercent: 50,
    })
    expect(result.absorbed).toBe(true)
    expect(result.enemies[0]?.state).toBe("neutralized")
    expect(result.xpDelta).toBe(XP_SPIDER)
    expect(result.batteryPercent).toBeGreaterThan(50)
  })

  it("does nothing when no live enemy is in absorb range", () => {
    const result = absorbNearestEnemy({
      enemies: [spider("far", { x: 0, y: 800 })],
      rover: { x: 0, y: 0 },
      roverLevel: 1,
      batteryPercent: 50,
    })
    expect(result.absorbed).toBe(false)
    expect(result.xpDelta).toBe(0)
    expect(result.batteryPercent).toBe(50)
  })
})

describe("combat through the world tick", () => {
  it("a full-battery level 1 rover survives a same-level spider", () => {
    const enemy = spider("fair", { x: 0, y: 80 })
    let world: RoverRescueState = {
      ...createRoverRescueState(1),
      enemies: [enemy],
      minerals: [],
      obstacles: [],
      index: buildEntityIndex({ obstacles: [], minerals: [], enemies: [enemy] }),
    }
    const rover = pose(0, 0)
    const absorbed = absorbEnemyRadiation(world, { x: rover.xMm, y: rover.yMm })
    world = absorbed.state
    world = tickRoverRescue(world, 16, rover, { missionRunning: true })
    expect(absorbed.absorbed).toBe(true)
    expect(world.enemies[0]?.state).toBe("neutralized")
    expect(world.xp).toBe(XP_SPIDER)
    expect(world.batteryPercent).toBeGreaterThan(80)
    expect(world.missionOver).toBe(false)
  })

  it("a level 1 rover dies to a level 5 serpent before neutralizing it", () => {
    const enemy = serpent("boss", { x: 0, y: 80 }, "purple", 5)
    let world: RoverRescueState = {
      ...createRoverRescueState(1),
      enemies: [enemy],
      minerals: [],
      obstacles: [],
      batteryPercent: BATTERY_START_PCT,
      level: 1,
      xp: 0,
      index: buildEntityIndex({ obstacles: [], minerals: [], enemies: [enemy] }),
    }
    const rover = pose(0, 0)
    for (let i = 0; i < 12; i++) {
      world = tickRoverRescue(world, ENEMY_ATTACK_COOLDOWN_MS, rover, { missionRunning: true })
      if (world.batteryPercent <= 0 || world.missionOver) break
      const siphon = absorbEnemyRadiation(world, { x: rover.xMm, y: rover.yMm })
      world = siphon.state
    }
    expect(world.batteryPercent).toBe(0)
    expect(world.missionOver).toBe(true)
    expect(world.missionReason).toBe("battery")
    expect(world.enemies[0]?.state).not.toBe("neutralized")
  })

  it("holds the level-up pulse long enough for the hat to see it", () => {
    const world = createRoverRescueState(1)
    const mineral = world.minerals.find((item) => item.state === "field")
    expect(mineral).toBeDefined()
    const primed = { ...world, xp: 9, level: 1, elapsedMs: 1000 }
    const used = useMineralOnGround(primed, { x: mineral!.xMm, y: mineral!.yMm })
    expect(used.used).toBe(true)
    expect(used.state.level).toBe(2)
    expect(used.state.xp).toBe(9 + XP_USE_MINERAL)
    expect(used.state.levelUpUntilMs).toBe(1000 + LEVEL_UP_SIGNAL_MS)
  })
})
