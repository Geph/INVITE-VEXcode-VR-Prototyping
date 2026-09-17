import type { PythonGenerators } from "@/blocks/common/types"
import type { BlockCategory } from "../../types"

const RESOURCES_COLOUR = "#C0392B"

/**
 * Only `use` is wired so far. Pick up and drop need the storage the rover does
 * not have yet, and a dropdown option that silently does nothing teaches the
 * wrong thing, so they arrive with storage rather than ahead of it.
 */
const ACTION_OPTIONS: Array<[string, string]> = [["use", "use"]]

function defineRoverResourceBlocks(Blockly: any) {
  Blockly.Blocks["pg_actions_interact_with_minerals"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("minerals action")
        .appendField(new Blockly.FieldDropdown(ACTION_OPTIONS), "ACTION")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(RESOURCES_COLOUR)
      this.setTooltip("Use the mineral sample the rover is standing next to: battery to 100% and +2 XP")
    },
  }
  Blockly.JavaScript.forBlock["pg_actions_interact_with_minerals"] = (block: any) => {
    return `await robot.mineralsAction('${block.getFieldValue("ACTION")}');\n`
  }
}

export const resourcesPythonGenerators: PythonGenerators = {
  statements: {
    pg_actions_interact_with_minerals: (block, indent, { constant }) =>
      `${indent}rover.minerals_action(${constant(block.getFieldValue("ACTION"))})\n`,
  },
}

export const resourcesCategory: BlockCategory = {
  id: "resources",
  label: "Resources",
  colour: RESOURCES_COLOUR,
  define: defineRoverResourceBlocks,
  toolbox: [{ kind: "block", type: "pg_actions_interact_with_minerals" }],
}
