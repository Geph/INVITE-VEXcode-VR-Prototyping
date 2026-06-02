import { forEachProgramBlock } from "@/lib/robot-runtime"

export type ReviewVerdict = "excellent" | "good" | "needs_work" | "not_ready"

export interface ReviewCriterion {
  id: string
  label: string
  passed: boolean
  detail: string
}

export interface CodeReviewResult {
  verdict: ReviewVerdict
  headline: string
  summary: string
  score: number
  blockCount: number
  criteria: ReviewCriterion[]
  suggestions: string[]
}

export interface ProgramAnalysis {
  blockCount: number
  hasWhenStarted: boolean
  hasProgramBody: boolean
  hasDrive: boolean
  hasTurn: boolean
  hasLoop: boolean
  hasIfThen: boolean
  usesDistanceSensor: boolean
  usesEyeSensor: boolean
  usesBumper: boolean
  usesPosition: boolean
  driveCount: number
  onlyForeverNoSensing: boolean
  /** Blocks snapped below if/loop instead of inside the mouth (then / DO). */
  hasMisplacedControlBody: boolean
}

type BlocklyBlock = {
  type: string
  getFieldValue: (name: string) => string
  getInputTargetBlock: (name: string) => unknown
  getNextBlock: () => unknown
}

type BlocklyWorkspace = {
  getAllBlocks: (ordered: boolean) => BlocklyBlock[]
}

const DRIVE_TYPES = new Set(["drive_simple", "drive_distance"])
const TURN_TYPES = new Set(["turn_simple", "turn_degrees", "turn_to_heading", "turn_to_rotation"])
const LOOP_TYPES = new Set(["forever", "forever_loop", "repeat", "repeat_times", "while_loop", "repeat_until"])
const IF_TYPES = new Set(["if_then", "if_then_else", "if_elseif_else"])
const CONTROL_DO_INPUTS: Record<string, string> = {
  if_then: "DO",
  if_then_else: "DO",
  if_elseif_else: "DO1",
  repeat_times: "DO",
  forever_loop: "DO",
  repeat_until: "DO",
  while_loop: "DO",
  forever: "DO",
  repeat: "DO",
}
const DISTANCE_TYPES = new Set(["distance_found_object", "distance_in_units", "when_distance"])
const EYE_TYPES = new Set(["eye_is_near", "eye_detects_color", "eye_brightness"])
const BUMPER_TYPES = new Set(["bumper_pressed", "when_bumper"])
const POSITION_TYPES = new Set(["position_x", "position_y", "position_angle", "get_position"])

