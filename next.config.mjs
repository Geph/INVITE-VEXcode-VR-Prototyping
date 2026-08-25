import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * GitHub Pages serves project sites from /<repo>, so assets need a prefix.
 * Vercel and `next dev` serve from the root, so the prefix stays empty there.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  // Pages has no server-side rewriter, so emit directory-style URLs.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  devIndicators: false,
}

export default nextConfig
