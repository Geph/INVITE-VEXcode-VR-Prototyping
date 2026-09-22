import { js } from "./js-api"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_looks_print"] = {
    init: function () {
      this.appendValueInput("TEXT").appendField("print")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
      this.setTooltip("Print text to console")
    },
  }

  Blockly.Blocks["pg_looks_next_row"] = {
    init: function () {
      this.appendDummyInput().appendField("set cursor to next row")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
    },
  }

  Blockly.Blocks["pg_looks_clear"] = {
    init: function () {
      this.appendDummyInput().appendField("clear all rows")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
    },
  }

  Blockly.Blocks["pg_looks_set_print_precision"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set print precision to")
        .appendField(
          new Blockly.FieldDropdown([
            ["1", "1"],
            ["0.1", "0.1"],
            ["0.01", "0.01"],
          ]),
          "PRECISION",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
    },
  }

  Blockly.Blocks["pg_looks_set_print_color"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("set print color")
        .appendField(
          new Blockly.FieldDropdown([
            ["black", "BLACK"],
            ["red", "RED"],
            ["green", "GREEN"],
            ["blue", "BLUE"],
          ]),
          "COLOR",
        )
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#9B59B6")
    },
  }
}

const jsGenerators = {
  pg_looks_print: (block: any) => {
    const text = js().valueToCode(block, "TEXT", js().ORDER_NONE) || "''"
    return `robot.print(${text});\n`
  },
  pg_looks_next_row: () => `robot.setCursorNextRow();\n`,
  pg_looks_clear: () => `robot.clearAllRows();\n`,
  pg_looks_set_print_precision: (block: any) => {
    const precision = block.getFieldValue("PRECISION")
    return `robot.setPrintPrecision(${precision});\n`
  },
  pg_looks_set_print_color: (block: any) => {
    const color = block.getFieldValue("COLOR")
    return `robot.setPrintColor('${color}');\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    pg_looks_print: (block, indent, { input }) => `${indent}brain.print(${input(block, "TEXT", '""')})\n`,
    pg_looks_next_row: (_block, indent) => `${indent}brain.new_line()\n`,
    pg_looks_clear: (_block, indent) => `${indent}brain.clear_all_rows()\n`,
    pg_looks_set_print_precision: (block, indent, { pyNumber }) =>
      `${indent}brain.set_print_precision(${pyNumber(block.getFieldValue("PRECISION"), 1)})\n`,
    pg_looks_set_print_color: (block, indent, { constant }) =>
      `${indent}brain.set_print_color(${constant(block.getFieldValue("COLOR"))})\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "pg_looks_print" },
  { kind: "block", type: "pg_operator_string" },
  { kind: "block", type: "pg_looks_next_row" },
  { kind: "block", type: "pg_looks_clear" },
  { kind: "block", type: "pg_looks_set_print_precision" },
  { kind: "block", type: "pg_looks_set_print_color" },
]

export const consoleBlocks: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
