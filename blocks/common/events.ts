import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["pg_events_when_started"] = {
    init: function () {
      this.appendDummyInput().appendField("when started")
      this.hat = "cap"
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Runs when the program starts. Duplicate for multi-threaded programs.")
      this.setHelpUrl("")
      this.setDeletable(true)
      this.setMovable(true)
    },
  }

  Blockly.Blocks["pg_events_broadcast"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("broadcast")
        .appendField(new Blockly.FieldTextInput("message1"), "OBJECT")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour("#FFB300")
      this.setTooltip("Send a message. when I receive hats with the same name run.")
    },
  }

  Blockly.Blocks["pg_events_when_broadcasted"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("when I receive")
        .appendField(new Blockly.FieldTextInput("message1"), "OBJECT")
      this.appendStatementInput("SUBSTACK").setCheck(null)
      this.setColour("#FFB300")
      this.setTooltip("Runs when a matching broadcast message is sent.")
    },
  }
}

const jsGenerators = {
  pg_events_when_started: () => "",
  pg_events_broadcast: (block: any) => {
    const message = String(block.getFieldValue("OBJECT") || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'")
    return `robot.broadcast('${message}');\n`
  },
  pg_events_when_broadcasted: () => "",
}

const pythonGenerators: PythonGenerators = {
  statements: {
    pg_events_broadcast: (block, indent, { pyString }) =>
      `${indent}broadcast(${pyString(block.getFieldValue("OBJECT") || "message1")})\n`,
  },
}

export const toolboxEntries = [
  { kind: "block", type: "pg_events_when_started" },
  { kind: "block", type: "pg_events_broadcast" },
  { kind: "block", type: "pg_events_when_broadcasted" },
]

export const events: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
