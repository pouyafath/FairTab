import type { AppRepositories } from '@/lib/backend/ports'
import type { StoragePort } from '@/lib/backend/storage-port'

export interface BackendServiceDeps {
  repositories: AppRepositories
  createId: () => string
  now: () => Date
  storage: StoragePort
}
