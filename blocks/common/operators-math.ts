import { attachNumberShadow } from "@/lib/robot-runtime"
import { js } from "./js-api"
import type { CommonBlockCategory, PythonGenerators } from "./types"

const ARITHMETIC_OPS: Record<string, string> = {
  ADD: "+",
  MINUS: "-",
  MULTIPLY: "*",
  DIVIDE: "/",
}

const COMPARE_OPS: Record<string, string> = {
  EQ: "==",
  NEQ: "!=",
  LT: "<",
  GT: ">",
  LTE: "<=",
  GTE: ">=",
}

const RANGE_OPS: Record<string, string> = { LT: "<", LTE: "<=" }

const MATH_FUNCS: Record<string, string> = {
  ABS: "abs",
  SQRT: "math.sqrt",
  SIN: "math.sin",
  COS: "math.cos",
  TAN: "math.tan",
}

function defineBlocks(Blockly: any) {
  Blockly.Blocks["math_number"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(0), "NUM")
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      this.setTooltip("Click the number to type a value")
    },
  }

  Blockly.Blocks["math_arithmetic"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["+", "ADD"],
          ["-", "MINUS"],
          ["×", "MULTIPLY"],
          ["÷", "DIVIDE"],
        ]),
        "OP",
      )
      this.appendValueInput("B").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "A", 0)
      attachNumberShadow(this, Blockly, "B", 0)
    },
  }

  Blockly.Blocks["compare"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          [">", "GT"],
          ["≤", "LTE"],
          ["≥", "GTE"],
        ]),
        "OP",
      )
      this.appendValueInput("B").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "A", 0)
      attachNumberShadow(this, Blockly, "B", 0)
    },
  }

  Blockly.Blocks["range_compare"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["<", "LT"],
          ["≤", "LTE"],
        ]),
        "OP1",
      )
      this.appendValueInput("B").setCheck("Number")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["<", "LT"],
          ["≤", "LTE"],
        ]),
        "OP2",
      )
      this.appendValueInput("C").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "A", 0)
      attachNumberShadow(this, Blockly, "B", 0)
      attachNumberShadow(this, Blockly, "C", 10)
    },
  }

  Blockly.Blocks["random_int"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("pick random")
        .appendField(new Blockly.FieldNumber(1, 0), "FROM")
        .appendField("to")
        .appendField(new Blockly.FieldNumber(10, 0), "TO")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["round_number"] = {
    init: function () {
      this.appendDummyInput().appendField("round")
      this.appendValueInput("NUM").setCheck("Number")
      this.appendDummyInput().appendField("to")
      this.appendValueInput("PLACES").setCheck("Number")
      this.appendDummyInput().appendField("decimal places")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "NUM", 0)
      attachNumberShadow(this, Blockly, "PLACES", 0)
    },
  }

  Blockly.Blocks["math_function"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["abs", "ABS"],
          ["√", "SQRT"],
          ["sin", "SIN"],
          ["cos", "COS"],
          ["tan", "TAN"],
        ]),
        "FUNC",
      )
      this.appendDummyInput().appendField("of")
      this.appendValueInput("NUM").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "NUM", 0)
    },
  }

  Blockly.Blocks["atan2_function"] = {
    init: function () {
      this.appendDummyInput().appendField("atan2 of x:")
      this.appendValueInput("X").setCheck("Number")
      this.appendDummyInput().appendField("y:")
      this.appendValueInput("Y").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "X", 1)
      attachNumberShadow(this, Blockly, "Y", 1)
    },
  }

  Blockly.Blocks["modulo"] = {
    init: function () {
      this.appendDummyInput().appendField("remainder of")
      this.appendValueInput("A").setCheck("Number")
      this.appendDummyInput().appendField("/")
      this.appendValueInput("B").setCheck("Number")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
      attachNumberShadow(this, Blockly, "A", 1)
      attachNumberShadow(this, Blockly, "B", 1)
    },
  }
}

