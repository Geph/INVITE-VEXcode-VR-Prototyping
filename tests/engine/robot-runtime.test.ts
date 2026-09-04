/**
 * Characterisation of lib/robot-runtime.ts as it behaves today.
 * These tests lock Ocean Cleanup numbers so Phases 1–3 cannot drift.
 * Oddities are asserted on purpose; see docs/ARCHITECTURE.md.
 */
import { describe, expect, it } from "vitest"
import {
  CORAL_REEF_FIELD_MM,
  CORAL_REEF_START_MM,
  CORAL_REEF_TRASH_COUNT,
  DISTANCE_SENSOR_MAX_MM,
  DRIVE_MS_PER_MM_AT_50,
  EYE_FORWARD_OFFSET_PX,
  EYE_NEAR_MM,
  MM_PER_PIXEL,
  PIXELS_PER_INCH,
  PIXELS_PER_MM,
  TRASH_HIT_RADIUS_PX,
  TURN_MS_PER_DEGREE_AT_50,
  attachNumberShadow,
  clampRobotPosition,
  createInitialTrashItems,
  createNumberShadowDom,
  distanceToPixels,
  drawFieldRulerOverlay,
  driveDurationMs,
  fieldMmToPixel,
  fieldRulerTicksMm,
  flyoutBlockWithNumberShadows,
  forEachProgramBlock,
  generateWhenStartedJavaScript,
  getDefaultRobotPixelPosition,
  getPlaygroundCanvasSize,
  isTrashNearEye,
  maxDriveDistanceMm,
  nearestTrashDistanceMm,
  nearestTrashInFrontMm,
  normalizeDegrees,
  pixelToFieldMm,
  pixelsToDistance,
  pointHitsCoral,
  raycastToBorder,
  registerBlockGenerator,
  remapPixelAcrossCanvas,
  seededRandom,
  shortestRotationDelta,
  turnDurationMs,
  type CoralPiece,
  type TrashSim,
} from "@/lib/robot-runtime"

const CANVAS = { w: 400, h: 400 }

function trash(
  x: number,
  y: number,
  extras: Partial<TrashSim> = {},
): TrashSim {
  return { x, y, isCollected: false, type: "bottle", ...extras }
}

describe("constants", () => {
  it("keeps the Coral Reef field and sensor numbers", () => {
    expect(CORAL_REEF_FIELD_MM).toBe(2000)
    expect(CORAL_REEF_START_MM).toEqual({ x: 0, y: -800 })
    expect(CORAL_REEF_TRASH_COUNT).toBe(12)
    expect(DISTANCE_SENSOR_MAX_MM).toBe(3000)
    expect(EYE_NEAR_MM).toBe(250)
    expect(TRASH_HIT_RADIUS_PX).toBe(20)
    expect(EYE_FORWARD_OFFSET_PX).toBe(22)
    expect(MM_PER_PIXEL).toBe(7.5)
    expect(PIXELS_PER_MM).toBe(1 / 7.5)
    expect(PIXELS_PER_INCH).toBe(25.4 / 7.5)
    expect(DRIVE_MS_PER_MM_AT_50).toBe(10)
    expect(TURN_MS_PER_DEGREE_AT_50).toBe(22)
  })
})

describe("clampRobotPosition", () => {
  it("leaves an interior point alone", () => {
    expect(clampRobotPosition(200, 200, 400, 400)).toEqual({ x: 200, y: 200 })
  })

  it("clamps to the default 35 px margin", () => {
    expect(clampRobotPosition(0, 0, 400, 400)).toEqual({ x: 35, y: 35 })
    expect(clampRobotPosition(400, 400, 400, 400)).toEqual({ x: 365, y: 365 })
  })

  it("honours an explicit margin, including 0", () => {
    expect(clampRobotPosition(-10, 999, 400, 400, 10)).toEqual({ x: 10, y: 390 })
    expect(clampRobotPosition(-10, 999, 400, 400, 0)).toEqual({ x: 0, y: 400 })
  })
})

