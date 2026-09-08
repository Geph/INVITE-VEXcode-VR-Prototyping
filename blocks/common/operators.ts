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
  flyoutBlockWithNumberShadows("pg_operator_arithmetic", ["A", "B"]),
  flyoutBlockWithNumberShadows("pg_operator_comparison", ["A", "B"]),
  { kind: "block", type: "pg_operator_and_or", fields: { OP: "AND" } },
  { kind: "block", type: "pg_operator_and_or", fields: { OP: "OR" } },
  { kind: "block", type: "pg_operator_not" },
  { kind: "block", type: "pg_operator_string" },
  flyoutBlockWithNumberShadows("pg_operator_range", ["A", "B", "C"]),
  { kind: "block", type: "pg_operator_random" },
  flyoutBlockWithNumberShadows("pg_operator_round", ["NUM", "PLACES"], { PLACES: 0 }),
  flyoutBlockWithNumberShadows("pg_operator_math", ["NUM"]),
  flyoutBlockWithNumberShadows("pg_operator_atan2", ["X", "Y"], { X: 1, Y: 1 }),
  flyoutBlockWithNumberShadows("pg_operator_modulo", ["A", "B"], { A: 1, B: 1 }),
  { kind: "block", type: "pg_operator_join" },
  { kind: "block", type: "pg_operator_letter_of" },
  { kind: "block", type: "pg_operator_length" },
  { kind: "block", type: "pg_operator_contains" },
  { kind: "block", type: "pg_operator_convert" },
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
