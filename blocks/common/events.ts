import type { CommonBlockCategory, PythonGenerators } from "./types"

function defineBlocks(Blockly: any) {
  Blockly.Blocks["when_started"] = {
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
}

const jsGenerators = {
  when_started: () => "",
}

const pythonGenerators: PythonGenerators = {}

export const toolboxEntries = [{ kind: "block", type: "when_started" }]

export const events: CommonBlockCategory = {
  defineBlocks,
  toolboxEntries,
  jsGenerators,
  pythonGenerators,
}
