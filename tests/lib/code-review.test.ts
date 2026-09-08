import { describe, expect, it } from "vitest"
import {
  analyzeBlocklyWorkspace,
  buildCodeReview,
  type ProgramAnalysis,
} from "@/lib/code-review"

type MockBlock = {
  type: string
  fields?: Record<string, string>
  inputs?: Record<string, MockBlock | null>
  next?: MockBlock | null
  enabled?: boolean
  isEnabled: () => boolean
  getFieldValue: (name: string) => string
  getInputTargetBlock: (name: string) => MockBlock | null
  getNextBlock: () => MockBlock | null
}

function block(
  type: string,
  options: { fields?: Record<string, string>; inputs?: Record<string, MockBlock | null>; next?: MockBlock | null; enabled?: boolean } = {},
): MockBlock {
  const node: MockBlock = {
    type,
    fields: options.fields,
    inputs: options.inputs,
    next: options.next ?? null,
    enabled: options.enabled,
    isEnabled() {
      return options.enabled !== false
    },
    getFieldValue(name) {
      return options.fields?.[name] ?? ""
    },
    getInputTargetBlock(name) {
      return options.inputs?.[name] ?? null
    },
    getNextBlock() {
      return node.next ?? null
    },
  }
  return node
}

function workspace(...blocks: MockBlock[]) {
  return { getAllBlocks: () => blocks }
}

function hat(next?: MockBlock | null) {
  return block("when_started", { next: next ?? null })
}

const EMPTY_ANALYSIS: ProgramAnalysis = {
  blockCount: 0,
  hasWhenStarted: false,
  hasProgramBody: false,
  hasDrive: false,
  hasTurn: false,
  hasLoop: false,
  hasIfThen: false,
  usesDistanceSensor: false,
  usesEyeSensor: false,
  usesBumper: false,
  usesPosition: false,
  driveCount: 0,
  onlyForeverNoSensing: false,
  hasMisplacedControlBody: false,
}

describe("analyzeBlocklyWorkspace characterisation", () => {
  it("returns the empty analysis when there is no workspace or no when_started hat", () => {
    expect(analyzeBlocklyWorkspace(null)).toEqual(EMPTY_ANALYSIS)
    expect(analyzeBlocklyWorkspace(workspace(block("drive_distance")))).toEqual(EMPTY_ANALYSIS)
  })

  it("sets hasWhenStarted but not hasProgramBody for a bare hat", () => {
    expect(analyzeBlocklyWorkspace(workspace(hat()))).toEqual({
      ...EMPTY_ANALYSIS,
      hasWhenStarted: true,
    })
  })

  it("flags drive and counts drive blocks", () => {
    const program = hat(
      block("drive_simple", { next: block("drive_distance") }),
    )
    expect(analyzeBlocklyWorkspace(workspace(program))).toEqual({
      ...EMPTY_ANALYSIS,
      hasWhenStarted: true,
      hasProgramBody: true,
      hasDrive: true,
      driveCount: 2,
      blockCount: 2,
    })
  })

  it("flags turn types", () => {
    const program = hat(
      block("turn_simple", {
        next: block("turn_degrees", { next: block("turn_to_heading", { next: block("turn_to_rotation") }) }),
      }),
    )
    expect(analyzeBlocklyWorkspace(workspace(program))).toEqual({
      ...EMPTY_ANALYSIS,
      hasWhenStarted: true,
      hasProgramBody: true,
      hasTurn: true,
      blockCount: 4,
    })
  })

  it("flags loops including forever aliases and sets onlyForeverNoSensing", () => {
    const program = hat(block("forever_loop", { inputs: { DO: block("repeat_times") } }))
    expect(analyzeBlocklyWorkspace(workspace(program))).toEqual({
      ...EMPTY_ANALYSIS,
      hasWhenStarted: true,
      hasProgramBody: true,
      hasLoop: true,
      onlyForeverNoSensing: true,
      blockCount: 2,
    })
  })

  it("flags if/then and distance, eye, bumper, and position sensors", () => {
    // Value sockets are not walked — sensors must appear on the statement spine.
    const program = hat(
      block("if_then", {
        inputs: {
          DO: block("drive_distance", {
            next: block("distance_found_object", {
              next: block("eye_is_near", {
                next: block("bumper_pressed", { next: block("position_x") }),
              }),
            }),
          }),
        },
      }),
    )
    expect(analyzeBlocklyWorkspace(workspace(program))).toEqual({
      ...EMPTY_ANALYSIS,
      hasWhenStarted: true,
      hasProgramBody: true,
      hasDrive: true,
      hasIfThen: true,
      usesDistanceSensor: true,
      usesEyeSensor: true,
      usesBumper: true,
      usesPosition: true,
      driveCount: 1,
      blockCount: 6,
    })
  })

  it("flags a control body snapped below the block instead of in the mouth", () => {
    const program = hat(block("if_then", { next: block("drive_simple") }))
    expect(analyzeBlocklyWorkspace(workspace(program))).toEqual({
      ...EMPTY_ANALYSIS,
      hasWhenStarted: true,
      hasProgramBody: true,
      hasDrive: true,
      hasIfThen: true,
      driveCount: 1,
      hasMisplacedControlBody: true,
      blockCount: 2,
    })
  })
})

