import { COMMON_CATEGORIES, toolboxEntriesFor } from "./registry"
import type { BlockCategory } from "@/playgrounds/types"

/** Headings for playground-owned flyouts; common headings live on COMMON_CATEGORIES. */
const PLAYGROUND_HEADINGS: Record<string, { title: string; subtitle: string }> = {
  magnet: { title: "Magnet", subtitle: "Magnet - Actions" },
  sensing: { title: "Sensing", subtitle: "Sensing - Sensors" },
}

export function categoryHeading(id: string): { title: string; subtitle: string } | undefined {
  return COMMON_CATEGORIES.find((category) => category.id === id)?.heading ?? PLAYGROUND_HEADINGS[id]
}

/** Prepends the VEXcode-style heading pair to a category's flyout contents. */
export function withCategoryHeading(category: string | null, blocks: unknown[]): unknown[] {
  const heading = category ? categoryHeading(category) : undefined
  if (!heading) return blocks
  return [
    { kind: "label", text: heading.title, "web-class": "vex-flyout-title" },
    { kind: "label", text: heading.subtitle, "web-class": "vex-flyout-subtitle" },
    ...blocks,
  ]
}

export function flyoutContents(
  category: string | null,
  playground: { blocks: BlockCategory[] },
): unknown[] {
  if (!category) return []
  return withCategoryHeading(category, toolboxEntriesFor(category, playground))
}
