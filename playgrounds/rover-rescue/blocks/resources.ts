import type { PythonGenerators } from "@/blocks/common/types"
import type { BlockCategory } from "../../types"

const RESOURCES_COLOUR = "#C0392B"

const ACTION_OPTIONS: Array<[string, string]> = [
  ["pick up", "pickup"],
  ["drop", "drop"],
  ["use", "use"],
]

function defineRoverResourceBlocks(Blockly: any) {
  Blockly.Blocks["pg_actions_interact_with_minerals"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("minerals action")
        .appendField(new Blockly.FieldDropdown(ACTION_OPTIONS), "ACTION")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(RESOURCES_COLOUR)
      this.setTooltip(
        "Pick up or drop a sample, or use one on the ground. Cargo cannot be used — drop it first to recharge.",
      )
    },
  }
  Blockly.JavaScript.forBlock["pg_actions_interact_with_minerals"] = (block: any) => {
    return `await robot.mineralsAction('${block.getFieldValue("ACTION")}');\n`
  }

  Blockly.Blocks["pg_actions_standby"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("standby until")
        .appendField(new Blockly.FieldNumber(50, 0, 100), "PERCENT")
        .appendField("% battery")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(RESOURCES_COLOUR)
      this.setTooltip(
        "Fast-forward until battery falls to this percent. Does nothing if battery is already at or below it.",
      )
    },
  }
  Blockly.JavaScript.forBlock["pg_actions_standby"] = (block: any) => {
    const percent = Number(block.getFieldValue("PERCENT"))
    const n = Number.isFinite(percent) ? percent : 50
    return `await robot.standbyUntil(${n});\n`
  }

  Blockly.Blocks["pg_actions_interact_with_enemy"] = {
    init: function () {
      this.appendDummyInput().appendField("absorb radiation")
      this.setPreviousStatement(true, null)
      this.setNextStatement(true, null)
      this.setColour(RESOURCES_COLOUR)
      this.setTooltip("Siphon radiation from the nearest enemy in range. Neutralizing it awards XP.")
    },
  }
  Blockly.JavaScript.forBlock["pg_actions_interact_with_enemy"] = () => {
    return `await robot.absorbRadiation();\n`
  }

  const EVENTS_COLOUR = "#FFB300"

  Blockly.Blocks["pg_events_when_under_attack"] = {
    init: function () {
      this.appendDummyInput().appendField("when under attack")
      this.appendStatementInput("DO").setCheck(null)
      this.setColour(EVENTS_COLOUR)
      this.setTooltip("Runs the blocks inside when an enemy starts attacking")
    },
  }
  Blockly.JavaScript.forBlock["pg_events_when_under_attack"] = () => ""

  Blockly.Blocks["pg_events_when_level_up"] = {
    init: function () {
      this.appendDummyInput().appendField("when level up")
      this.appendStatementInput("DO").setCheck(null)
      this.setColour(EVENTS_COLOUR)
      this.setTooltip("Runs the blocks inside when the rover gains a level")
    },
  }
  Blockly.JavaScript.forBlock["pg_events_when_level_up"] = () => ""
}

export const resourcesPythonGenerators: PythonGenerators = {
  statements: {
    pg_actions_interact_with_minerals: (block, indent, { constant }) =>
      `${indent}rover.minerals_action(${constant(block.getFieldValue("ACTION"))})\n`,
    pg_actions_standby: (block, indent, { pyNumber }) =>
      `${indent}rover.standby_until(${pyNumber(block.getFieldValue("PERCENT"), 50)}, PERCENT)\n`,
    pg_actions_interact_with_enemy: (_block, indent) => `${indent}rover.absorb_radiation()\n`,
  },
}

export const resourcesCategory: BlockCategory = {
  id: "resources",
  label: "Resources",
  colour: RESOURCES_COLOUR,
  define: defineRoverResourceBlocks,
  toolbox: [
    { kind: "block", type: "pg_actions_interact_with_minerals" },
    { kind: "block", type: "pg_actions_interact_with_enemy" },
    { kind: "block", type: "pg_actions_standby" },
    { kind: "block", type: "pg_events_when_under_attack" },
    { kind: "block", type: "pg_events_when_level_up" },
  ],
}
