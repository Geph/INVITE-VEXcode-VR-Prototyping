import { describe, expect, it } from "vitest"
import { COMMON_CATEGORIES } from "@/blocks/registry"
import { flyoutContents } from "@/blocks/toolbox"
import { railCategoriesFor } from "@/components/workspace/CategoryRail"
import { oceanReef } from "@/playgrounds/ocean-reef"
import { roverRescue } from "@/playgrounds/rover-rescue"

describe("toolbox smoke", () => {
  it("builds a non-empty flyout for every category on each playground's rail", () => {
    for (const playground of [oceanReef, roverRescue]) {
      for (const category of railCategoriesFor(playground)) {
        const contents = flyoutContents(category.id, playground)
        const label = `${playground.id}/${category.id}`
        expect(contents.length, label).toBeGreaterThan(2)
        const types = contents
          .map((entry) => (entry as { type?: string }).type)
          .filter((type): type is string => Boolean(type))
        expect(types.length, label).toBeGreaterThan(0)
      }
    }
  })

  it("keeps a heading on the new Resources flyout", () => {
    const contents = flyoutContents("resources", roverRescue)
    expect(contents[0]).toMatchObject({ kind: "label", text: "Resources" })
    expect(contents.some((entry) => (entry as { type?: string }).type === "pg_actions_interact_with_minerals")).toBe(
      true,
    )
    expect(contents.some((entry) => (entry as { type?: string }).type === "pg_actions_standby")).toBe(true)
    expect(contents.some((entry) => (entry as { type?: string }).type === "pg_actions_interact_with_enemy")).toBe(true)
    expect(contents.some((entry) => (entry as { type?: string }).type === "pg_events_when_under_attack")).toBe(true)
    expect(contents.some((entry) => (entry as { type?: string }).type === "pg_events_when_level_up")).toBe(true)
  })

  it("puts minerals in storage and storage capacity on the Sensing flyout", () => {
    const types = flyoutContents("sensing", roverRescue)
      .map((entry) => (entry as { type?: string }).type)
      .filter((type): type is string => Boolean(type))
    expect(types).toEqual(expect.arrayContaining([
      "pg_sensing_robot_minerals_stored",
      "pg_sensing_robot_minerals_capacity",
      "pg_sensing_under_attack",
      "pg_sensing_enemy_level",
      "pg_sensing_enemy_charge",
    ]))
  })

  it("includes every common category plus playground magnet and sensing", () => {
    const ids = [
      ...COMMON_CATEGORIES.map((category) => category.id),
      ...oceanReef.blocks.map((category) => category.id),
    ]
    expect(ids).toEqual(expect.arrayContaining(["drivetrain", "operators", "logic", "drawing", "console", "loops", "variables", "magnet", "sensing"]))
  })
})
