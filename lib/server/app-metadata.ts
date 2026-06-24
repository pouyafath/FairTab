import 'server-only'

import packageJson from '@/package.json'
import { getStorageAdapter } from '@/lib/db'

export function getAppMetadata() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    null

  return {
    name: packageJson.name,
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version,
    commit: commit ? commit.slice(0, 12) : null,
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
  }
}

export function getRuntimeMetadata() {
  const backupAuthConfigured = Boolean(process.env.FAIRTAB_BACKUP_TOKEN)
  return {
    storageAdapter: getStorageAdapter(),
    backupAuthConfigured,
    backupAuthWarning:
      process.env.NODE_ENV === 'production' && !backupAuthConfigured
        ? 'FAIRTAB_BACKUP_TOKEN is not configured'
        : null,
  }
}
