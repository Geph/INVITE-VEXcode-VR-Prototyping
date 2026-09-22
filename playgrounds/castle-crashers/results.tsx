"use client"

/** Original stone-frame artwork based on the reference's composition. */
function CastleFrame() {
  return <svg aria-hidden="true" viewBox="0 0 360 300" className="pointer-events-none absolute inset-0 h-full w-full">
    <defs>
      <pattern id="castle-result-stone" width="28" height="18" patternUnits="userSpaceOnUse">
        <rect width="28" height="18" fill="#8c9999" />
        <path d="M0 0H28M0 18H28M14 0V18" stroke="#526266" strokeWidth="2" />
        <path d="M2 3H12M17 3H25" stroke="#c6d3cf" strokeWidth="2" />
      </pattern>
    </defs>
    <path d="M0 300V140H12V124H24V140H36V124H48V140H60V124H72V156H84V300Z M276 300V156H288V124H300V140H312V124H324V140H336V124H348V140H360V300Z"
      fill="url(#castle-result-stone)" stroke="#596b70" strokeWidth="3" />
    <path d="M10 140V80H20V62H30V80H40V62H50V140M310 140V80H320V62H330V80H340V62H350V140"
      fill="url(#castle-result-stone)" stroke="#596b70" strokeWidth="3" />
    <path d="M25 236V190Q35 170 45 190V236M315 236V190Q325 170 335 190V236" fill="#283e46" />
    <path d="M0 285H360V300H0Z" fill="#6d5745" />
  </svg>
}

export function CastleResults({ kg, ms, reason, onRetry }: {
  kg: number; ms: number; reason: string; onRetry: () => void
}) {
  const certificate = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">
      <rect width="1000" height="700" fill="#e3f6f6"/><rect x="25" y="25" width="950" height="650" rx="12" fill="none" stroke="#ba902b" stroke-width="10"/>
      <g text-anchor="middle" font-family="Arial" fill="#244b57"><text x="500" y="155" font-size="52">Castle Crasher+</text>
      <text x="500" y="230" font-size="32">Research Prototype · Certificate of Achievement</text>
      <text x="500" y="330" font-size="40">Way to go!</text><text x="500" y="420" font-size="70" fill="#c52736">${Math.round(kg)} kg cleared</text>
      <text x="500" y="495" font-size="28">Time: ${(ms / 1000).toFixed(1)} seconds</text></g></svg>`
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const link = document.createElement("a")
    link.href = url; link.download = "castle-crasher-certificate.svg"; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="absolute inset-0 z-30 flex items-center justify-center bg-cyan-950/15">
    <section role="dialog" aria-modal="true" aria-label="Castle Crasher results"
      className="relative flex aspect-[6/5] w-[82%] max-w-[360px] flex-col items-center bg-[#58bfce] px-12 pt-5 text-center text-[#203e48] shadow-xl">
      <CastleFrame />
      <div className="relative z-10 flex h-full w-full flex-col items-center">
        <h2 className="text-xl font-bold">Way to go!</h2>
        <p className="mt-2 text-sm">Your Robot cleared</p>
        <strong className="my-2 text-3xl text-red-600">{Math.round(kg)} kg</strong>
        <p className="text-sm">of the Castle!</p>
        <p className="mt-2 text-xs">{reason === "water" ? "Robot fell in the water" : reason === "stopped" ? "Project stopped" : "Project complete"}</p>
        <div className="mb-6 mt-auto flex gap-3 whitespace-nowrap">
          <button type="button" onClick={certificate} className="bg-[#d6a737] px-3 py-2 text-xs font-semibold text-[#302c21] hover:bg-amber-300">Get Certificate</button>
          <button type="button" onClick={onRetry} className="bg-[#d6a737] px-3 py-2 text-xs font-semibold text-[#302c21] hover:bg-amber-300">Try Again</button>
        </div>
      </div>
    </section>
  </div>
}
