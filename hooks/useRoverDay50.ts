"use client"

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import {
  concludeDay50,
  continuePastDay50,
  day50Snapshot,
  type Day50Snapshot,
  type RoverRescueState,
  type RoverStatus,
} from "@/playgrounds/rover-rescue"

export function useRoverDay50(
  roverStateRef: { current: RoverRescueState },
  setRoverStatus: Dispatch<SetStateAction<RoverStatus>>,
) {
  const [endView, setEndView] = useState<"stats" | "certificate" | null>(null)
  const [snapshot, setSnapshot] = useState<Day50Snapshot | null>(null)

  const clearEnd = useCallback(() => {
    setEndView(null)
    setSnapshot(null)
  }, [])

  const onContinue = useCallback(() => {
    roverStateRef.current = continuePastDay50(roverStateRef.current)
    setRoverStatus((status) => ({ ...status, day50Dialog: false }))
  }, [roverStateRef, setRoverStatus])

  const onViewStatistics = useCallback(() => {
    setSnapshot(day50Snapshot(roverStateRef.current))
    setEndView("stats")
    roverStateRef.current = concludeDay50(roverStateRef.current)
  }, [roverStateRef])

  const onGetCertificate = useCallback(() => {
    setSnapshot(day50Snapshot(roverStateRef.current))
    setEndView("certificate")
    roverStateRef.current = concludeDay50(roverStateRef.current)
  }, [roverStateRef])

  return useMemo(
    () => ({ endView, snapshot, onContinue, onViewStatistics, onGetCertificate, clearEnd }),
    [endView, snapshot, onContinue, onViewStatistics, onGetCertificate, clearEnd],
  )
}