describe("distanceToPixels / pixelsToDistance", () => {
  it("round-trips millimetres", () => {
    for (const mm of [0, 7.5, 100, 800, 2000]) {
      expect(pixelsToDistance(distanceToPixels(mm, "mm"), "mm")).toBeCloseTo(mm, 10)
      expect(distanceToPixels(pixelsToDistance(mm, "mm"), "mm")).toBeCloseTo(mm, 10)
    }
  })

  it("round-trips inches", () => {
    for (const inches of [0, 1, 10, 39.37]) {
      expect(pixelsToDistance(distanceToPixels(inches, "inches"), "inches")).toBeCloseTo(inches, 10)
      expect(pixelsToDistance(distanceToPixels(inches, "INCHES"), "INCHES")).toBeCloseTo(inches, 10)
    }
  })

  it("treats only inches/INCHES as imperial; everything else is millimetres", () => {
    expect(distanceToPixels(100, "mm")).toBeCloseTo(100 / 7.5, 10)
    expect(distanceToPixels(100, "MM")).toBeCloseTo(100 / 7.5, 10)
    expect(distanceToPixels(1, "inches")).toBeCloseTo(PIXELS_PER_INCH, 10)
    // Oddity: "INCH" / "in" are not recognised.
    expect(distanceToPixels(100, "INCH")).toBeCloseTo(100 / 7.5, 10)
    expect(distanceToPixels(100, "in")).toBeCloseTo(100 / 7.5, 10)
    expect(pixelsToDistance(10, "nope")).toBeCloseTo(75, 10)
  })
})

describe("normalizeDegrees", () => {
  it("wraps into [0, 360)", () => {
    expect(normalizeDegrees(0)).toBe(0)
    expect(normalizeDegrees(360)).toBe(0)
    expect(normalizeDegrees(361)).toBe(1)
    expect(normalizeDegrees(-1)).toBe(359)
    // Oddity: -360 % 360 is -0, and -0 < 0 is false, so the value is left as -0.
    expect(Object.is(normalizeDegrees(-360), -0)).toBe(true)
    expect(normalizeDegrees(720)).toBe(0)
    expect(normalizeDegrees(-721)).toBe(359)
  })
})

describe("shortestRotationDelta", () => {
  it("returns the signed shortest turn", () => {
    expect(shortestRotationDelta(0, 90)).toBe(90)
    expect(shortestRotationDelta(0, 270)).toBe(-90)
    expect(shortestRotationDelta(350, 10)).toBe(20)
    expect(shortestRotationDelta(10, 350)).toBe(-20)
    expect(shortestRotationDelta(0, 180)).toBe(180)
    expect(shortestRotationDelta(180, 0)).toBe(-180)
    expect(shortestRotationDelta(0, 0)).toBe(0)
  })

  it("normalises inputs before subtracting", () => {
    expect(shortestRotationDelta(-10, 370)).toBe(20)
  })
})

describe("driveDurationMs / turnDurationMs", () => {
  it("uses the 50% timing constants at 50% velocity", () => {
    const px = distanceToPixels(100, "mm")
    expect(driveDurationMs(px, 50)).toBe(100 * DRIVE_MS_PER_MM_AT_50)
    expect(turnDurationMs(90, 50)).toBe(90 * TURN_MS_PER_DEGREE_AT_50)
  })

  it("scales inversely with velocity and floors at 80 ms", () => {
    const px = distanceToPixels(100, "mm")
    expect(driveDurationMs(px, 100)).toBe(500)
    expect(driveDurationMs(px, 25)).toBe(2000)
    expect(driveDurationMs(0, 50)).toBe(80)
    expect(turnDurationMs(0, 50)).toBe(80)
    expect(turnDurationMs(-90, 50)).toBe(90 * TURN_MS_PER_DEGREE_AT_50)
  })

  it("clamps velocity into 5–100 (0% becomes 5%)", () => {
    const px = distanceToPixels(100, "mm")
    expect(driveDurationMs(px, 0)).toBe(driveDurationMs(px, 5))
    expect(driveDurationMs(px, 200)).toBe(driveDurationMs(px, 100))
    expect(turnDurationMs(90, 0)).toBe(turnDurationMs(90, 5))
    expect(turnDurationMs(90, 999)).toBe(turnDurationMs(90, 100))
  })
})

