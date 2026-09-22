"use client"

import type React from "react"
import { useMemo } from "react"
import { seededRandom } from "@/lib/robot-runtime"

export function CelebrationOverlay({
  show,
  trashCollected,
}: {
  show: boolean
  trashCollected: number
}) {
  const confettiParticles = useMemo(() => {
    if (!show) return []
    const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8"]
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      style: {
        left: `${50 + (seededRandom(i) - 0.5) * 20}%`,
        top: "-10%",
        width: "10px",
        height: "10px",
        backgroundColor: colors[Math.floor(seededRandom(i + 10) * colors.length)],
        borderRadius: seededRandom(i + 20) > 0.5 ? "50%" : "0%",
        transform: `rotate(${seededRandom(i + 30) * 360}deg)`,
        animationDelay: `${seededRandom(i + 40) * 0.5}s`,
        animationDuration: `${2 + seededRandom(i + 50)}s`,
      } as React.CSSProperties,
    }))
  }, [show])

  if (!show || confettiParticles.length === 0) return null

  return (
    <div id="vex-celebration-overlay" className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      {confettiParticles.map((particle) => (
        <div key={particle.id} className="absolute animate-confetti" style={particle.style} />
      ))}
      {/* Celebration message */}
      <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-500 text-white p-8 rounded-2xl shadow-2xl pointer-events-auto transform animate-bounce-in">
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-4xl font-bold mb-2">Amazing Work!</h2>
          <p className="text-2xl mb-4">You collected {trashCollected} pieces of trash!</p>
          <div className="text-lg opacity-90">Keep up the great work cleaning the ocean!</div>
        </div>
      </div>
    </div>
  )
}
