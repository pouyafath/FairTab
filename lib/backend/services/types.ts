import type { AppRepositories } from '@/lib/backend/ports'

export interface BackendServiceDeps {
  repositories: AppRepositories
  createId: () => string
  now: () => Date
}
