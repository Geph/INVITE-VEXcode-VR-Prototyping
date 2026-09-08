import { describe, expect, it } from "vitest"
import { COMMON_CATEGORIES } from "@/blocks/registry"
import { flyoutContents } from "@/blocks/toolbox"
import { RAIL_CATEGORIES } from "@/components/workspace/CategoryRail"
import { oceanReef } from "@/playgrounds/ocean-reef"

describe("toolbox smoke", () => {
  it("builds a flyout for every rail category", () => {
    for (const category of RAIL_CATEGORIES) {
      const contents = flyoutContents(category.id, oceanReef)
      expect(contents.length, category.id).toBeGreaterThan(2)
      const types = contents
        .map((entry) => (entry as { type?: string }).type)
        .filter((type): type is string => Boolean(type))
      expect(types.length, category.id).toBeGreaterThan(0)
    }
  })

  it("includes every common category plus playground magnet and sensing", () => {
    const ids = [
      ...COMMON_CATEGORIES.map((category) => category.id),
      ...oceanReef.blocks.map((category) => category.id),
    ]
    expect(ids).toEqual(expect.arrayContaining(["drivetrain", "operators", "logic", "drawing", "console", "loops", "variables", "magnet", "sensing"]))
  })
})