describe("fieldMmToPixel / pixelToFieldMm", () => {
  it("puts the field origin at the canvas centre", () => {
    expect(fieldMmToPixel(0, 0, CANVAS.w, CANVAS.h)).toEqual({ x: 200, y: 200 })
    expect(pixelToFieldMm(200, 200, CANVAS.w, CANVAS.h)).toEqual({ x: 0, y: 0 })
  })

  it("round-trips integer millimetres that land on exact pixels", () => {
    for (const mm of [-800, -750, 0, 750, 1000]) {
      const px = fieldMmToPixel(mm, mm, CANVAS.w, CANVAS.h)
      expect(pixelToFieldMm(px.x, px.y, CANVAS.w, CANVAS.h)).toEqual({ x: mm, y: mm })
    }
  })

  it("maps positive field-Y down the canvas (not official VEX +Y-north)", () => {
    const up = fieldMmToPixel(0, -800, CANVAS.w, CANVAS.h)
    const down = fieldMmToPixel(0, 800, CANVAS.w, CANVAS.h)
    expect(up.y).toBeLessThan(200)
    expect(down.y).toBeGreaterThan(200)
  })

  it("rounds the inverse to integer millimetres", () => {
    expect(pixelToFieldMm(201, 200, CANVAS.w, CANVAS.h)).toEqual({
      x: Math.round(pixelsToDistance(1, "mm")),
      y: 0,
    })
  })
})

describe("canvas size, spawn, remap, ruler", () => {
  it("sizes the playground at 400 and 600", () => {
    expect(getPlaygroundCanvasSize(false)).toEqual({ w: 400, h: 400 })
    expect(getPlaygroundCanvasSize(true)).toEqual({ w: 600, h: 600 })
  })

  it("spawns the robot at the Coral Reef start, clamped", () => {
    const expected = clampRobotPosition(
      ...(() => {
        const p = fieldMmToPixel(CORAL_REEF_START_MM.x, CORAL_REEF_START_MM.y, 400, 400)
        return [p.x, p.y, 400, 400] as const
      })(),
    )
    expect(getDefaultRobotPixelPosition(false)).toEqual(expected)
    const max = getDefaultRobotPixelPosition(true)
    const raw = fieldMmToPixel(0, -800, 600, 600)
    expect(max).toEqual(clampRobotPosition(raw.x, raw.y, 600, 600))
  })

  it("remaps a canvas point by field millimetres", () => {
    const from = fieldMmToPixel(0, -800, 400, 400)
    const to = remapPixelAcrossCanvas(from.x, from.y, 400, 400, 600, 600)
    const mm = pixelToFieldMm(from.x, from.y, 400, 400)
    expect(to).toEqual(fieldMmToPixel(mm.x, mm.y, 600, 600))
  })

  it("exposes the five major ruler ticks", () => {
    expect(fieldRulerTicksMm()).toEqual([-1000, -500, 0, 500, 1000])
  })
})

describe("maxDriveDistanceMm", () => {
  it("walks forward to the 35 px margin and reports millimetres", () => {
    const mm = maxDriveDistanceMm(200, 200, 0, "forward", 400, 400)
    // Heading 0 is canvas-up (−Y). Travel 200 − 35 = 165 px.
    expect(mm).toBeCloseTo(pixelsToDistance(166, "mm"), 5) // last in-bounds step is 164; first out is 166
  })

  it("reverses along the heading when direction is not 'forward'", () => {
    // From centre on a square, forward and reverse are the same length. Offset
    // so the two directions hit different walls.
    const fwd = maxDriveDistanceMm(200, 80, 0, "forward", 400, 400)
    const back = maxDriveDistanceMm(200, 80, 0, "reverse", 400, 400)
    expect(fwd).toBeLessThan(back)
    expect(maxDriveDistanceMm(200, 80, 0, "backward", 400, 400)).toBe(back)
  })

  it("honours an explicit margin", () => {
    const tight = maxDriveDistanceMm(200, 200, 90, "forward", 400, 400, 0)
    expect(tight).toBeGreaterThan(maxDriveDistanceMm(200, 200, 90, "forward", 400, 400, 35))
  })

  it("falls back to the canvas hypotenuse when no edge is reachable", () => {
    const mm = maxDriveDistanceMm(200, 200, 0, "forward", 400, 400, -10_000)
    expect(mm).toBeCloseTo(pixelsToDistance(Math.hypot(400, 400), "mm"), 5)
  })
})

