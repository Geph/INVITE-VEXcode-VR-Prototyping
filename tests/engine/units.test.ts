import { describe, expect, it } from "vitest"
import {
  MM_PER_INCH,
  angleBetween,
  distanceToMm,
  inchesToMm,
  mmToDistance,
  mmToInches,
  mmToPixels,
  normalizeDegrees,
  pixelsToMm,
  shortestRotationDelta,
} from "@/engine/units"

describe("mm / inch / pixel conversion", () => {
  it("round-trips inches and millimetres", () => {
    expect(MM_PER_INCH).toBe(25.4)
    expect(inchesToMm(1)).toBeCloseTo(25.4)
    expect(mmToInches(25.4)).toBeCloseTo(1)
    expect(distanceToMm(2, "inches")).toBeCloseTo(50.8)
    expect(distanceToMm(2, "INCHES")).toBeCloseTo(50.8)
    expect(distanceToMm(100, "mm")).toBe(100)
    expect(mmToDistance(25.4, "inches")).toBeCloseTo(1)
    expect(mmToDistance(100, "MM")).toBe(100)
  })

  it("converts through an explicit pixelsPerMm", () => {
    expect(mmToPixels(100, 1 / 7.5)).toBeCloseTo(100 / 7.5)
    expect(pixelsToMm(mmToPixels(800, 0.2), 0.2)).toBeCloseTo(800)
    expect(pixelsToMm(10, 0)).toBe(0)
  })
})

describe("angles", () => {
  it("normalises into [0, 360), including signed zero", () => {
    expect(normalizeDegrees(0)).toBe(0)
    expect(normalizeDegrees(361)).toBe(1)
    expect(normalizeDegrees(-1)).toBe(359)
    expect(Object.is(normalizeDegrees(-360), -0)).toBe(true)
  })

  it("returns the shortest signed delta", () => {
    expect(shortestRotationDelta(0, 90)).toBe(90)
    expect(shortestRotationDelta(0, 270)).toBe(-90)
    expect(shortestRotationDelta(-10, 370)).toBe(20)
  })

  it("reports compass bearing from A to B (0 = north, clockwise)", () => {
    expect(angleBetween(0, 0, 0, 100)).toBeCloseTo(0)
    expect(angleBetween(0, 0, 100, 0)).toBeCloseTo(90)
    expect(angleBetween(0, 0, 0, -100)).toBeCloseTo(180)
    expect(angleBetween(0, 0, -100, 0)).toBeCloseTo(270)
    expect(angleBetween(5, 5, 5, 5)).toBe(0)
  })
})
