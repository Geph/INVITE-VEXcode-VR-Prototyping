import { attachNumberShadow } from "@/lib/robot-runtime"
import { js } from "./js-api"
import { LOOP_YIELD } from "./loop-runtime"
import type { CommonBlockCategory, PythonGenerators } from "./types"

const INDENT = "    "

function defineBlocks(Blockly: any) {
  Blockly.Blocks["switch_code"] = {
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

  Blockly.Blocks["forever"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Repeats the blocks inside forever")
      this.setHelpUrl("")
    },
  }

  Blockly.Blocks["repeat"] = {
    init: function () {
      this.appendValueInput("TIMES").setCheck("Number").appendField("repeat")
      this.appendDummyInput().appendField("times")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Repeats the blocks inside N times")
      this.setHelpUrl("")
      attachNumberShadow(this, Blockly, "TIMES", 10)
    },
  }

  Blockly.Blocks["wait"] = {
    init: function () {
      this.appendValueInput("SECONDS").setCheck("Number").appendField("wait")
      this.appendDummyInput().appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Waits for the specified number of seconds")
      this.setHelpUrl("")
      attachNumberShadow(this, Blockly, "SECONDS", 1)
    },
  }
}

const jsGenerators = {
  switch_code: (block: any) => {
    const code = block.getFieldValue("CODE") || ""
    return `// switch: ${String(code).replace(/\n/g, " ")}\n`
  },
  forever: (block: any) => {
    const statements_do = js().statementToCode(block, "DO")
    return `while (true) {\n${statements_do}${LOOP_YIELD}}\n`
  },
  repeat: (block: any) => {
    const value_times = js().valueToCode(block, "TIMES", js().ORDER_ATOMIC) || "0"
    const statements_do = js().statementToCode(block, "DO")
    return `for (let count = 0; count < ${value_times}; count++) {\n${statements_do}${LOOP_YIELD}}\n`
  },
  wait: (block: any) => {
    const value_seconds = js().valueToCode(block, "SECONDS", js().ORDER_ATOMIC) || "0"
    return `await robot.wait(${value_seconds});\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    wait: (block, indent, { input }) => `${indent}wait(${input(block, "SECONDS", "1")}, SECONDS)\n`,
    forever: (block, indent, { body }) => `${indent}while True:\n${body(block, "DO", indent + INDENT)}`,
    repeat: (block, indent, { input, body }) =>
      `${indent}for i in range(${input(block, "TIMES", "10")}):\n${body(block, "DO", indent + INDENT)}`,
    switch_code: (block, indent) => {
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
  { kind: "block", type: "forever" },
  { kind: "block", type: "repeat" },
  { kind: "block", type: "wait" },
]

export const control: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
