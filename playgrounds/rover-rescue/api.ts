import { mmToDistance, normalizeDegrees } from "@/engine"
import type { PlaygroundApiDeps } from "../types"
import { AI_MISSING_SIGHT_MM } from "./config"
import { riverHazardFromState, type RoverRescueState } from "./state"
import { clampRoverMm } from "./systems/physics"
import {
  baseBearing,
  computeSensing,
  nearestDetected,
  nearestSeen,
  type SightKind,
  type SensorSnapshot,
} from "./systems/sensing"

export { clampRoverMm }

export function createRoverRescueApi(deps: PlaygroundApiDeps<RoverRescueState>) {
  const snapshot = () => cachedSensing(deps)

  return {
    energize() {},
    bumperPressed() {
      return false
    },
    distanceFoundObject() {
      return snapshot().foundObject
    },
    getDistance(_sensor: string, unit: string) {
      return mmToDistance(snapshot().distanceMm, unit)
    },
    eyeIsNear() {
      return false
    },
    eyeDetectsColor() {
      return false
    },
    eyeBrightness() {
      return 0
    },
    getPosition(axis: string, unit: string) {
      const mm = axis.toLowerCase() === "x" ? deps.robot.current.xMm : deps.robot.current.yMm
      return mmToDistance(Math.round(mm), unit)
    },
    getPositionAngle() {
      return normalizeDegrees(deps.robot.current.headingDeg)
    },
    driveIsDone() {
      return !deps.world.current.driveMoving || deps.world.current.blocked
    },
    sees(kind: string) {
      return nearestSeen(snapshot(), parseKind(kind)) !== null
    },
    detects(kind: string) {
      const parsed = parseKind(kind)
      if (parsed !== "mineral" && parsed !== "enemy") return false
      return nearestDetected(snapshot(), parsed) !== null
    },
    roverAngle(kind: string) {
      const parsed = parseKind(kind)
      if (parsed === "base") return baseBearing(originOf(deps), deps.robot.current.headingDeg).relativeAngleDeg
      return nearestSeen(snapshot(), parsed)?.relativeAngleDeg ?? 0
    },
    roverDistanceTo(kind: string, unit: string) {
      const parsed = parseKind(kind)
      if (parsed === "base") {
        return mmToDistance(baseBearing(originOf(deps), deps.robot.current.headingDeg).distanceMm, unit)
      }
      const seen = nearestSeen(snapshot(), parsed)
      if (seen) return mmToDistance(seen.distanceMm, unit)
      if (parsed === "obstacle" || parsed === "hazard") return mmToDistance(AI_MISSING_SIGHT_MM, unit)
      return mmToDistance(0, unit)
    },
    roverLocation(kind: string, axis: string, unit: string) {
      const parsed = parseKind(kind)
      const hit =
        parsed === "base" ? baseBearing(originOf(deps), deps.robot.current.headingDeg) : nearestSeen(snapshot(), parsed)
      const mm = hit ? (axis.toLowerCase() === "y" ? hit.posMm.y : hit.posMm.x) : 0
      return mmToDistance(Math.round(mm), unit)
    },
  }
}

function cachedSensing(deps: PlaygroundApiDeps<RoverRescueState>): SensorSnapshot {
  const world = deps.world.current
  const robot = deps.robot.current
  const cached = world.sensing
  if (
    cached &&
    cached.origin.x === robot.xMm &&
    cached.origin.y === robot.yMm &&
    cached.headingDeg === robot.headingDeg
  ) {
    return cached
  }
  const next = computeSensing(robot, world.index, riverHazardFromState(world), world.bridges)
  world.sensing = next
  return next
}

function originOf(deps: PlaygroundApiDeps<RoverRescueState>) {
  return { x: deps.robot.current.xMm, y: deps.robot.current.yMm }
}

export function parseKind(raw: string): SightKind {
  const key = String(raw).trim().toLowerCase()
  if (key === "minerals" || key === "mineral") return "mineral"
  if (key === "enemy" || key === "enemies") return "enemy"
  if (key === "obstacle" || key === "obstacles") return "obstacle"
  if (key === "hazard" || key === "hazards") return "hazard"
  return "base"
}
