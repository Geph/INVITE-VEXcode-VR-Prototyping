import { describe, expect, it } from "vitest"
import { generatePythonProgram } from "@/lib/python-generator"
import type { PyBlock } from "@/blocks/generators/python-types"

function block(
  type: string,
  options: { fields?: Record<string, string>; inputs?: Record<string, PyBlock | null>; next?: PyBlock | null } = {},
): PyBlock {
  const node: PyBlock = {
    type,
    getFieldValue(name) {
      return options.fields?.[name] ?? ""
    },
    getInputTargetBlock(name) {
      return options.inputs?.[name] ?? null
    },
    getNextBlock() {
      return options.next ?? null
    },
  }
  return node
}

function workspace(...blocks: PyBlock[]) {
  return { getAllBlocks: () => blocks }
}

const HEADER = "# VEXcode VR Python\nfrom vexcode import *\nimport math\nimport random\n\n"

describe("generatePythonProgram characterisation", () => {
  it("emits the empty stub when there is no when_started hat", () => {
    expect(generatePythonProgram(null)).toBe(
      "# No code yet\n# Add blocks under when started to see Python code",
    )
    expect(generatePythonProgram(workspace(block("drive_distance")))).toBe(
      "# No code yet\n# Add blocks under when started to see Python code",
    )
  })

  it("emits pass for a bare when_started hat", () => {
    expect(generatePythonProgram(workspace(block("when_started")))).toBe(
      `${HEADER}def main():\n    pass\n\nvr_thread(main)\n`,
    )
  })

  it("emits one statement from each common category plus Ocean Reef sensing", () => {
    const stack = block("when_started", {
      next: block("drive_distance", {
        fields: { DIRECTION: "forward", DISTANCE: "200", UNIT: "mm" },
        next: block("wait_seconds", {
          fields: { SECONDS: "1" },
          next: block("if_then", {
            inputs: {
              CONDITION: block("compare", {
                fields: { OP: "EQ" },
                inputs: {
                  A: block("math_number", { fields: { NUM: "1" } }),
                  B: block("math_number", { fields: { NUM: "1" } }),
                },
              }),
              DO: block("set_pen_width", {
                fields: { WIDTH: "medium" },
                next: block("print_text", {
                  inputs: { TEXT: block("text_string", { fields: { TEXT: "hi" } }) },
                }),
              }),
            },
            next: block("energize_magnet", {
              fields: { DEVICE: "magnet", MODE: "boost" },
            }),
          }),
        }),
      }),
    })
    expect(generatePythonProgram(workspace(stack))).toBe(
      `${HEADER}def main():\n` +
        `    drivetrain.drive_for(FORWARD, 200, MM)\n` +
        `    wait(1, SECONDS)\n` +
        `    if (1 == 1):\n` +
        `        pen.set_pen_width(MEDIUM)\n` +
        `        brain.print("hi")\n` +
        `    magnet.energize(BOOST)\n` +
        `\nvr_thread(main)\n`,
    )
  })

  it("emits Python for all eight Rover Rescue sensing blocks and drive_is_done", () => {
    const stack = block("when_started", {
      next: block("if_then", {
        inputs: {
          CONDITION: block("boolean_and", {
            inputs: {
              A: block("rover_sees", { fields: { KIND: "minerals" } }),
              B: block("rover_detects", { fields: { KIND: "enemy" } }),
            },
          }),
          DO: block("print_text", {
            inputs: {
              TEXT: block("rover_distance", { fields: { KIND: "base", UNIT: "mm" } }),
            },
            next: block("print_text", {
              inputs: {
                TEXT: block("rover_direction", { fields: { KIND: "minerals" } }),
              },
              next: block("print_text", {
                inputs: {
                  TEXT: block("rover_location", { fields: { KIND: "enemy", AXIS: "X", UNIT: "mm" } }),
                },
                next: block("print_text", {
                  inputs: { TEXT: block("rover_distance_found_object") },
                  next: block("print_text", {
                    inputs: { TEXT: block("rover_object_distance", { fields: { UNIT: "mm" } }) },
                    next: block("print_text", {
                      inputs: { TEXT: block("drive_is_done") },
                    }),
                  }),
                }),
              }),
            }),
          }),
        },
      }),
    })
    expect(generatePythonProgram(workspace(stack))).toBe(
      `${HEADER}def main():\n` +
        `    if (rover.sees(MINERALS) and rover.detects(ENEMY)):\n` +
        `        brain.print(rover.get_distance(BASE, MM))\n` +
        `        brain.print(rover.angle(MINERALS))\n` +
        `        brain.print(rover.location(ENEMY, X, MM))\n` +
        `        brain.print(distance.found_object())\n` +
        `        brain.print(distance.get_distance(MM))\n` +
        `        brain.print(drivetrain.is_done())\n` +
        `\nvr_thread(main)\n`,
    )
  })

  it("emits a bumper hat alongside the main thread", () => {
    const whenStarted = block("when_started", {
      next: block("stop_driving"),
    })
    const bumper = block("when_bumper", {
      fields: { BUMPER: "left", STATE: "pressed" },
      inputs: { DO: block("turn_simple", { fields: { DIRECTION: "right" } }) },
    })
    expect(generatePythonProgram(workspace(whenStarted, bumper))).toBe(
      `${HEADER}def when_left_bumper_pressed_1():\n` +
        `    drivetrain.turn(RIGHT)\n` +
        `\ndef main():\n` +
        `    drivetrain.stop()\n` +
        `\nvr_thread(when_left_bumper_pressed_1)\n` +
        `vr_thread(main)\n`,
    )
  })

  it("emits operators that the rename later remaps (and/or/not/random)", () => {
    const stack = block("when_started", {
      next: block("if_then", {
        inputs: {
          CONDITION: block("boolean_not", {
            inputs: {
              BOOL: block("boolean_or", {
                inputs: {
                  A: block("random_int", { fields: { FROM: "1", TO: "4" } }),
                  B: block("bumper_pressed", { fields: { BUMPER: "left" } }),
                },
              }),
            },
          }),
          DO: block("forever", { inputs: { DO: block("wait", { inputs: { SECONDS: block("math_number", { fields: { NUM: "1" } }) } }) } }),
        },
      }),
    })
    expect(generatePythonProgram(workspace(stack))).toBe(
      `${HEADER}def main():\n` +
        `    if (not (random.randint(1, 4) or left_bumper.pressed())):\n` +
        `        while True:\n` +
        `            wait(1, SECONDS)\n` +
        `\nvr_thread(main)\n`,
    )
  })
})
