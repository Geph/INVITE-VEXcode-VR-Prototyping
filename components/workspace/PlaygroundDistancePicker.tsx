"use client"

import { useCallback, useEffect, useState } from "react"
import { DistanceSliderPicker } from "@/blocks/fields"
import {
  distancePickerTitle,
  drawDistancePickerPreview,
  drivePredictionHint,
  headingFromPreviewPointer,
  pickerMaxDistanceMm,
  predictDrive,
} from "@/hooks/distance-picker-preview"
import type { HostRobotPose } from "@/hooks/program-types"
import type { OceanReefState } from "@/playgrounds/ocean-reef"
import type { RoverRescueState } from "@/playgrounds/rover-rescue"
import type { PlaygroundDefinition } from "@/playgrounds/types"

export function PlaygroundDistancePicker({
  value,
  direction,
  playgroundId,
  playground,
  robot,
  reefState,
  roverState,
  onApply,
  onClose,
}: {
  value: number
  direction: string
  playgroundId: string
  playground: PlaygroundDefinition<any>
  robot: HostRobotPose
  reefState: OceanReefState
  roverState: RoverRescueState
  onApply: (value: number) => void
  onClose: () => void
}) {
  const [headingDeg, setHeadingDeg] = useState(robot.rotation)

  useEffect(() => {
    setHeadingDeg(robot.rotation)
  }, [robot.rotation])

  const onDrawPreview = useCallback(
    (ctx: CanvasRenderingContext2D, distanceMm: number) => {
      drawDistancePickerPreview({
        ctx,
        playgroundId,
        playground,
        reefState,
        roverState,
        robot: { ...robot, rotation: headingDeg },
        direction,
        distanceMm,
      })
    },
    [direction, headingDeg, playground, playgroundId, reefState, robot, roverState],
  )

  const describePrediction = useCallback(
    (candidateMm: number) =>
      drivePredictionHint(
        predictDrive({
          playgroundId,
          robot: { ...robot, rotation: headingDeg },
          direction,
          distanceMm: candidateMm,
          world: playground.world,
          roverState,
        }),
      ),
    [direction, headingDeg, playground.world, playgroundId, robot, roverState],
  )

  const onPreviewPointer = useCallback(
    (x: number, y: number) => {
      const next = headingFromPreviewPointer(playgroundId, robot, { x, y }, playground.world, direction)
      if (next != null) setHeadingDeg(next)
    },
    [direction, playground.world, playgroundId, robot],
  )

  return (
    <DistanceSliderPicker
      value={value}
      maxDistanceMm={pickerMaxDistanceMm(playground.world)}
      title={distancePickerTitle(playground.name, playground.world.widthMm, playground.world.heightMm)}
      headingDeg={headingDeg}
      describePrediction={describePrediction}
      onDrawPreview={onDrawPreview}
      onPreviewPointer={onPreviewPointer}
      onApply={onApply}
      onClose={onClose}
    />
  )
}
