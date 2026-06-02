"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { analyzeBlocklyWorkspace, buildCodeReview, type CodeReviewResult } from "@/lib/code-review"
import { Loader2, RefreshCw } from "lucide-react"

const UnitySidebar = dynamic(() => import("@/components/unity-sidebar"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center p-2 text-xs text-slate-400">Loading agent…</div>
  ),
})

const VERDICT_STYLES = {
  excellent: "bg-green-500/20 text-green-300 border-green-500/40",
  good: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  needs_work: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  not_ready: "bg-slate-500/20 text-slate-300 border-slate-500/40",
} as const

type BlocklyWorkspace = Parameters<typeof analyzeBlocklyWorkspace>[0] & {
  addChangeListener: (callback: () => void) => void
  removeChangeListener: (callback: () => void) => void
}

interface UnityAgentPanelProps {
  workspace: BlocklyWorkspace | null
  consoleLines: string[]
  runError: string | null
  isRunning: boolean
}

export default function UnityAgentPanel({
  workspace,
  consoleLines,
  runError,
  isRunning,
}: UnityAgentPanelProps) {
  const [review, setReview] = useState<CodeReviewResult | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [stale, setStale] = useState(false)

  const runReview = useCallback(() => {
    setIsReviewing(true)
    const analysis = analyzeBlocklyWorkspace(workspace)
    const result = buildCodeReview(analysis)
    setReview(result)
    setStale(false)
    setIsReviewing(false)
  }, [workspace])

  useEffect(() => {
    if (!workspace) return
    const onChange = () => setStale(true)
    workspace.addChangeListener(onChange)
    return () => workspace.removeChangeListener(onChange)
  }, [workspace])

  useEffect(() => {
    if (workspace && !review) {
      runReview()
    }
  }, [workspace, review, runReview])

  return (
    <div id="vex-unity-agent-panel" className="flex h-full w-full flex-col bg-slate-950">
      <div id="vex-unity-agent-visual" className="h-[38%] min-h-[120px] shrink-0 border-b border-gray-700">
        <UnitySidebar />
      </div>

      <div id="vex-unity-agent-review" className="flex min-h-0 flex-1 flex-col">
        <div
          id="vex-unity-agent-review-toolbar"
          className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-700 px-3 py-2"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Code review</span>
          <Button
            id="vex-btn-review-code"
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 bg-slate-700 text-white hover:bg-slate-600 border-0 text-xs"
            onClick={runReview}
            disabled={isReviewing || !workspace}
          >
            {isReviewing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Review my code
          </Button>
        </div>

        <div id="vex-unity-agent-review-body" className="min-h-0 flex-1 overflow-y-auto p-3 text-sm text-slate-200">
          <div id="vex-unity-agent-console" className="mb-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Program output
            </h4>
            <p className="mb-2 text-xs text-slate-500">
              Text from <span className="text-slate-400">print</span> blocks appears here after you press START.
              Also shown on the Ocean Reef Cleanup window while it is open.
            </p>
            <div
              id="vex-unity-agent-console-log"
              className="max-h-28 min-h-[3rem] overflow-y-auto rounded-md border border-gray-700 bg-black/50 px-2 py-1.5 font-mono text-[11px] text-green-300"
              aria-live="polite"
            >
              {runError && (
                <div className="mb-1 text-red-300">Error: {runError}</div>
              )}
              {consoleLines.length === 0 && !runError && (
                <span className="text-slate-500">
                  {isRunning ? "Running…" : "No output yet."}
                </span>
              )}
              {consoleLines.map((line, i) => (
                <div key={`${i}-${line}`}>{line || "\u00a0"}</div>
              ))}
            </div>
          </div>

          {!workspace && (
            <p className="text-slate-400">Waiting for the Blockly workspace to load…</p>
          )}

          {workspace && !review && isReviewing && (
            <p className="text-slate-400">Reading your blocks…</p>
          )}

          {review && (
            <div className="space-y-3">
              {stale && (
                <p
                  id="vex-unity-review-stale-hint"
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200"
                >
                  Your blocks changed — tap Review my code for an updated opinion.
                </p>
              )}

              <div
                id="vex-unity-review-verdict"
                className={`rounded-lg border px-3 py-2 ${VERDICT_STYLES[review.verdict]}`}
              >
                <p className="text-xs font-medium uppercase opacity-80">Verdict · {review.score}/100</p>
                <p className="font-semibold">{review.headline}</p>
              </div>

              <p id="vex-unity-review-summary">{review.summary}</p>

              <div id="vex-unity-review-criteria">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  How I decided
                </h4>
                <ul className="space-y-2">
                  {review.criteria.map((c) => (
                    <li
                      key={c.id}
                      id={`vex-unity-criterion-${c.id}`}
                      className={`rounded-md border px-2 py-1.5 text-xs ${
                        c.passed
                          ? "border-green-500/30 bg-green-500/5 text-slate-200"
                          : "border-amber-500/30 bg-amber-500/5 text-slate-300"
                      }`}
                    >
                      <span className="font-medium">{c.passed ? "✓" : "○"} {c.label}</span>
                      <span className="mt-0.5 block text-slate-400">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {review.suggestions.length > 0 && (
                <div id="vex-unity-review-suggestions">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Try next
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300">
                    {review.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
