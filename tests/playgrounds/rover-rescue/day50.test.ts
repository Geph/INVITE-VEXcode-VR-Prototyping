import { describe, expect, it } from "vitest"
import { START_POSE, MISSION_DAYS } from "@/playgrounds/rover-rescue/config"
import { createEnemy } from "@/playgrounds/rover-rescue/entities"
import { msFromDays } from "@/playgrounds/rover-rescue/mission"
import { createRoverRescueState, tickRoverRescue } from "@/playgrounds/rover-rescue/state"
import {
  concludeDay50,
  continuePastDay50,
  countNeutralized,
  day50Snapshot,
} from "@/playgrounds/rover-rescue/systems/day50"

const atBase = {
  xMm: START_POSE.xMm,
  yMm: START_POSE.yMm,
  headingDeg: 0,
  driveVelocity: 50,
  turnVelocity: 50,
  driveTimeoutMs: null,
}

function neutralizedSpider() {
  const enemy = createEnemy({
    id: "dead",
    posMm: { x: 0, y: 0 },
    kind: "spider",
    serpentColor: null,
    artSeed: 1,
    wanderPhase: 0,
  })
  return { ...enemy, hp: 0, radiation: 0, state: "neutralized" as const }
}

describe("day-50 continue / conclude", () => {
  it("re-irradiates neutralized enemies and lets the program keep running", () => {
    const dead = neutralizedSpider()
    const world = {
      ...createRoverRescueState(1),
      enemies: [dead],
      day50Dialog: true,
      batteryPercent: 40,
      missionMs: msFromDays(MISSION_DAYS),
    }
    const next = continuePastDay50(world)
    expect(next.day50Dialog).toBe(false)
    expect(next.day50Continued).toBe(true)
    expect(next.missionOver).toBe(false)
    expect(next.enemies[0]?.state).toBe("idle")
    expect(next.enemies[0]?.hp).toBe(dead.maxHp)
    expect(next.enemies[0]?.radiation).toBeGreaterThan(0)
    expect(next.enemies[0]?.xMm).toBe(dead.homeMm.x)
    expect(next.enemies[0]?.yMm).toBe(dead.homeMm.y)

    const later = tickRoverRescue(next, 1000, atBase, { missionRunning: true })
    expect(later.day50Dialog).toBe(false)
    expect(later.missionOver).toBe(false)
    expect(later.missionMs).toBe(msFromDays(MISSION_DAYS) + 1000)
  })

  it("ends the mission when statistics or the certificate are chosen", () => {
    const world = {
      ...createRoverRescueState(1),
      day50Dialog: true,
      batteryPercent: 40,
      missionMs: msFromDays(MISSION_DAYS),
      xp: 12,
      level: 2,
    }
    const snap = day50Snapshot(world)
    expect(snap.days).toBe(MISSION_DAYS)
    expect(snap.xp).toBe(12)
    expect(snap.level).toBe(2)

    const ended = concludeDay50(world)
    expect(ended.missionOver).toBe(true)
    expect(ended.missionReason).toBe("days")
    expect(ended.day50Dialog).toBe(false)
  })

  it("counts neutralized enemies by type for the statistics panel", () => {
    const spider = neutralizedSpider()
    const purple = {
      ...createEnemy({
        id: "p",
        posMm: { x: 10, y: 10 },
        kind: "serpent",
        serpentColor: "purple",
        artSeed: 1,
        wanderPhase: 0,
      }),
      state: "neutralized" as const,
    }
    expect(countNeutralized([spider, purple])).toEqual({ spider: 1, orange: 0, blue: 0, purple: 1 })
  })
})
