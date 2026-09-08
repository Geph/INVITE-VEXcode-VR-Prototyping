import { js } from "./js-api"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_operator_and_or"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean")
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["and", "AND"],
          ["or", "OR"],
        ]),
        "OP",
      )
      this.appendValueInput("B").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["pg_operator_not"] = {
    init: function () {
      this.appendDummyInput().appendField("not")
      this.appendValueInput("BOOL").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["pg_operator_string"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput("text"), "TEXT")
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
      this.setTooltip("Text value for print and other blocks")
    },
  }

  Blockly.Blocks["pg_operator_join"] = {
    init: function () {
      this.appendDummyInput().appendField("join")
      this.appendValueInput("A").setCheck("String")
      this.appendValueInput("B").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["pg_operator_letter_of"] = {
    init: function () {
      this.appendDummyInput().appendField("letter")
      this.appendValueInput("AT").setCheck("Number")
      this.appendDummyInput().appendField("of")
      this.appendValueInput("TEXT").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["pg_operator_length"] = {
    init: function () {
      this.appendDummyInput().appendField("length of")
      this.appendValueInput("TEXT").setCheck("String")
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["pg_operator_contains"] = {
    init: function () {
      this.appendValueInput("TEXT").setCheck("String")
      this.appendDummyInput().appendField("contains")
      this.appendValueInput("SEARCH").setCheck("String")
      this.appendDummyInput().appendField("?")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["pg_operator_convert"] = {
    init: function () {
      this.appendDummyInput().appendField("convert")
      this.appendValueInput("VALUE")
      this.appendDummyInput()
        .appendField("to")
        .appendField(
          new Blockly.FieldDropdown([
            ["text", "TEXT"],
            ["number", "NUMBER"],
          ]),
          "TYPE",
        )
      this.setInputsInline(true)
      this.setOutput(true)
      this.setColour("#4CAF50")
    },
  }
}

function andOrJs(block: any) {
  const op = block.getFieldValue("OP")
  if (op === "OR") {
    const a = js().valueToCode(block, "A", js().ORDER_LOGICAL_OR) || "false"
    const b = js().valueToCode(block, "B", js().ORDER_LOGICAL_OR) || "false"
    return [`(${a} || ${b})`, js().ORDER_LOGICAL_OR]
  }
  const a = js().valueToCode(block, "A", js().ORDER_LOGICAL_AND) || "false"
  const b = js().valueToCode(block, "B", js().ORDER_LOGICAL_AND) || "false"
  return [`(${a} && ${b})`, js().ORDER_LOGICAL_AND]
}

const jsGenerators = {
  pg_operator_and_or: andOrJs,
  pg_operator_not: (block: any) => {
    const bool = js().valueToCode(block, "BOOL", js().ORDER_LOGICAL_NOT) || "false"
    return [`(!${bool})`, js().ORDER_LOGICAL_NOT]
  },
  pg_operator_string: (block: any) => {
    const text = block.getFieldValue("TEXT").replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    return [`'${text}'`, js().ORDER_ATOMIC]
  },
  pg_operator_join: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_ADDITION) || "''"
    const b = js().valueToCode(block, "B", js().ORDER_ADDITION) || "''"
    return [`(${a} + ${b})`, js().ORDER_ADDITION]
  },
  pg_operator_letter_of: (block: any) => {
    const at = js().valueToCode(block, "AT", js().ORDER_ATOMIC) || "1"
    const text = js().valueToCode(block, "TEXT", js().ORDER_MEMBER) || "''"
    return [`(${text}[${at} - 1] || '')`, js().ORDER_MEMBER]
  },
  pg_operator_length: (block: any) => {
    const text = js().valueToCode(block, "TEXT", js().ORDER_MEMBER) || "''"
    return [`(${text}.length)`, js().ORDER_MEMBER]
  },
  pg_operator_contains: (block: any) => {
    const text = js().valueToCode(block, "TEXT", js().ORDER_MEMBER) || "''"
    const search = js().valueToCode(block, "SEARCH", js().ORDER_NONE) || "''"
    return [`(${text}.includes(${search}))`, js().ORDER_FUNCTION_CALL]
  },
  pg_operator_convert: (block: any) => {
    const value = js().valueToCode(block, "VALUE", js().ORDER_ATOMIC) || "0"
    const type = block.getFieldValue("TYPE")
    if (type === "TEXT") {
      return [`String(${value})`, js().ORDER_FUNCTION_CALL]
    }
    return [`Number(${value})`, js().ORDER_FUNCTION_CALL]
  },
}

const pythonGenerators: PythonGenerators = {
  expressions: {
    pg_operator_string: (block, { pyString }) => pyString(block.getFieldValue("TEXT")),
    pg_operator_and_or: (block, { input }) => {
      const word = block.getFieldValue("OP") === "OR" ? "or" : "and"
      return `(${input(block, "A", "False")} ${word} ${input(block, "B", "False")})`
    },
    pg_operator_not: (block, { input }) => `(not ${input(block, "BOOL", "False")})`,
    pg_operator_join: (block, { input }) => `(str(${input(block, "A", '""')}) + str(${input(block, "B", '""')}))`,
    pg_operator_letter_of: (block, { input }) => `${input(block, "TEXT", '""')}[${input(block, "AT", "1")} - 1]`,
    pg_operator_length: (block, { input }) => `len(${input(block, "TEXT", '""')})`,
    pg_operator_contains: (block, { input }) => `(${input(block, "SEARCH", '""')} in ${input(block, "TEXT", '""')})`,
    pg_operator_convert: (block, { input }) =>
      block.getFieldValue("TYPE") === "TEXT"
        ? `str(${input(block, "VALUE", "0")})`
        : `float(${input(block, "VALUE", "0")})`,
  },
}

export const operatorsText: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries: [],
  jsGenerators,
  pythonGenerators,
}
