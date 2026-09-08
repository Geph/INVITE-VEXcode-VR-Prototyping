import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_control_switch"] = {
    init: function () {
      this.appendDummyInput().appendField("switch")
      this.appendDummyInput().appendField(new Blockly.FieldTextInput("# python"), "CODE")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#7CB342")
      this.setTooltip("Switch (Python) block — shown in the Python view; not executed by START")
      this.setHelpUrl("")
    },
  }
}

const jsGenerators = {
  pg_control_switch: (block: any) => {
    const code = block.getFieldValue("CODE") || ""
    return `// switch: ${String(code).replace(/\n/g, " ")}\n`
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
