"use client"

import type React from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  Eye,
  FileDiff,
  Frown,
  Gauge,
  GitCompare,
  Heart,
  HelpCircle,
  Lightbulb,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sparkles,
  StopCircle,
  Target,
  Users,
  Wrench,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SurveyStep } from "./types"

export function OptionTree({
  aiStep,
  setAiStep,
  predictCanvasRef,
  drawPrediction,
}: {
  aiStep: SurveyStep
  setAiStep: (step: SurveyStep) => void
  predictCanvasRef: React.RefObject<HTMLCanvasElement | null>
  drawPrediction: () => void
}) {
  return (
    <>
              {aiStep === "main" ? (
                <div id="vex-ai-assistant-menu" className="text-gray-700">
                  <p className="mb-4 font-medium text-base">What sort of help do you want?</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0"
                      onClick={() => setAiStep("strategy")}
                    >
                      <Lightbulb className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Come up with a strategy</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white border-0"
                      onClick={() => {
                        console.log("[v0] Navigate to predict")
                        setAiStep("predict")
                      }}
                    >
                      <Target className="mr-3 h-5 w-5" />
                      <span className="mr-2">2.</span> Predict and Plan
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0"
                      onClick={() => setAiStep("fix")}
                    >
                      <Wrench className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Fix something that&apos;s not working</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0"
                      onClick={() => setAiStep("compare")}
                    >
                      <GitCompare className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Compare to a previous attempt</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0"
                      onClick={() => setAiStep("feel")}
                    >
                      <Heart className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">5.</span>
                      <span>Tell me how you feel</span>
                    </Button>
                    <Button
                      className="justify-start text-left h-auto py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white border-0"
                      onClick={() => setAiStep("partner")}
                    >
                      <Users className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">6.</span>
                      <span>Work with a partner</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "strategy" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-blue-600 hover:text-blue-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What strategy would you like help with?</p>
                  <div className="flex flex-col gap-2">
                    <Button 
                      className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0"
                      onClick={() => setAiStep("strategy-examples")}
                    >
                      <Zap className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Move faster (efficiently)</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <RotateCcw className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Turn around at the edge</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Search className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Find more blocks that could help you</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "strategy-examples" ? (
                <div className="text-gray-700 text-sm">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-blue-600 hover:text-blue-800 -ml-2"
                    onClick={() => setAiStep("strategy")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-3 font-medium text-base">Two approaches to move efficiently:</p>
                  
                  {/* Approach 1 */}
                  <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="font-semibold text-blue-900 mb-2">Approach 1: Increase Velocity</p>
                    <p className="text-xs text-gray-600 mb-2">Set drive velocity to 100 at the start, then drive forward.</p>
                    <div className="bg-white p-2 rounded border border-blue-200 mb-2 font-mono text-xs">
                      <div className="text-blue-700">when started</div>
                      <div className="ml-4 text-green-700">set drive_velocity to 100</div>
                      <div className="ml-4 text-purple-700">drive forward 500 mm</div>
                    </div>
                    <p className="text-xs text-gray-700"><span className="font-semibold">Why:</span> Higher velocity = faster movement. This approach is simple and direct.</p>
                  </div>

                  {/* Approach 2 */}
                  <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                    <p className="font-semibold text-green-900 mb-2">Approach 2: Add Loop for Continuous Movement</p>
                    <p className="text-xs text-gray-600 mb-2">Use a forever loop to keep collecting trash continuously without stopping.</p>
                    <div className="bg-white p-2 rounded border border-green-200 mb-2 font-mono text-xs">
                      <div className="text-blue-700">when started</div>
                      <div className="ml-4 text-purple-700">forever</div>
                      <div className="ml-8 text-green-700">drive forward 300 mm</div>
                      <div className="ml-8 text-blue-700">turn right 90 degrees</div>
                    </div>
                    <p className="text-xs text-gray-700"><span className="font-semibold">Why:</span> Loops allow the robot to patrol continuously, covering more area and collecting more trash automatically.</p>
                  </div>

                  {/* Comparison */}
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded">
                    <p className="font-semibold text-gray-900 mb-2">Comparison:</p>
                    <div className="text-xs space-y-1">
                      <div><span className="font-semibold text-blue-700">Approach 1:</span> Best for collecting one area quickly. Limited trash collection.</div>
                      <div><span className="font-semibold text-green-700">Approach 2:</span> Best for collecting more trash over time. Continuously patrols the area.</div>
                      <div className="mt-2 text-gray-600">Try both approaches and see which gets you more trash!</div>
                    </div>
                  </div>
                </div>
              ) : aiStep === "predict" ? (
                <div className="space-y-4">
                  <Button variant="outline" onClick={() => setAiStep("main")} className="mb-2">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <p className="text-purple-600 font-semibold">Predict and Plan - Preview your robot&apos;s path:</p>
                  <div className="border-4 border-purple-300 rounded-lg overflow-hidden">
                    <canvas id="vex-ai-predict-canvas" ref={predictCanvasRef} width={300} height={300} className="w-full" />
                  </div>
                  <Button
                    onClick={() => {
                      console.log("[v0] Show Prediction clicked")
                      drawPrediction()
                    }}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Show Prediction
                  </Button>
                </div>
              ) : aiStep === "fix" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-red-600 hover:text-red-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What's not working?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <StopCircle className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Robot isn't moving</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <ArrowLeftRight className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Robot moves the wrong direction</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <Eye className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Sensors aren't detecting anything</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-red-500 hover:bg-red-600 text-white border-0">
                      <RefreshCw className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Loop doesn't stop</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "compare" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-green-600 hover:text-green-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">What would you like to compare?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0">
                      <Gauge className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Compare speed of different attempts</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0">
                      <Target className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Compare accuracy of movements</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-green-500 hover:bg-green-600 text-white border-0">
                      <FileDiff className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>See what changed between versions</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "feel" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-orange-600 hover:text-orange-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">How are you feeling?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <Frown className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Frustrated - nothing is working</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <HelpCircle className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Stuck - not sure what to try next</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <Sparkles className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Curious - want to learn more</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white border-0">
                      <PartyPopper className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">4.</span>
                      <span>Excited - making progress!</span>
                    </Button>
                  </div>
                </div>
              ) : aiStep === "partner" ? (
                <div className="text-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-3 text-blue-600 hover:text-blue-800 -ml-2"
                    onClick={() => setAiStep("main")}
                  >
                    ← Back
                  </Button>
                  <p className="mb-4 font-medium text-base">How would you like to collaborate?</p>
                  <div className="flex flex-col gap-2">
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Share2 className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">1.</span>
                      <span>Share my code with a partner</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <GitCompare className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">2.</span>
                      <span>Compare our solutions</span>
                    </Button>
                    <Button className="justify-start text-left h-auto py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white border-0">
                      <Users className="w-5 h-5 mr-3 text-white" />
                      <span className="mr-2 font-semibold">3.</span>
                      <span>Work together on one robot</span>
                    </Button>
                  </div>
                </div>
              ) : null}
    </>
  )
}
