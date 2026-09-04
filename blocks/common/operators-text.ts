import { js } from "./js-api"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["boolean_and"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean")
      this.appendDummyInput().appendField("and")
      this.appendValueInput("B").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["boolean_or"] = {
    init: function () {
      this.appendValueInput("A").setCheck("Boolean")
      this.appendDummyInput().appendField("or")
      this.appendValueInput("B").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["boolean_not"] = {
    init: function () {
      this.appendDummyInput().appendField("not")
      this.appendValueInput("BOOL").setCheck("Boolean")
      this.setInputsInline(true)
      this.setOutput(true, "Boolean")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["text_string"] = {
    init: function () {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput("text"), "TEXT")
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
      this.setTooltip("Text value for print and other blocks")
    },
  }

  Blockly.Blocks["text_join"] = {
    init: function () {
      this.appendDummyInput().appendField("join")
      this.appendValueInput("A").setCheck("String")
      this.appendValueInput("B").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "String")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["text_letter_at"] = {
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

  Blockly.Blocks["text_length"] = {
    init: function () {
      this.appendDummyInput().appendField("length of")
      this.appendValueInput("TEXT").setCheck("String")
      this.setInputsInline(true)
      this.setOutput(true, "Number")
      this.setColour("#4CAF50")
    },
  }

  Blockly.Blocks["text_contains"] = {
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

  Blockly.Blocks["convert_type"] = {
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

const jsGenerators = {
  boolean_and: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_LOGICAL_AND) || "false"
    const b = js().valueToCode(block, "B", js().ORDER_LOGICAL_AND) || "false"
    return [`(${a} && ${b})`, js().ORDER_LOGICAL_AND]
  },
  boolean_or: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_LOGICAL_OR) || "false"
    const b = js().valueToCode(block, "B", js().ORDER_LOGICAL_OR) || "false"
    return [`(${a} || ${b})`, js().ORDER_LOGICAL_OR]
  },
  boolean_not: (block: any) => {
    const bool = js().valueToCode(block, "BOOL", js().ORDER_LOGICAL_NOT) || "false"
    return [`(!${bool})`, js().ORDER_LOGICAL_NOT]
  },
  text_string: (block: any) => {
    const text = block.getFieldValue("TEXT").replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    return [`'${text}'`, js().ORDER_ATOMIC]
  },
  text_join: (block: any) => {
    const a = js().valueToCode(block, "A", js().ORDER_ADDITION) || "''"
    const b = js().valueToCode(block, "B", js().ORDER_ADDITION) || "''"
    return [`(${a} + ${b})`, js().ORDER_ADDITION]
  },
  text_letter_at: (block: any) => {
    const at = js().valueToCode(block, "AT", js().ORDER_ATOMIC) || "1"
    const text = js().valueToCode(block, "TEXT", js().ORDER_MEMBER) || "''"
    return [`(${text}[${at} - 1] || '')`, js().ORDER_MEMBER]
  },
  text_length: (block: any) => {
    const text = js().valueToCode(block, "TEXT", js().ORDER_MEMBER) || "''"
    return [`(${text}.length)`, js().ORDER_MEMBER]
  },
  text_contains: (block: any) => {
    const text = js().valueToCode(block, "TEXT", js().ORDER_MEMBER) || "''"
    const search = js().valueToCode(block, "SEARCH", js().ORDER_NONE) || "''"
    return [`(${text}.includes(${search}))`, js().ORDER_FUNCTION_CALL]
  },
  convert_type: (block: any) => {
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
    text_string: (block, { pyString }) => pyString(block.getFieldValue("TEXT")),
    boolean_and: (block, { input }) => `(${input(block, "A", "False")} and ${input(block, "B", "False")})`,
    boolean_or: (block, { input }) => `(${input(block, "A", "False")} or ${input(block, "B", "False")})`,
    boolean_not: (block, { input }) => `(not ${input(block, "BOOL", "False")})`,
    text_join: (block, { input }) => `(str(${input(block, "A", '""')}) + str(${input(block, "B", '""')}))`,
    text_letter_at: (block, { input }) => `${input(block, "TEXT", '""')}[${input(block, "AT", "1")} - 1]`,
    text_length: (block, { input }) => `len(${input(block, "TEXT", '""')})`,
    text_contains: (block, { input }) => `(${input(block, "SEARCH", '""')} in ${input(block, "TEXT", '""')})`,
    convert_type: (block, { input }) =>
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
