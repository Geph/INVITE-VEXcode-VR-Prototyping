import { js } from "./js-api"
import { LOOP_BLOCK_TYPES, LOOP_YIELD } from "./loop-runtime"
import type { CommonBlockCategory, PythonGenerators } from "./types"

const INDENT = "    "

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_control_wait"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("wait")
        .appendField(new Blockly.FieldNumber(1, 0), "SECONDS")
        .appendField("seconds")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["pg_control_wait_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("wait until")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["pg_control_repeat"] = {
    init: function () {
      this.appendDummyInput().appendField("repeat").appendField(new Blockly.FieldNumber(10, 1), "TIMES")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap blocks inside the mouth under repeat — not below the block.")
    },
  }

  Blockly.Blocks["pg_control_forever"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap blocks inside the forever mouth — not below the block.")
    },
  }

  Blockly.Blocks["pg_control_repeat_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("repeat until")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Runs the mouth blocks until the condition is true. Put blocks inside the mouth.")
    },
  }

  Blockly.Blocks["pg_control_while"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("while")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeats the mouth blocks while the condition is true.")
    },
  }

  Blockly.Blocks["pg_control_if_then"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO").appendField("then").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Runs the blocks inside then when the condition is true — not blocks snapped below.")
    },
  }

  Blockly.Blocks["pg_control_if_then_else"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO").appendField("then").setCheck(null)
      this.appendStatementInput("ELSE").appendField("else").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Use the then and else mouths for each branch — not the notch below the block.")
    },
  }

  Blockly.Blocks["pg_control_if_elseif_else"] = {
    init: function () {
      this.appendValueInput("CONDITION1").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO1").appendField("then").setCheck(null)
      this.appendValueInput("CONDITION2").setCheck("Boolean").appendField("else if")
      this.appendStatementInput("DO2").appendField("then").setCheck(null)
      this.appendStatementInput("ELSE").appendField("else").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap each branch into its then / else mouth.")
    },
  }

  Blockly.Blocks["pg_control_break"] = {
    init: function () {
      this.appendDummyInput().appendField("break")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["pg_control_stop_project"] = {
    init: function () {
      this.appendDummyInput().appendField("stop project")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["pg_control_comment"] = {
    init: function () {
      this.appendDummyInput().appendField("comment").appendField(new Blockly.FieldTextInput(""), "TEXT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#AAAAAA")
    },
  }
}

function waitSeconds(block: any): string {
  const field = block.getFieldValue?.("SECONDS")
  if (field !== "" && field != null) return String(field)
  return js().valueToCode(block, "SECONDS", js().ORDER_ATOMIC) || "0"
}

function repeatTimes(block: any): string {
  const field = block.getFieldValue?.("TIMES")
  if (field !== "" && field != null) return String(field)
  return js().valueToCode(block, "TIMES", js().ORDER_ATOMIC) || "0"
}

const jsGenerators = {
  pg_control_wait: (block: any) => `await robot.wait(${waitSeconds(block)});\n`,
  pg_control_wait_until: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    return `while(!(${condition})) { await robot.wait(0.1); }\n`
  },
  pg_control_repeat: (block: any) => {
    const times = repeatTimes(block)
    const statements = js().statementToCode(block, "DO")
    return `for(let i = 0; i < ${times}; i++) {\n${statements}${LOOP_YIELD}}\n`
  },
  pg_control_forever: (block: any) => {
    const statements = js().statementToCode(block, "DO")
    return `while(true) {\n${statements}${LOOP_YIELD}}\n`
  },
  pg_control_repeat_until: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "false"
    const statements = js().statementToCode(block, "DO")
    return `while(!(${condition})) {\n${statements}${LOOP_YIELD}}\n`
  },
  pg_control_while: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    const statements = js().statementToCode(block, "DO")
    return `while(${condition}) {\n${statements}${LOOP_YIELD}}\n`
  },
  pg_control_if_then: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    const statements = js().statementToCode(block, "DO")
    return `if(${condition}) {\n${statements}}\n`
  },
  pg_control_if_then_else: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    const doStatements = js().statementToCode(block, "DO")
    const elseStatements = js().statementToCode(block, "ELSE")
    return `if(${condition}) {\n${doStatements}} else {\n${elseStatements}}\n`
  },
  pg_control_if_elseif_else: (block: any) => {
    const condition1 = js().valueToCode(block, "CONDITION1", js().ORDER_NONE) || "true"
    const do1Statements = js().statementToCode(block, "DO1")
    const condition2 = js().valueToCode(block, "CONDITION2", js().ORDER_NONE) || "true"
    const do2Statements = js().statementToCode(block, "DO2")
    const elseStatements = js().statementToCode(block, "ELSE")
    return `if (${condition1}) {\n${do1Statements}} else if (${condition2}) {\n${do2Statements}} else {\n${elseStatements}}\n`
  },
  pg_control_break: (block: any) => {
    for (let parent = block.getSurroundParent?.(); parent; parent = parent.getSurroundParent?.()) {
      if (LOOP_BLOCK_TYPES.has(parent.type)) {
        block.setWarningText?.(null)
        return "break;\n"
      }
    }
    block.setWarningText?.("Put break inside a loop block.")
    return "// break ignored: not inside a loop\n"
  },
  pg_control_stop_project: () => `robot.stop();\n`,
  pg_control_comment: (block: any) => {
    const text = block.getFieldValue("TEXT")
    return `// ${text}\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    pg_control_wait: (block, indent, { pyNumber, input }) => {
      const field = block.getFieldValue("SECONDS")
      const seconds = field !== "" && field != null ? pyNumber(field, 1) : input(block, "SECONDS", "1")
      return `${indent}wait(${seconds}, SECONDS)\n`
    },
    pg_control_wait_until: (block, indent, { input }) =>
      `${indent}while not ${input(block, "CONDITION", "True")}:\n${indent}${INDENT}wait(5, MSEC)\n`,
    pg_control_repeat: (block, indent, { pyNumber, input, body }) => {
      const field = block.getFieldValue("TIMES")
      const times = field !== "" && field != null ? pyNumber(field, 10) : input(block, "TIMES", "10")
      return `${indent}for i in range(${times}):\n${body(block, "DO", indent + INDENT)}`
    },
    pg_control_forever: (block, indent, { body }) => `${indent}while True:\n${body(block, "DO", indent + INDENT)}`,
    pg_control_repeat_until: (block, indent, { input, body }) =>
      `${indent}while not ${input(block, "CONDITION", "False")}:\n${body(block, "DO", indent + INDENT)}`,
    pg_control_while: (block, indent, { input, body }) =>
      `${indent}while ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}`,
    pg_control_if_then: (block, indent, { input, body }) =>
      `${indent}if ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}`,
    pg_control_if_then_else: (block, indent, { input, body }) =>
      `${indent}if ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}` +
      `${indent}else:\n${body(block, "ELSE", indent + INDENT)}`,
    pg_control_if_elseif_else: (block, indent, { input, body }) =>
      `${indent}if ${input(block, "CONDITION1", "True")}:\n${body(block, "DO1", indent + INDENT)}` +
      `${indent}elif ${input(block, "CONDITION2", "True")}:\n${body(block, "DO2", indent + INDENT)}` +
      `${indent}else:\n${body(block, "ELSE", indent + INDENT)}`,
    pg_control_break: (_block, indent) => `${indent}break\n`,
    pg_control_stop_project: (_block, indent) => `${indent}vr_thread.stop_all()\n`,
    pg_control_comment: (block, indent) => `${indent}# ${block.getFieldValue("TEXT")}\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "pg_control_wait" },
  { kind: "block", type: "pg_control_wait_until" },
  { kind: "block", type: "pg_control_repeat" },
  { kind: "block", type: "pg_control_forever" },
  { kind: "block", type: "pg_control_repeat_until" },
  { kind: "block", type: "pg_control_while" },
  { kind: "block", type: "pg_control_if_then" },
  { kind: "block", type: "pg_control_if_then_else" },
  { kind: "block", type: "pg_control_if_elseif_else" },
  { kind: "block", type: "pg_control_break" },
  { kind: "block", type: "pg_control_stop_project" },
  { kind: "block", type: "pg_control_comment" },
]

export const logic: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
