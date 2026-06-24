import 'server-only'

import { nanoid } from 'nanoid'
import { getDb } from '@/lib/db'
import { createDrizzleRepositories } from '@/lib/backend/repositories/drizzle'
import { createBackendServices } from '@/lib/backend/services'
import type { BackendServices } from '@/lib/backend/services'

// Cached for Node.js runtimes (local dev + Docker). On Cloudflare Pages the D1
// binding is per-request so we must create a fresh instance each time.
let _backend: BackendServices | null = null
let _backendForTesting: BackendServices | null = null

export function setBackendForTesting(backend: BackendServices | null) {
  _backendForTesting = backend
}

export function getBackend(): BackendServices {
  if (_backendForTesting) return _backendForTesting

  const cfCtx = (globalThis as any)[Symbol.for('__cloudflare-request-context__')] as // eslint-disable-line @typescript-eslint/no-explicit-any
    | { env?: { DB?: unknown } }
    | undefined

  if (cfCtx?.env?.DB) {
    return createBackendServices({
      repositories: createDrizzleRepositories(getDb()),
      createId: () => nanoid(8),
      now: () => new Date(),
    })
  }

  if (!_backend) {
    _backend = createBackendServices({
      repositories: createDrizzleRepositories(getDb()),
      createId: () => nanoid(8),
      now: () => new Date(),
    })
  }
  return _backend
}
