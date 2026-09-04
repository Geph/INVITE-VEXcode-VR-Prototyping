import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CategoryRail, RAIL_CATEGORIES } from "@/components/workspace/CategoryRail"

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
      "drawing",
      "sensing",
      "console",
      "loops",
    ])
  })
})
