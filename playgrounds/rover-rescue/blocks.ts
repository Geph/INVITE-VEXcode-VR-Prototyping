import type { PythonGenerators } from "@/blocks/common/types"
import type { BlockCategory } from "../types"

const SENSING_COLOUR = "#14B8A6"

const SEE_OPTIONS: Array<[string, string]> = [
  ["minerals", "minerals"],
  ["enemy", "enemy"],
  ["obstacles", "obstacle"],
  ["hazards", "hazard"],
  ["base", "base"],
]

const DETECT_OPTIONS: Array<[string, string]> = [
  ["minerals", "minerals"],
  ["enemy", "enemy"],
]

const DIRECTION_OPTIONS: Array<[string, string]> = [
  ["minerals", "minerals"],
  ["enemy", "enemy"],
  ["base", "base"],
]

const DISTANCE_OPTIONS: Array<[string, string]> = [
  ["minerals", "minerals"],
  ["enemy", "enemy"],
  ["obstacles", "obstacle"],
  ["hazards", "hazard"],
  ["base", "base"],
]

const UNIT_OPTIONS: Array<[string, string]> = [
  ["mm", "mm"],
  ["inches", "inches"],
]

function defineRoverSensingBlocks(Blockly: any) {
  Blockly.Blocks["rover_sees"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("rover sees")
        .appendField(new Blockly.FieldDropdown(SEE_OPTIONS), "KIND")
        .appendField("?")
      this.setOutput(true, "Boolean")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("True when the selected object is inside the 40° sight cone (1000 mm)")
    },
  }
  Blockly.JavaScript.forBlock["rover_sees"] = (block: any) => {
    return [`robot.sees('${block.getFieldValue("KIND")}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["rover_detects"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("rover detects")
        .appendField(new Blockly.FieldDropdown(DETECT_OPTIONS), "KIND")
        .appendField("?")
      this.setOutput(true, "Boolean")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("True when minerals or an enemy are inside the 360° detect radius (800 mm)")
    },
  }
  Blockly.JavaScript.forBlock["rover_detects"] = (block: any) => {
    return [`robot.detects('${block.getFieldValue("KIND")}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["rover_direction"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("rover direction")
        .appendField(new Blockly.FieldDropdown(DIRECTION_OPTIONS), "KIND")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Relative heading to the nearest matching object (−180° to 180°)")
    },
  }
  Blockly.JavaScript.forBlock["rover_direction"] = (block: any) => {
    return [`robot.roverAngle('${block.getFieldValue("KIND")}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["rover_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("rover distance")
        .appendField(new Blockly.FieldDropdown(DISTANCE_OPTIONS), "KIND")
        .appendField("in")
        .appendField(new Blockly.FieldDropdown(UNIT_OPTIONS), "UNIT")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Distance to the nearest matching object in sight (Base is always valid)")
    },
  }
  Blockly.JavaScript.forBlock["rover_distance"] = (block: any) => {
    const kind = block.getFieldValue("KIND")
    const unit = block.getFieldValue("UNIT")
    return [`robot.roverDistanceTo('${kind}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["rover_location"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("rover location")
        .appendField(new Blockly.FieldDropdown(DISTANCE_OPTIONS), "KIND")
        .appendField(
          new Blockly.FieldDropdown([
            ["X", "X"],
            ["Y", "Y"],
          ]),
          "AXIS",
        )
        .appendField("in")
        .appendField(new Blockly.FieldDropdown(UNIT_OPTIONS), "UNIT")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("World coordinates of the nearest matching object, not the rover")
    },
  }
  Blockly.JavaScript.forBlock["rover_location"] = (block: any) => {
    const kind = block.getFieldValue("KIND")
    const axis = block.getFieldValue("AXIS")
    const unit = block.getFieldValue("UNIT")
    return [`robot.roverLocation('${kind}', '${axis}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["rover_distance_found_object"] = {
    init: function () {
      this.appendDummyInput().appendField("distance found object?")
      this.setOutput(true, "Boolean")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("True when the forward distance sensor hits something within 2000 mm")
    },
  }
  Blockly.JavaScript.forBlock["rover_distance_found_object"] = () => {
    return [`robot.distanceFoundObject('front')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["rover_object_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("object distance in")
        .appendField(new Blockly.FieldDropdown(UNIT_OPTIONS), "UNIT")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Forward distance sensor reading, capped at 2000 mm")
    },
  }
  Blockly.JavaScript.forBlock["rover_object_distance"] = (block: any) => {
    const unit = block.getFieldValue("UNIT")
    return [`robot.getDistance('front', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["position_value"] = {
    init: function () {
      this.appendDummyInput().appendField("position")
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["X", "X"],
            ["Y", "Y"],
          ]),
          "AXIS",
        )
        .appendField("in")
        .appendField(
          new Blockly.FieldDropdown([
            ["mm", "MM"],
            ["inches", "INCHES"],
          ]),
          "UNIT",
        )
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Get the rover's own position")
    },
  }
  Blockly.JavaScript.forBlock["position_value"] = (block: any) => {
    const axis = block.getFieldValue("AXIS")
    const unit = block.getFieldValue("UNIT")
    return [`robot.getPosition('${axis}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["position_angle"] = {
    init: function () {
      this.appendDummyInput().appendField("position angle in degrees")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Get the rover's heading")
    },
  }
  Blockly.JavaScript.forBlock["position_angle"] = () => {
    return [`robot.getPositionAngle()`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }
}

export const roverRescuePythonGenerators: PythonGenerators = {
  expressions: {
    rover_sees: (block, { constant }) => `rover.sees(${constant(block.getFieldValue("KIND"))})`,
    rover_detects: (block, { constant }) => `rover.detects(${constant(block.getFieldValue("KIND"))})`,
    rover_direction: (block, { constant }) => `rover.angle(${constant(block.getFieldValue("KIND"))})`,
    rover_distance: (block, { constant }) =>
      `rover.get_distance(${constant(block.getFieldValue("KIND"))}, ${constant(block.getFieldValue("UNIT"))})`,
    rover_location: (block, { constant }) =>
      `rover.location(${constant(block.getFieldValue("KIND"))}, ${constant(block.getFieldValue("AXIS"))}, ${constant(block.getFieldValue("UNIT"))})`,
    rover_distance_found_object: () => "distance.found_object()",
    rover_object_distance: (block, { constant }) =>
      `distance.get_distance(${constant(block.getFieldValue("UNIT"))})`,
    position_value: (block, { constant }) =>
      `location.position(${constant(block.getFieldValue("AXIS"))}, ${constant(block.getFieldValue("UNIT"))})`,
    position_angle: () => "location.position_angle(DEGREES)",
  },
}

export const roverRescueBlocks: BlockCategory[] = [
  {
    id: "sensing",
    label: "Sensing",
    colour: SENSING_COLOUR,
    define: defineRoverSensingBlocks,
    toolbox: [
      { kind: "block", type: "rover_sees" },
      { kind: "block", type: "rover_detects" },
      { kind: "block", type: "rover_direction" },
      { kind: "block", type: "rover_distance" },
      { kind: "block", type: "rover_location" },
      { kind: "block", type: "rover_distance_found_object" },
      { kind: "block", type: "rover_object_distance" },
      { kind: "block", type: "position_value" },
      { kind: "block", type: "position_angle" },
    ],
  },
]