describe("pointHitsCoral", () => {
  const coral: CoralPiece[] = [{ x: 100, y: 100, radius: 10, color: "#f00" }]

  it("hits at or inside radius + margin, misses outside", () => {
    expect(pointHitsCoral(100, 100, coral)).toBe(true)
    expect(pointHitsCoral(109.9, 100, coral)).toBe(true)
    expect(pointHitsCoral(110, 100, coral)).toBe(false)
    expect(pointHitsCoral(110, 100, coral, 1)).toBe(true)
    expect(pointHitsCoral(0, 0, coral)).toBe(false)
    expect(pointHitsCoral(0, 0, [])).toBe(false)
  })
})

describe("raycastToBorder", () => {
  it("reports the 20 px canvas inset, not the 35 px clamp margin", () => {
    const mm = raycastToBorder(200, 200, 0, 400, 400, [])
    // Heading 0 → −Y. First out-of-bounds sample is y < 20, at dist 182 (200 − 18 is still ≥ 20).
    expect(mm).toBeCloseTo(pixelsToDistance(182, "mm"), 5)
  })

  it("stops on coral with an 8 px extra margin", () => {
    const coral: CoralPiece[] = [{ x: 200, y: 100, radius: 10, color: "#0f0" }]
    const mm = raycastToBorder(200, 200, 0, 400, 400, coral)
    expect(mm).toBeLessThan(raycastToBorder(200, 200, 0, 400, 400, []))
    expect(mm).toBeGreaterThan(0)
  })

  it("defaults the cap to 2000 mm, not DISTANCE_SENSOR_MAX_MM", () => {
    // Start far from every 20 px inset so the loop hits maxMm, not a wall.
    const open = raycastToBorder(5000, 5000, 0, 10_000, 10_000, [])
    expect(open).toBeCloseTo(2000, 0)
    const longer = raycastToBorder(5000, 5000, 0, 10_000, 10_000, [], 3000)
    expect(longer).toBeCloseTo(3000, 0)
  })
})

describe("nearestTrashDistanceMm / nearestTrashInFrontMm / isTrashNearEye", () => {
  it("returns null when nothing is left on the field", () => {
    expect(nearestTrashDistanceMm(0, 0, [])).toBeNull()
    expect(nearestTrashDistanceMm(0, 0, [trash(10, 10, { isCollected: true })])).toBeNull()
    expect(nearestTrashInFrontMm(0, 0, 0, [])).toBeNull()
  })

  it("reports edge-to-edge millimetres and clamps overlap to 0", () => {
    expect(nearestTrashDistanceMm(0, 0, [trash(20, 0)])).toBe(0)
    expect(nearestTrashDistanceMm(0, 0, [trash(10, 0)])).toBe(0)
    expect(nearestTrashDistanceMm(0, 0, [trash(95, 0)])).toBeCloseTo(pixelsToDistance(75, "mm"), 10)
  })

  it("keeps the nearest uncollected sprite", () => {
    const items = [trash(200, 0), trash(50, 0), trash(40, 0, { isCollected: true })]
    expect(nearestTrashDistanceMm(0, 0, items)).toBeCloseTo(pixelsToDistance(30, "mm"), 10)
  })

  it("treats 'in front' as a half-plane from the eye, not a cone", () => {
    const ahead = [trash(0, -100)]
    const behind = [trash(0, 100)]
    // Eye sits 22 px forward of centre. y = -40 is ahead of the eye; 80 px
    // sideways is well outside a 40° cone but still in the half-plane.
    const wide = [trash(80, -40)]
    expect(nearestTrashInFrontMm(0, 0, 0, ahead)).not.toBeNull()
    expect(nearestTrashInFrontMm(0, 0, 0, behind)).toBeNull()
    expect(nearestTrashInFrontMm(0, 0, 0, wide)).not.toBeNull()
  })

  it("drops readings beyond maxMm (default DISTANCE_SENSOR_MAX_MM)", () => {
    const far = [trash(0, -distanceToPixels(4000, "mm"))]
    expect(nearestTrashInFrontMm(0, 0, 0, far)).toBeNull()
    expect(nearestTrashInFrontMm(0, 0, 0, far, 10_000)).not.toBeNull()
  })

  it("uses centre distance for the down eye and the half-plane for the front eye", () => {
    const behind = [trash(0, 40)]
    expect(isTrashNearEye(0, 0, 0, behind, "down", 1000)).toBe(true)
    expect(isTrashNearEye(0, 0, 0, behind, "front", 1000)).toBe(false)
    const ahead = [trash(0, -40)]
    expect(isTrashNearEye(0, 0, 0, ahead, "front")).toBe(true)
    expect(isTrashNearEye(0, 0, 0, [], "down")).toBe(false)
  })
})

