"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Calculator,
  Cog,
  Eye,
  Gem,
  GitBranch,
  Magnet,
  Pencil,
  Terminal,
  ToggleLeft,
  Variable,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { COMMON_CATEGORIES } from "@/blocks/registry"

export interface RailCategory {
  id: string
  label: string
  buttonId: string
  selectedClass: string
  idleClass: string
  Icon: LucideIcon
}

export const RAIL_CATEGORIES: RailCategory[] = [
  {
    id: "drivetrain",
    label: "Drivetrain",
    buttonId: "vex-category-drivetrain",
    selectedClass: "bg-[#4A90E2] text-white",
    idleClass: "bg-[#4A90E2]/20 text-[#4A90E2] hover:bg-[#4A90E2]/30",
    Icon: Cog,
  },
  {
    id: "operators",
    label: "Operators",
    buttonId: "vex-category-operators",
    selectedClass: "bg-[#4CAF50] text-white",
    idleClass: "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30",
    Icon: Calculator,
  },
  {
    id: "logic",
    label: "Logic",
    buttonId: "vex-category-logic",
    selectedClass: "bg-[#F5A623] text-white",
    idleClass: "bg-[#F5A623]/20 text-[#F5A623] hover:bg-[#F5A623]/30",
    Icon: GitBranch,
  },
  {
    id: "magnet",
    label: "Magnet",
    buttonId: "vex-category-magnet",
    selectedClass: "bg-[#9B59B6] text-white",
    idleClass: "bg-[#9B59B6]/20 text-[#9B59B6] hover:bg-[#9B59B6]/30",
    Icon: Magnet,
  },
  {
    id: "resources",
    label: "Resources",
    buttonId: "vex-category-resources",
    selectedClass: "bg-[#C0392B] text-white",
    idleClass: "bg-[#C0392B]/20 text-[#C0392B] hover:bg-[#C0392B]/30",
    Icon: Gem,
  },
  {
    id: "drawing",
    label: "Drawing",
    buttonId: "vex-category-drawing",
    selectedClass: "bg-[#E67E22] text-white",
    idleClass: "bg-[#E67E22]/20 text-[#E67E22] hover:bg-[#E67E22]/30",
    Icon: Pencil,
  },
  {
    id: "sensing",
    label: "Sensing",
    buttonId: "vex-category-sensing",
    selectedClass: "bg-[#14B8A6] text-white",
    idleClass: "bg-[#14B8A6]/20 text-[#14B8A6] hover:bg-[#14B8A6]/30",
    Icon: Eye,
  },
  {
    id: "console",
    label: "Console",
    buttonId: "vex-category-console",
    selectedClass: "bg-[#7F8C8D] text-white",
    idleClass: "bg-[#7F8C8D]/20 text-[#7F8C8D] hover:bg-[#7F8C8D]/30",
    Icon: Terminal,
  },
  {
    id: "loops",
    label: "Switch",
    buttonId: "vex-category-switch",
    selectedClass: "bg-[#2ECC71] text-white",
    idleClass: "bg-[#2ECC71]/20 text-[#2ECC71] hover:bg-[#2ECC71]/30",
    Icon: ToggleLeft,
  },
  {
    id: "variables",
    label: "Variables",
    buttonId: "vex-category-variables",
    selectedClass: "bg-[#FF8C1A] text-white",
    idleClass: "bg-[#FF8C1A]/20 text-[#FF8C1A] hover:bg-[#FF8C1A]/30",
    Icon: Variable,
  },
]

const COMMON_RAIL_IDS = new Set(COMMON_CATEGORIES.map((category) => category.id))

/**
 * Magnet belongs to Ocean Reef and Resources to Rover Rescue, so the rail shows
 * a playground-owned category only where its blocks exist. An empty flyout
 * reads as a broken toolbox.
 */
export function railCategoriesFor(playground: { blocks: Array<{ id: string }> }): RailCategory[] {
  const provided = new Set(playground.blocks.map((category) => category.id))
  return RAIL_CATEGORIES.filter((category) => COMMON_RAIL_IDS.has(category.id) || provided.has(category.id))
}

export function CategoryRail({
  selectedCategory,
  onSelectCategory,
  categories = RAIL_CATEGORIES,
  footer,
}: {
  selectedCategory: string | null
  onSelectCategory: (category: string) => void
  categories?: RailCategory[]
  footer?: ReactNode
}) {
  return (
    <div id="vex-category-sidebar" className="w-20 border-r flex flex-col items-center py-4 gap-1 relative">
      {categories.map(({ id, label, buttonId, selectedClass, idleClass, Icon }) => (
        <Button
          key={id}
          id={buttonId}
          variant="ghost"
          className={`w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
            selectedCategory === id ? selectedClass : idleClass
          }`}
          onClick={() => onSelectCategory(id)}
        >
          <Icon className="h-6 w-6" />
          <span className="text-[10px] font-medium">{label}</span>
        </Button>
      ))}
      <div className="flex-1" />
      {footer}
    </div>
  )
}
