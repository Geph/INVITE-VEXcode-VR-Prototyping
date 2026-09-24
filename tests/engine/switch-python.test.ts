import { describe, expect, it } from "vitest"
import { compileSwitchPython } from "@/engine/switch-python"

describe("Switch VEX Python adapter", () => {
  it("executes repeated commands, handles units and wait=False, and safely quotes text", async () => {
    const calls: unknown[][] = []
    const robot = {
      drive: (...args: unknown[]) => { calls.push(args) },
      wait: (seconds: number) => { calls.push(["wait", seconds]) },
      print: (text: string) => { calls.push(["print", text]) },
      setCursorNextRow: () => {},
    }
    const source = 'for i in range(2):\n    drivetrain.drive_for(FORWARD, 2, INCHES, wait=False)\nwait(25, MSEC)\nprint("hello, # world");'
    // Trailing JavaScript punctuation must be rejected, not evaluated.
    expect(() => compileSwitchPython(source)).toThrow("line 4")
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
    await new AsyncFunction("robot", compileSwitchPython(source.slice(0, -1)))(robot)
    expect(calls.filter(c => c[0] === "forward")).toEqual([["forward", 2, "inches", false], ["forward", 2, "inches", false]])
    expect(calls).toContainEqual(["wait", 0.025])
    expect(calls).toContainEqual(["print", "hello, # world"])
  })
  it.each(["import os", "unknown()", "drivetrain.drive_for(FORWARD, 'far', MM)", "wait(foo())", "print(globalThis)", "while True:"])("reports unsupported syntax: %s", source => {
    expect(() => compileSwitchPython(source)).toThrow("Switch Python line 1")
  })
})