describe("seededRandom / createInitialTrashItems", () => {
  it("is deterministic and in [0, 1)", () => {
    expect(seededRandom(1)).toBe(seededRandom(1))
    expect(seededRandom(1)).not.toBe(seededRandom(2))
    expect(seededRandom(3)).toBeGreaterThanOrEqual(0)
    expect(seededRandom(3)).toBeLessThan(1)
  })

  it("places up to 12 items away from coral and the spawn", () => {
    const coral: CoralPiece[] = [{ x: 200, y: 200, radius: 40, color: "#000" }]
    const items = createInitialTrashItems(400, 400, coral)
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(CORAL_REEF_TRASH_COUNT)
    const spawn = fieldMmToPixel(CORAL_REEF_START_MM.x, CORAL_REEF_START_MM.y, 400, 400)
    for (const item of items) {
      expect(item.isCollected).toBe(false)
      expect(["bottle", "can", "wrapper", "bag"]).toContain(item.type)
      expect(pointHitsCoral(item.x, item.y, coral, 28)).toBe(false)
      expect(Math.hypot(item.x - spawn.x, item.y - spawn.y)).toBeGreaterThanOrEqual(70)
    }
    expect(createInitialTrashItems(400, 400, coral)).toEqual(items)
  })

  it("can return fewer than count when every attempt is rejected", () => {
    const wall: CoralPiece[] = [{ x: 200, y: 200, radius: 400, color: "#000" }]
    expect(createInitialTrashItems(400, 400, wall, 4).length).toBeLessThan(4)
  })
})

describe("forEachProgramBlock", () => {
  type FakeBlock = {
    type: string
    getFieldValue: (name: string) => string
    getInputTargetBlock: (name: string) => FakeBlock | null
    getNextBlock: () => FakeBlock | null
  }

  function block(type: string, extras: Partial<FakeBlock> = {}): FakeBlock {
    return {
      type,
      getFieldValue: () => "",
      getInputTargetBlock: () => null,
      getNextBlock: () => null,
      ...extras,
    }
  }

  it("skips the when_started hat and walks the next stack", () => {
    const drive = block("drive_distance")
    const turn = block("turn_degrees")
    drive.getNextBlock = () => turn
    const hat = block("when_started", { getNextBlock: () => drive })
    const seen: string[] = []
    forEachProgramBlock(hat, (b) => seen.push(b.type))
    expect(seen).toEqual(["drive_distance", "turn_degrees"])
  })

  it("visits nothing for a bare hat", () => {
    const seen: string[] = []
    forEachProgramBlock(block("when_started"), (b) => seen.push(b.type))
    expect(seen).toEqual([])
  })

  it("walks DO / DO1 / DO2 / ELSE mouths and ignores cycles", () => {
    const inner = block("drive_simple")
    const loop = block("forever", { getInputTargetBlock: (name) => (name === "DO" ? inner : null) })
    loop.getNextBlock = () => loop
    const seen: string[] = []
    forEachProgramBlock(loop, (b) => seen.push(b.type))
    expect(seen).toEqual(["forever", "drive_simple"])
  })
})

