import { flyoutBlockWithNumberShadows } from "@/lib/robot-runtime"
import { operatorsMath } from "./operators-math"
import { operatorsText } from "./operators-text"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  operatorsMath.defineBlocks(Blockly)
  operatorsText.defineBlocks(Blockly)
}

export const toolboxEntries = [
  { kind: "block", type: "math_number" },
  flyoutBlockWithNumberShadows("math_arithmetic", ["A", "B"]),
  flyoutBlockWithNumberShadows("compare", ["A", "B"]),
  { kind: "block", type: "boolean_and" },
  { kind: "block", type: "boolean_or" },
  { kind: "block", type: "boolean_not" },
  { kind: "block", type: "text_string" },
  flyoutBlockWithNumberShadows("range_compare", ["A", "B", "C"]),
  { kind: "block", type: "random_int" },
  flyoutBlockWithNumberShadows("round_number", ["NUM", "PLACES"], { PLACES: 0 }),
  flyoutBlockWithNumberShadows("math_function", ["NUM"]),
  flyoutBlockWithNumberShadows("atan2_function", ["X", "Y"], { X: 1, Y: 1 }),
  flyoutBlockWithNumberShadows("modulo", ["A", "B"], { A: 1, B: 1 }),
  { kind: "block", type: "text_join" },
  { kind: "block", type: "text_letter_at" },
  { kind: "block", type: "text_length" },
  { kind: "block", type: "text_contains" },
  { kind: "block", type: "convert_type" },
]

const jsGenerators = {
  ...operatorsMath.jsGenerators,
  ...operatorsText.jsGenerators,
}

const pythonGenerators: PythonGenerators = {
  expressions: {
    ...operatorsMath.pythonGenerators.expressions,
    ...operatorsText.pythonGenerators.expressions,
  },
}

export const operators: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