export function analyzeBlocklyWorkspace(workspace: BlocklyWorkspace | null): ProgramAnalysis {
  const empty: ProgramAnalysis = {
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

  if (!workspace) return empty

  const whenStarted = workspace.getAllBlocks(false).find((b) => b.type === "when_started")
  if (!whenStarted) return empty

  const analysis: ProgramAnalysis = {
    ...empty,
    hasWhenStarted: true,
  }

  forEachProgramBlock(whenStarted, (block) => {
    analysis.blockCount++
    analysis.hasProgramBody = true

    if (DRIVE_TYPES.has(block.type)) {
      analysis.hasDrive = true
      analysis.driveCount++
    }
    if (TURN_TYPES.has(block.type)) analysis.hasTurn = true
    if (LOOP_TYPES.has(block.type)) analysis.hasLoop = true
    if (IF_TYPES.has(block.type)) analysis.hasIfThen = true
    if (DISTANCE_TYPES.has(block.type)) analysis.usesDistanceSensor = true
    if (EYE_TYPES.has(block.type)) analysis.usesEyeSensor = true
    if (BUMPER_TYPES.has(block.type)) analysis.usesBumper = true
    if (POSITION_TYPES.has(block.type)) analysis.usesPosition = true

    const primaryDo = CONTROL_DO_INPUTS[block.type]
    if (
      primaryDo &&
      !block.getInputTargetBlock(primaryDo) &&
      block.getNextBlock()
    ) {
      analysis.hasMisplacedControlBody = true
    }
  })

  analysis.onlyForeverNoSensing =
    analysis.hasLoop &&
    !analysis.usesDistanceSensor &&
    !analysis.usesEyeSensor &&
    !analysis.usesBumper &&
    !analysis.hasIfThen

  return analysis
}

function verdictFromScore(score: number): ReviewVerdict {
  if (score >= 85) return "excellent"
  if (score >= 65) return "good"
  if (score >= 35) return "needs_work"
  return "not_ready"
}

const VERDICT_HEADLINE: Record<ReviewVerdict, string> = {
  excellent: "Strong program for Coral Reef Cleanup",
  good: "Solid start — a few improvements will help",
  needs_work: "Your program needs more structure",
  not_ready: "Add blocks to get started",
}

export function buildCodeReview(analysis: ProgramAnalysis): CodeReviewResult {
  const criteria: ReviewCriterion[] = []
  let score = 0

  const add = (id: string, label: string, passed: boolean, points: number, passDetail: string, failDetail: string) => {
    if (passed) score += points
    criteria.push({
      id,
      label,
      passed,
      detail: passed ? passDetail : failDetail,
    })
  }

  add(
    "entry",
    "Program has a when started stack",
    analysis.hasWhenStarted && analysis.hasProgramBody,
    20,
    "Found a when started block with code connected underneath.",
    "Connect blocks below when started so the robot runs your instructions.",
  )

  add(
    "movement",
    "Robot can move",
    analysis.hasDrive || analysis.hasTurn,
    20,
    "Includes drive or turn blocks so the submarine can reach trash.",
    "Add drive or turn blocks — the robot cannot collect trash without moving.",
  )

  add(
    "loops",
    "Repeats actions",
    analysis.hasLoop,
    15,
    "Uses forever or repeat so the robot keeps working during the battery timer.",
    "Coral Reef Cleanup rewards programs that keep searching; try a forever loop.",
  )

  add(
    "sensing",
    "Uses sensors",
    analysis.usesDistanceSensor || analysis.usesEyeSensor || analysis.usesBumper,
    25,
    "Uses distance, eye, or bumper sensing — good for finding trash and avoiding coral.",
    "Add sensing blocks (distance sensor, eye sensor, or bumper) to react to the field.",
  )

  add(
    "decisions",
    "Makes decisions with if / else",
    analysis.hasIfThen,
    15,
    "Uses if/then (or else) so the robot chooses what to do based on sensor readings.",
    "Wrap sensor checks in if/then blocks so the robot only drives when trash is detected.",
  )

  add(
    "efficiency",
    "Not only blind driving",
    !analysis.onlyForeverNoSensing || analysis.blockCount <= 2,
    5,
    "Loop is paired with sensing or logic, not just endless driving in one direction.",
    "A forever loop without sensors often misses trash; combine loops with distance or eye blocks.",
  )

  const suggestions: string[] = []
  if (!analysis.hasProgramBody) {
    suggestions.push("Drag blocks from the left toolbox and snap them under when started.")
  }
  if (analysis.hasDrive && !analysis.hasLoop) {
    suggestions.push("Try forever with drive + turn inside so the robot patrols the reef.")
  }
  if (!analysis.usesDistanceSensor && analysis.hasIfThen) {
    suggestions.push("Distance sensor blocks pair well with if/then to drive toward trash.")
  }
  if (analysis.driveCount > 4 && !analysis.hasLoop) {
    suggestions.push("Many separate drive blocks can be replaced with one loop and sensor checks.")
  }
  if (analysis.hasLoop && !analysis.usesDistanceSensor && !analysis.usesEyeSensor) {
    suggestions.push("Inside your loop, check the front distance sensor before driving forward.")
  }
  if (analysis.hasMisplacedControlBody) {
    suggestions.push(
      "Snap blocks into the then / repeat mouth on if and loop blocks — blocks below the block always run, even when the condition is false.",
    )
  }

  const verdict = verdictFromScore(score)
  const summary = buildSummary(analysis, verdict, score)

  return {
    verdict,
    headline: VERDICT_HEADLINE[verdict],
    summary,
    score,
    blockCount: analysis.blockCount,
    criteria,
    suggestions,
  }
}

function buildSummary(analysis: ProgramAnalysis, verdict: ReviewVerdict, score: number): string {
  if (verdict === "not_ready") {
    return "I read your workspace and did not find runnable blocks under when started yet. Snap a few blocks together, then ask me to review again."
  }

  const parts: string[] = [
    `I counted ${analysis.blockCount} block${analysis.blockCount === 1 ? "" : "s"} in your program and scored it ${score}/100 for Coral Reef Cleanup.`,
  ]

  if (verdict === "excellent") {
    parts.push("Your program combines movement, repetition, and sensing — the same patterns VEXcode VR lessons recommend for collecting trash before the battery runs out.")
  } else if (verdict === "good") {
    parts.push("You have the core ideas; tightening sensor-based decisions will help the robot collect more trash with fewer coral collisions.")
  } else {
    parts.push("Focus on one improvement at a time: first movement, then a loop, then sensors inside if/then blocks.")
  }

  return parts.join(" ")
}
