import { describe, expect, it } from "vitest"
import { oceanReef } from "@/playgrounds/ocean-reef"

const KEYS = [
  "trash_collected",
  "coral_damaged",
  "battery_remaining",
  "project_stopped_by_user",
  "gps_x_position",
  "gps_y_position",
] as const

describe("Ocean Reef outcomeParameters", () => {
  it("returns exactly the six documented keys", () => {
    expect(oceanReef.outcomeParameters).toBeTypeOf("function")
    const params = oceanReef.outcomeParameters!(oceanReef.createState(1))
    expect(Object.keys(params).sort()).toEqual([...KEYS].sort())
  })
})
