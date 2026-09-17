import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CategoryRail, RAIL_CATEGORIES, railCategoriesFor } from "@/components/workspace/CategoryRail"
import { oceanReef } from "@/playgrounds/ocean-reef"
import { roverRescue } from "@/playgrounds/rover-rescue"

describe("Blockly editor smoke", () => {
  it("mounts the category rail", () => {
    const html = renderToStaticMarkup(
      createElement(CategoryRail, {
        selectedCategory: "drivetrain",
        onSelectCategory: () => {},
      }),
    )
    expect(html).toContain("vex-category-sidebar")
    expect(html).toContain("vex-category-drivetrain")
  })

  it("renders every toolbox category on the rail", () => {
    const html = renderToStaticMarkup(
      createElement(CategoryRail, {
        selectedCategory: "drivetrain",
        onSelectCategory: () => {},
      }),
    )
    for (const category of RAIL_CATEGORIES) {
      expect(html).toContain(`id="${category.buttonId}"`)
      expect(html).toContain(category.label)
    }
    expect(RAIL_CATEGORIES.map((category) => category.id)).toEqual([
      "drivetrain",
      "operators",
      "logic",
      "magnet",
      "resources",
      "drawing",
      "sensing",
      "console",
      "loops",
      "variables",
    ])
  })

  /**
   * Magnet is Ocean Reef's and Resources is Rover Rescue's, so the rail is built
   * per playground. Showing a category whose flyout would be empty reads as a
   * broken toolbox.
   */
  it("shows a playground-owned category only where its blocks exist", () => {
    const reefIds = railCategoriesFor(oceanReef).map((category) => category.id)
    expect(reefIds).toContain("magnet")
    expect(reefIds).not.toContain("resources")

    const roverIds = railCategoriesFor(roverRescue).map((category) => category.id)
    expect(roverIds).toContain("resources")
    expect(roverIds).not.toContain("magnet")

    // Common categories are on every rail.
    for (const ids of [reefIds, roverIds]) {
      expect(ids).toEqual(expect.arrayContaining(["drivetrain", "operators", "logic", "sensing", "variables"]))
    }
  })
})
