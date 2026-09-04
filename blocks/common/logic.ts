import { js } from "./js-api"
import { LOOP_BLOCK_TYPES, LOOP_YIELD } from "./loop-runtime"
import type { CommonBlockCategory, PythonGenerators } from "./types"

const INDENT = "    "

function defineBlocks(Blockly: any) {
  Blockly.Blocks["wait_seconds"] = {
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

  Blockly.Blocks["wait_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("wait until")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["repeat_times"] = {
    init: function () {
      this.appendDummyInput().appendField("repeat").appendField(new Blockly.FieldNumber(10, 1), "TIMES")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap blocks inside the mouth under repeat — not below the block.")
    },
  }

  Blockly.Blocks["forever_loop"] = {
    init: function () {
      this.appendDummyInput().appendField("forever")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Snap blocks inside the forever mouth — not below the block.")
    },
  }

  Blockly.Blocks["repeat_until"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("repeat until")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Runs the mouth blocks until the condition is true. Put blocks inside the mouth.")
    },
  }

  Blockly.Blocks["while_loop"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("while")
      this.appendStatementInput("DO").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Repeats the mouth blocks while the condition is true.")
    },
  }

  Blockly.Blocks["if_then"] = {
    init: function () {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("if")
      this.appendStatementInput("DO").appendField("then").setCheck(null)
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#F5A623")
      this.setTooltip("Runs the blocks inside then when the condition is true — not blocks snapped below.")
    },
  }

  Blockly.Blocks["if_then_else"] = {
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

  Blockly.Blocks["if_elseif_else"] = {
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

  Blockly.Blocks["break_block"] = {
    init: function () {
      this.appendDummyInput().appendField("break")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["stop_project"] = {
    init: function () {
      this.appendDummyInput().appendField("stop project")
      this.setPreviousStatement(true, null)
      this.setColour("#F5A623")
    },
  }

  Blockly.Blocks["comment_block"] = {
    init: function () {
      this.appendDummyInput().appendField("comment").appendField(new Blockly.FieldTextInput(""), "TEXT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#AAAAAA")
    },
  }
}

const jsGenerators = {
  wait_seconds: (block: any) => {
    const seconds = block.getFieldValue("SECONDS")
    return `await robot.wait(${seconds});\n`
  },
  wait_until: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    return `while(!(${condition})) { await robot.wait(0.1); }\n`
  },
  repeat_times: (block: any) => {
    const times = block.getFieldValue("TIMES")
    const statements = js().statementToCode(block, "DO")
    return `for(let i = 0; i < ${times}; i++) {\n${statements}${LOOP_YIELD}}\n`
  },
  forever_loop: (block: any) => {
    const statements = js().statementToCode(block, "DO")
    return `while(true) {\n${statements}${LOOP_YIELD}}\n`
  },
  repeat_until: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "false"
    const statements = js().statementToCode(block, "DO")
    return `while(!(${condition})) {\n${statements}${LOOP_YIELD}}\n`
  },
  while_loop: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    const statements = js().statementToCode(block, "DO")
    return `while(${condition}) {\n${statements}${LOOP_YIELD}}\n`
  },
  if_then: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    const statements = js().statementToCode(block, "DO")
    return `if(${condition}) {\n${statements}}\n`
  },
  if_then_else: (block: any) => {
    const condition = js().valueToCode(block, "CONDITION", js().ORDER_NONE) || "true"
    const doStatements = js().statementToCode(block, "DO")
    const elseStatements = js().statementToCode(block, "ELSE")
    return `if(${condition}) {\n${doStatements}} else {\n${elseStatements}}\n`
  },
  if_elseif_else: (block: any) => {
    const condition1 = js().valueToCode(block, "CONDITION1", js().ORDER_NONE) || "true"
    const do1Statements = js().statementToCode(block, "DO1")
    const condition2 = js().valueToCode(block, "CONDITION2", js().ORDER_NONE) || "true"
    const do2Statements = js().statementToCode(block, "DO2")
    const elseStatements = js().statementToCode(block, "ELSE")
    return `if (${condition1}) {\n${do1Statements}} else if (${condition2}) {\n${do2Statements}} else {\n${elseStatements}}\n`
  },
  break_block: (block: any) => {
    for (let parent = block.getSurroundParent?.(); parent; parent = parent.getSurroundParent?.()) {
      if (LOOP_BLOCK_TYPES.has(parent.type)) {
        block.setWarningText?.(null)
        return "break;\n"
      }
    }
    block.setWarningText?.("Put break inside a loop block.")
    return "// break ignored: not inside a loop\n"
  },
  stop_project: () => `robot.stop();\n`,
  comment_block: (block: any) => {
    const text = block.getFieldValue("TEXT")
    return `// ${text}\n`
  },
}

const pythonGenerators: PythonGenerators = {
  statements: {
    wait_seconds: (block, indent, { pyNumber }) =>
      `${indent}wait(${pyNumber(block.getFieldValue("SECONDS"), 1)}, SECONDS)\n`,
    wait_until: (block, indent, { input }) =>
      `${indent}while not ${input(block, "CONDITION", "True")}:\n${indent}${INDENT}wait(5, MSEC)\n`,
    repeat_times: (block, indent, { pyNumber, body }) =>
      `${indent}for i in range(${pyNumber(block.getFieldValue("TIMES"), 10)}):\n${body(block, "DO", indent + INDENT)}`,
    forever_loop: (block, indent, { body }) => `${indent}while True:\n${body(block, "DO", indent + INDENT)}`,
    repeat_until: (block, indent, { input, body }) =>
      `${indent}while not ${input(block, "CONDITION", "False")}:\n${body(block, "DO", indent + INDENT)}`,
    while_loop: (block, indent, { input, body }) =>
      `${indent}while ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}`,
    if_then: (block, indent, { input, body }) =>
      `${indent}if ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}`,
    if_then_else: (block, indent, { input, body }) =>
      `${indent}if ${input(block, "CONDITION", "True")}:\n${body(block, "DO", indent + INDENT)}` +
      `${indent}else:\n${body(block, "ELSE", indent + INDENT)}`,
    if_elseif_else: (block, indent, { input, body }) =>
      `${indent}if ${input(block, "CONDITION1", "True")}:\n${body(block, "DO1", indent + INDENT)}` +
      `${indent}elif ${input(block, "CONDITION2", "True")}:\n${body(block, "DO2", indent + INDENT)}` +
      `${indent}else:\n${body(block, "ELSE", indent + INDENT)}`,
    break_block: (_block, indent) => `${indent}break\n`,
    stop_project: (_block, indent) => `${indent}vr_thread.stop_all()\n`,
    comment_block: (block, indent) => `${indent}# ${block.getFieldValue("TEXT")}\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "wait_seconds" },
  { kind: "block", type: "wait_until" },
  { kind: "block", type: "repeat_times" },
  { kind: "block", type: "forever_loop" },
  { kind: "block", type: "repeat_until" },
  { kind: "block", type: "while_loop" },
  { kind: "block", type: "if_then" },
  { kind: "block", type: "if_then_else" },
  { kind: "block", type: "if_elseif_else" },
  { kind: "block", type: "break_block" },
  { kind: "block", type: "stop_project" },
  { kind: "block", type: "comment_block" },
]

export const logic: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
