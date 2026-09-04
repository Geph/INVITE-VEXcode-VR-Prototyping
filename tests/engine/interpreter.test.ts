import { describe, expect, it, vi } from "vitest"
import { EventHatRegistry, ProgramStopped, compileProgram, runProgram } from "@/engine/interpreter"

describe("runProgram / ProgramStopped", () => {
  it("runs compiled bodies against the robot API", async () => {
    const robot = { seen: 0, bump() { this.seen += 1 } }
    await runProgram("robot.bump()", robot)
    expect(robot.seen).toBe(1)
    const fn = compileProgram("robot.bump()")
    await fn(robot)
    expect(robot.seen).toBe(2)
  })

  it("swallows ProgramStopped and rethrows other errors", async () => {
    await expect(runProgram("throw new Error('boom')", {})).rejects.toThrow("boom")
    const robot = {
      stop() {
        throw new ProgramStopped()
      },
    }
    await expect(runProgram("robot.stop()", robot)).resolves.toBeUndefined()
  })
})

describe("EventHatRegistry", () => {
  it("fires a rising edge once and will not re-enter a busy handler", async () => {
    let pressed = false
    let runs = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const registry = new EventHatRegistry()
    registry.register({
      id: "bumper",
      predicate: () => pressed,
      body: async () => {
        runs += 1
        await gate
      },
    })
    registry.poll({})
    expect(runs).toBe(0)
    pressed = true
    registry.poll({})
    registry.poll({})
    expect(runs).toBe(1)
    expect(registry.busy).toBe(true)
    release()
    await gate
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(registry.busy).toBe(false)
  })

  it("supports falling and level edges, stop/resume, and error reporting", async () => {
    const errors: string[] = []
    let flag = true
    const falling = new EventHatRegistry()
    let fell = 0
    falling.register({
      id: "release",
      predicate: () => flag,
      edge: "falling",
      body: async () => {
        fell += 1
      },
    })
    falling.poll({})
    flag = false
    falling.poll({})
    await Promise.resolve()
    expect(fell).toBe(1)

    let ticks = 0
    const level = new EventHatRegistry([
      {
        id: "hot",
        predicate: () => true,
        edge: "level",
        body: async () => {
          ticks += 1
        },
      },
    ])
    level.poll({})
    await new Promise((resolve) => setTimeout(resolve, 0))
    level.poll({})
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ticks).toBe(2)

    const noisy = new EventHatRegistry()
      .onHandlerError((error, id) => errors.push(`${id}:${error instanceof Error ? error.message : "x"}`))
    noisy.register({
      id: "boom",
      predicate: () => true,
      body: async () => {
        throw new Error("nope")
      },
    })
    noisy.poll({})
    await Promise.resolve()
    expect(errors[0]).toBe("boom:nope")

    const stopped = new EventHatRegistry()
    let extra = 0
    stopped.register({
      id: "quiet",
      predicate: () => true,
      body: async () => {
        extra += 1
      },
    })
    stopped.stop()
    stopped.poll({})
    expect(extra).toBe(0)
    stopped.resume()
    stopped.poll({})
    await Promise.resolve()
    expect(extra).toBe(1)
    stopped.clear()
    stopped.poll({})
    await Promise.resolve()
    expect(extra).toBe(1)

    const swallow = new EventHatRegistry()
    swallow.register({
      id: "halt",
      predicate: () => true,
      body: async () => {
        throw new ProgramStopped()
      },
    })
    const spy = vi.fn()
    swallow.onHandlerError(spy)
    swallow.poll({})
    await Promise.resolve()
    expect(spy).not.toHaveBeenCalled()
  })
})
