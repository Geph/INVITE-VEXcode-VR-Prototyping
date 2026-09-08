import { attachNumberShadow } from "@/lib/robot-runtime"
import { js } from "./js-api"
import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_variables_set_variable"] = {
    init: function () {
      this.appendValueInput("OPERAND")
        .setCheck(null)
        .appendField("set")
        .appendField(new Blockly.FieldTextInput("item"), "OBJECT")
        .appendField("to")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FF8C1A")
      this.setTooltip("Set a variable to a value")
      attachNumberShadow(this, Blockly, "OPERAND", 0)
    },
  }
}

const jsGenerators = {
  pg_variables_set_variable: (block: any) => {
    const name = String(block.getFieldValue("OBJECT") || "item").replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    const value = js().valueToCode(block, "OPERAND", js().ORDER_NONE) || "0"
    return `robot.setVariable('${name}', ${value});\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    pg_variables_set_variable: (block, indent, { input }) => {
      const name = String(block.getFieldValue("OBJECT") || "item").replace(/\W/g, "_") || "item"
      return `${indent}${name} = ${input(block, "OPERAND", "0")}\n`
    },
  },
}

export const toolboxEntries = [{ kind: "block", type: "pg_variables_set_variable" }]

export const variables: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
