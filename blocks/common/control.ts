import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_control_switch"] = {
    init: function () {
      this.appendDummyInput().appendField("switch")
      this.appendDummyInput().appendField(new Blockly.FieldTextInput("# python"), "CODE")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#7CB342")
      this.setTooltip("Run VEX Python command calls with literal arguments (drivetrain, wait, print, pen). Supports for … in range(number). Unsupported Python reports an error.")
      this.setHelpUrl("")
    },
  }
}

const jsGenerators = {
  pg_control_switch: (block: any) => {
    const code = block.getFieldValue("CODE") || ""
    return `await robot.runSwitchCode(${JSON.stringify(String(code))});\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    pg_control_switch: (block, indent) => {
      const code = block.getFieldValue("CODE") || ""
      return code
        .split("\n")
        .map((line) => `${indent}${line}`)
        .join("\n")
        .concat("\n")
    },
  },
}

export const toolboxEntries = [
  { kind: "block", type: "pg_control_forever" },
  { kind: "block", type: "pg_control_repeat" },
  { kind: "block", type: "pg_control_wait" },
  { kind: "block", type: "pg_control_switch" },
]

export const control: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