const jsGenerators = {
  math_number: (block: any) => {
    const num = Number(block.getFieldValue("NUM"))
    const safe = Number.isFinite(num) ? num : 0
    const order = safe < 0 ? js().ORDER_UNARY_NEGATION : js().ORDER_ATOMIC
    return [String(safe), order]
  },
  math_arithmetic: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_ATOMIC) || "0"
    const b = js().valueToCode(block, "B", js().ORDER_ATOMIC) || "0"
    const op = block.getFieldValue("OP")
    const operators: Record<string, string> = { ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/" }
    return [`(${a} ${operators[op]} ${b})`, js().ORDER_ATOMIC]
  },
  compare: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_RELATIONAL) || "0"
    const b = js().valueToCode(block, "B", js().ORDER_RELATIONAL) || "0"
    const op = block.getFieldValue("OP")
    const operators: Record<string, string> = { EQ: "===", NEQ: "!==", LT: "<", GT: ">", LTE: "<=", GTE: ">=" }
    return [`(${a} ${operators[op]} ${b})`, js().ORDER_RELATIONAL]
  },
  range_compare: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_RELATIONAL) || "0"
    const b = js().valueToCode(block, "B", js().ORDER_RELATIONAL) || "0"
    const c = js().valueToCode(block, "C", js().ORDER_RELATIONAL) || "0"
    const op1 = block.getFieldValue("OP1")
    const op2 = block.getFieldValue("OP2")
    const operators: Record<string, string> = { LT: "<", LTE: "<=" }
    return [`(${a} ${operators[op1]} ${b} && ${b} ${operators[op2]} ${c})`, js().ORDER_LOGICAL_AND]
  },
  random_int: (block: any) => {
    const from = Number(block.getFieldValue("FROM"))
    const to = Number(block.getFieldValue("TO"))
    const lo = Math.min(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
    const hi = Math.max(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
    return [`(Math.floor(Math.random() * (${hi} - ${lo} + 1)) + ${lo})`, js().ORDER_ATOMIC]
  },
  round_number: (block: any) => {
    const num = js().valueToCode(block, "NUM", js().ORDER_ATOMIC) || "0"
    const places = js().valueToCode(block, "PLACES", js().ORDER_ATOMIC) || "0"
    return [`(Math.round(${num} * Math.pow(10, ${places})) / Math.pow(10, ${places}))`, js().ORDER_ATOMIC]
  },
  math_function: (block: any) => {
    const num = js().valueToCode(block, "NUM", js().ORDER_ATOMIC) || "0"
    const func = block.getFieldValue("FUNC")
    const functions: Record<string, string> = {
      ABS: "Math.abs",
      SQRT: "Math.sqrt",
      SIN: "Math.sin",
      COS: "Math.cos",
      TAN: "Math.tan",
    }
    return [`${functions[func]}(${num})`, js().ORDER_FUNCTION_CALL]
  },
  atan2_function: (block: any) => {
    const x = js().valueToCode(block, "X", js().ORDER_ATOMIC) || "1"
    const y = js().valueToCode(block, "Y", js().ORDER_ATOMIC) || "1"
    return [`Math.atan2(${y}, ${x})`, js().ORDER_FUNCTION_CALL]
  },
  modulo: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_MODULUS) || "0"
    const b = js().valueToCode(block, "B", js().ORDER_MODULUS) || "1"
    return [`(${a} % ${b})`, js().ORDER_MODULUS]
  },
}

const pythonGenerators: PythonGenerators = {
  expressions: {
    math_number: (block, { pyNumber }) => pyNumber(block.getFieldValue("NUM")),
    math_arithmetic: (block, { input }) => {
      const op = ARITHMETIC_OPS[block.getFieldValue("OP")] ?? "+"
      return `(${input(block, "A", "0")} ${op} ${input(block, "B", "0")})`
    },
    compare: (block, { input }) => {
      const op = COMPARE_OPS[block.getFieldValue("OP")] ?? "=="
      return `(${input(block, "A", "0")} ${op} ${input(block, "B", "0")})`
    },
    range_compare: (block, { input }) => {
      const op1 = RANGE_OPS[block.getFieldValue("OP1")] ?? "<"
      const op2 = RANGE_OPS[block.getFieldValue("OP2")] ?? "<"
      return `(${input(block, "A", "0")} ${op1} ${input(block, "B", "0")} ${op2} ${input(block, "C", "0")})`
    },
    random_int: (block) => {
      const from = Number(block.getFieldValue("FROM"))
      const to = Number(block.getFieldValue("TO"))
      const lo = Math.min(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
      const hi = Math.max(Number.isFinite(from) ? from : 0, Number.isFinite(to) ? to : 0)
      return `random.randint(${lo}, ${hi})`
    },
    round_number: (block, { input }) => `round(${input(block, "NUM", "0")}, ${input(block, "PLACES", "0")})`,
    math_function: (block, { input }) => {
      const fn = MATH_FUNCS[block.getFieldValue("FUNC")] ?? "abs"
      return `${fn}(${input(block, "NUM", "0")})`
    },
    atan2_function: (block, { input }) => `math.atan2(${input(block, "Y", "1")}, ${input(block, "X", "1")})`,
    modulo: (block, { input }) => `(${input(block, "A", "0")} % ${input(block, "B", "1")})`,
  },
}

export const operatorsMath: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries: [],
  jsGenerators,
  pythonGenerators,
}