describe("buildCodeReview characterisation", () => {
  it("scores an empty workspace as not_ready", () => {
    const review = buildCodeReview(analyzeBlocklyWorkspace(null))
    expect(review.verdict).toBe("not_ready")
    expect(review.headline).toBe("Add blocks to get started")
    expect(review.score).toBe(5)
    expect(review.blockCount).toBe(0)
    expect(review.criteria.map((c) => [c.id, c.passed])).toEqual([
      ["entry", false],
      ["movement", false],
      ["loops", false],
      ["sensing", false],
      ["decisions", false],
      ["efficiency", true],
    ])
    expect(review.suggestions).toEqual([
      "Drag blocks from the left toolbox and snap them under when started.",
    ])
    expect(review.summary).toBe(
      "I read your workspace and did not find runnable blocks under when started yet. Snap a few blocks together, then ask me to review again.",
    )
  })

  it("scores a drive-only stack as needs_work", () => {
    const review = buildCodeReview(analyzeBlocklyWorkspace(workspace(hat(block("drive_distance")))))
    expect(review.verdict).toBe("needs_work")
    expect(review.headline).toBe("Your program needs more structure")
    expect(review.score).toBe(45)
    expect(review.criteria.map((c) => [c.id, c.passed])).toEqual([
      ["entry", true],
      ["movement", true],
      ["loops", false],
      ["sensing", false],
      ["decisions", false],
      ["efficiency", true],
    ])
    expect(review.suggestions).toEqual([
      "Try forever with drive + turn inside so the robot patrols the reef.",
    ])
  })

  it("scores a forever-without-sensors stack and the efficiency criterion", () => {
    const review = buildCodeReview(
      analyzeBlocklyWorkspace(
        workspace(hat(block("forever_loop", { inputs: { DO: block("drive_simple") } }))),
      ),
    )
    expect(review.verdict).toBe("needs_work")
    expect(review.score).toBe(60)
    expect(review.criteria.find((c) => c.id === "efficiency")?.passed).toBe(true)
    expect(review.suggestions).toContain(
      "Inside your loop, check the front distance sensor before driving forward.",
    )
  })

  it("scores a movement + loop + sensor + if program as excellent", () => {
    const review = buildCodeReview(
      analyzeBlocklyWorkspace(
        workspace(
          hat(
            block("forever_loop", {
              inputs: {
                DO: block("if_then", {
                  inputs: {
                    DO: block("drive_distance", { next: block("distance_found_object") }),
                  },
                }),
              },
            }),
          ),
        ),
      ),
    )
    expect(review.verdict).toBe("excellent")
    expect(review.headline).toBe("Strong program for Coral Reef Cleanup")
    expect(review.score).toBe(100)
    expect(review.criteria.every((c) => c.passed)).toBe(true)
    expect(review.suggestions).toEqual([])
    expect(review.summary).toContain("scored it 100/100")
  })

  it("suggests snapping into the mouth when a control body is misplaced", () => {
    const review = buildCodeReview(
      analyzeBlocklyWorkspace(workspace(hat(block("if_then", { next: block("drive_simple") })))),
    )
    expect(review.suggestions).toContain(
      "Snap blocks into the then / repeat mouth on if and loop blocks — blocks below the block always run, even when the condition is false.",
    )
  })
})
