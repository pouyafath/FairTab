import 'server-only'

import { nanoid } from 'nanoid'
import { getDb } from '@/lib/db'
import { createDrizzleRepositories } from '@/lib/backend/repositories/drizzle'
import { createBackendServices } from '@/lib/backend/services'

export function getBackend() {
  return createBackendServices({
    repositories: createDrizzleRepositories(getDb()),
    createId: () => nanoid(8),
    now: () => new Date(),
  })
}