describe("generateWhenStartedJavaScript", () => {
  const js = {
    blockToCode: (block: { type: string; body?: string }) => block.body ?? "",
  }

  it("returns empty for a missing workspace or empty hats", () => {
    expect(generateWhenStartedJavaScript(null, js)).toBe("")
    expect(
      generateWhenStartedJavaScript(
        { getAllBlocks: () => [{ type: "when_started", body: "   " }] },
        js,
      ),
    ).toBe("")
  })

  it("emits a single body with a trailing newline", () => {
    expect(
      generateWhenStartedJavaScript(
        { getAllBlocks: () => [{ type: "when_started", body: "await robot.drive();\n" }] },
        js,
      ),
    ).toBe("await robot.drive();\n")
  })

  it("drops disabled hats and wraps two live bodies in Promise.all", () => {
    const code = generateWhenStartedJavaScript(
      {
        getAllBlocks: () => [
          { type: "when_started", isEnabled: () => false, body: "await a();\n" },
          { type: "when_started", body: "await b();\n" },
          { type: "when_started", body: "await c();\n" },
          { type: "drive_distance", body: "ignored" },
        ],
      },
      js,
    )
    expect(code).toContain("await Promise.all([")
    expect(code).toContain("// thread 1")
    expect(code).toContain("// thread 2")
    expect(code).toContain("await b();")
    expect(code).toContain("await c();")
    expect(code).not.toContain("await a();")
  })

  it("accepts a [code, order] tuple from the generator", () => {
    expect(
      generateWhenStartedJavaScript(
        { getAllBlocks: () => [{ type: "when_started" }] },
        { blockToCode: () => ["await robot.drive();", 0] },
      ),
    ).toBe("await robot.drive();\n")
  })
})

describe("shadow helpers / registerBlockGenerator", () => {
  it("builds a math_number shadow and attaches it when the input exists", () => {
    const created: Array<{ name: string; attrs: Record<string, string>; text?: string; kids: unknown[] }> = []
    const Blockly = {
      utils: {
        xml: {
          createElement(name: string) {
            const node = {
              name,
              attrs: {} as Record<string, string>,
              kids: [] as unknown[],
              text: undefined as string | undefined,
              setAttribute(k: string, v: string) {
                this.attrs[k] = v
              },
              appendChild(child: unknown) {
                this.kids.push(child)
              },
              set textContent(v: string) {
                this.text = v
              },
              get textContent() {
                return this.text ?? ""
              },
            }
            created.push(node)
            return node as unknown as Element
          },
        },
      },
    }

    const shadow = createNumberShadowDom(Blockly, 42)
    expect(created[0]?.attrs.type).toBe("math_number")
    expect(created[1]?.attrs.name).toBe("NUM")
    expect(created[1]?.text).toBe("42")
    expect(shadow).toBe(created[0])

    let attached: Element | undefined
    attachNumberShadow(
      {
        getInput: (name) =>
          name === "TIMES"
            ? {
                setShadowDom: (dom: Element) => {
                  attached = dom
                },
              }
            : null,
      },
      Blockly,
      "TIMES",
      3,
    )
    expect(attached).toBeDefined()
    attachNumberShadow({ getInput: () => null }, Blockly, "MISSING", 1)
  })

  it("builds flyout JSON with default 0 unless overridden", () => {
    expect(flyoutBlockWithNumberShadows("repeat", ["TIMES"], { TIMES: 10 })).toEqual({
      kind: "block",
      type: "repeat",
      inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } } },
    })
    expect(flyoutBlockWithNumberShadows("wait", ["SECS"]).inputs.SECS.shadow.fields.NUM).toBe(0)
  })

  it("registers a JS generator on the Blockly object", () => {
    const Blockly = { JavaScript: { forBlock: {} as Record<string, unknown> } }
    const fn = () => "ok"
    registerBlockGenerator(Blockly, "drive_simple", fn)
    expect(Blockly.JavaScript.forBlock.drive_simple).toBe(fn)
  })
})

describe("drawFieldRulerOverlay", () => {
  it("paints the yellow strips and at least one tick", () => {
    const calls: string[] = []
    const ctx = {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      fillRect: () => calls.push("fillRect"),
      beginPath: () => calls.push("beginPath"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      stroke: () => calls.push("stroke"),
      fillText: () => calls.push("fillText"),
      lineCap: "",
      font: "",
      textBaseline: "",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      textAlign: "",
    }
    drawFieldRulerOverlay(ctx as unknown as CanvasRenderingContext2D, 400, 400)
    expect(calls[0]).toBe("save")
    expect(calls.at(-1)).toBe("restore")
    expect(calls.filter((c) => c === "fillRect").length).toBe(2)
    expect(calls).toContain("stroke")
    expect(calls).toContain("fillText")
  })
})
