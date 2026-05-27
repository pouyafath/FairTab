import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Prevent better-sqlite3 (native module) from being bundled by the client
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
