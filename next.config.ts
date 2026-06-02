import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Type safety is enforced via `tsc --noEmit`; skip ESLint in the build step
  // to avoid the flat-config module-resolution issue from breaking deploys.
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
