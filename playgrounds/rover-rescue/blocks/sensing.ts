import type { PythonGenerators } from "@/blocks/common/types"
import type { BlockCategory } from "../../types"

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
  Blockly.Blocks["pg_sensing_ai_sees"] = {
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
  Blockly.JavaScript.forBlock["pg_sensing_ai_sees"] = (block: any) => {
    return [`robot.sees('${block.getFieldValue("KIND")}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_ai_smells"] = {
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
  Blockly.JavaScript.forBlock["pg_sensing_ai_smells"] = (block: any) => {
    return [`robot.detects('${block.getFieldValue("KIND")}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_ai_sees_direction"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("rover direction")
        .appendField(new Blockly.FieldDropdown(DIRECTION_OPTIONS), "KIND")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Relative heading to the nearest matching object (−180° to 180°)")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_ai_sees_direction"] = (block: any) => {
    return [`robot.roverAngle('${block.getFieldValue("KIND")}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_ai_sees_distance"] = {
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
  Blockly.JavaScript.forBlock["pg_sensing_ai_sees_distance"] = (block: any) => {
    const kind = block.getFieldValue("KIND")
    const unit = block.getFieldValue("UNIT")
    return [`robot.roverDistanceTo('${kind}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_ai_sees_location"] = {
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
  Blockly.JavaScript.forBlock["pg_sensing_ai_sees_location"] = (block: any) => {
    const kind = block.getFieldValue("KIND")
    const axis = block.getFieldValue("AXIS")
    const unit = block.getFieldValue("UNIT")
    return [`robot.roverLocation('${kind}', '${axis}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_distance_found"] = {
    init: function () {
      this.appendDummyInput().appendField("distance found object?")
      this.setOutput(true, "Boolean")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("True when the forward distance sensor hits something within 2000 mm")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_distance_found"] = () => {
    return [`robot.distanceFoundObject('front')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_object_distance"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("object distance in")
        .appendField(new Blockly.FieldDropdown(UNIT_OPTIONS), "UNIT")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Forward distance sensor reading, capped at 2000 mm")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_object_distance"] = (block: any) => {
    const unit = block.getFieldValue("UNIT")
    return [`robot.getDistance('front', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_position"] = {
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
  Blockly.JavaScript.forBlock["pg_sensing_position"] = (block: any) => {
    const axis = block.getFieldValue("AXIS")
    const unit = block.getFieldValue("UNIT")
    return [`robot.getPosition('${axis}', '${unit}')`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_position_angle"] = {
    init: function () {
      this.appendDummyInput().appendField("position angle in degrees")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Get the rover's heading")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_position_angle"] = () => {
    return [`robot.getPositionAngle()`, Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_robot_battery_capacity"] = {
    init: function () {
      this.appendDummyInput().appendField("battery level")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Battery remaining, 0 to 100. The mission ends at 0")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_robot_battery_capacity"] = () => {
    return ["robot.batteryLevel()", Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_robot_level"] = {
    init: function () {
      this.appendDummyInput().appendField("level")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("Rover level, 1 to 5. Higher levels absorb more and carry more")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_robot_level"] = () => {
    return ["robot.roverLevel()", Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }

  Blockly.Blocks["pg_sensing_robot_exp"] = {
    init: function () {
      this.appendDummyInput().appendField("XP")
      this.setOutput(true, "Number")
      this.setColour(SENSING_COLOUR)
      this.setTooltip("XP earned toward the next level, not XP earned overall")
    },
  }
  Blockly.JavaScript.forBlock["pg_sensing_robot_exp"] = () => {
    return ["robot.roverExp()", Blockly.JavaScript.ORDER_FUNCTION_CALL]
  }
}

export const sensingPythonGenerators: PythonGenerators = {
  expressions: {
    pg_sensing_robot_battery_capacity: () => "rover.battery_capacity()",
    pg_sensing_robot_level: () => "rover.level()",
    pg_sensing_robot_exp: () => "rover.exp()",
    pg_sensing_ai_sees: (block, { constant }) => `rover.sees(${constant(block.getFieldValue("KIND"))})`,
    pg_sensing_ai_smells: (block, { constant }) => `rover.detects(${constant(block.getFieldValue("KIND"))})`,
    pg_sensing_ai_sees_direction: (block, { constant }) => `rover.angle(${constant(block.getFieldValue("KIND"))})`,
    pg_sensing_ai_sees_distance: (block, { constant }) =>
      `rover.get_distance(${constant(block.getFieldValue("KIND"))}, ${constant(block.getFieldValue("UNIT"))})`,
    pg_sensing_ai_sees_location: (block, { constant }) =>
      `rover.location(${constant(block.getFieldValue("KIND"))}, ${constant(block.getFieldValue("AXIS"))}, ${constant(block.getFieldValue("UNIT"))})`,
    pg_sensing_distance_found: () => "distance.found_object()",
    pg_sensing_object_distance: (block, { constant }) =>
      `distance.get_distance(${constant(block.getFieldValue("UNIT"))})`,
    pg_sensing_position: (block, { constant }) =>
      `location.position(${constant(block.getFieldValue("AXIS"))}, ${constant(block.getFieldValue("UNIT"))})`,
    pg_sensing_position_angle: () => "location.position_angle(DEGREES)",
  },
}

export const sensingCategory: BlockCategory = {
  id: "sensing",
  label: "Sensing",
  colour: SENSING_COLOUR,
  define: defineRoverSensingBlocks,
  toolbox: [
    { kind: "block", type: "pg_sensing_ai_sees" },
    { kind: "block", type: "pg_sensing_ai_smells" },
    { kind: "block", type: "pg_sensing_ai_sees_direction" },
    { kind: "block", type: "pg_sensing_ai_sees_distance" },
    { kind: "block", type: "pg_sensing_ai_sees_location" },
    { kind: "block", type: "pg_sensing_distance_found" },
    { kind: "block", type: "pg_sensing_object_distance" },
    { kind: "block", type: "pg_sensing_position" },
    { kind: "block", type: "pg_sensing_position_angle" },
    { kind: "block", type: "pg_sensing_robot_battery_capacity" },
    { kind: "block", type: "pg_sensing_robot_level" },
    { kind: "block", type: "pg_sensing_robot_exp" },
  ],
}
