import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone output: minimal self-contained server for Docker deployment.
  // Also used for Cloudflare Pages (output: 'standalone' is compatible with @cloudflare/next-on-pages).
  output: 'standalone',
  // Prevent better-sqlite3 (native Node.js module) from being bundled by Turbopack.
  // With standalone output, Next.js copies it to .next/standalone/node_modules/ automatically.
  serverExternalPackages: ['better-sqlite3'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
