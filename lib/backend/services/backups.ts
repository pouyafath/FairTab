import { getAppMetadata } from '@/lib/server/app-metadata'
import { createBackupFile, parseBackupFile, validateBackupFile } from '@/lib/backups/service'
import type { BackupService } from '@/lib/backend/ports'
import type { BackupRestoreMode, BackupValidationResult } from '@/lib/backups/types'
import { REPLACE_BACKUP_CONFIRMATION } from '@/lib/backups/types'
import type { BackendServiceDeps } from './types'

function isEmptySummary(summary: BackupValidationResult['summary']): boolean {
  return Object.values(summary).every((count) => count === 0)
}

function restoreError(input: {
  mode: BackupRestoreMode
  error: string
  validation: BackupValidationResult
}) {
  return {
    restored: false,
    mode: input.mode,
    restoredAt: null,
    summary: input.validation.summary,
    validation: input.validation,
    error: input.error,
  }
}

export function createBackupService({ repositories, now }: BackendServiceDeps): BackupService {
  return {
    async createBackup() {
      const data = await repositories.backups.readSnapshot()
      const backup = createBackupFile({
        data,
        exportedAt: now(),
        app: getAppMetadata(),
      })
      console.info('[fairtab] backup export created', {
        exportedAt: backup.exportedAt,
        rowCounts: backup.rowCounts,
      })
      return backup
    },

    async validateBackup(payload: unknown) {
      const currentData = await repositories.backups.readSnapshot()
      const validation = validateBackupFile(payload, currentData, { now: now() })
      console.info('[fairtab] backup restore dry-run', {
        valid: validation.valid,
        canRestore: validation.canRestore,
        conflicts: validation.conflicts.length,
        errors: validation.errors.length,
        summary: validation.summary,
      })
      return validation
    },

    async restoreBackup(payload, options) {
      const parsed = parseBackupFile(payload)
      if (!parsed.success) {
        console.warn('[fairtab] backup restore blocked: invalid payload', {
          mode: options.mode,
          errors: parsed.validation.errors.length,
        })
        return restoreError({
          mode: options.mode,
          error: 'Backup file is invalid.',
          validation: parsed.validation,
        })
      }

      const currentData = await repositories.backups.readSnapshot()
      const checkedAt = now()
      const currentSummary = validateBackupFile(
        createBackupFile({ data: currentData, exportedAt: checkedAt, app: getAppMetadata() }),
        undefined,
        { now: checkedAt }
      ).summary

      const validation =
        options.mode === 'replace'
          ? validateBackupFile(payload, undefined, { now: checkedAt })
          : validateBackupFile(payload, currentData, { now: checkedAt })

      console.info('[fairtab] backup restore requested', {
        mode: options.mode,
        exportedAt: parsed.backup.exportedAt,
        summary: validation.summary,
        currentSummary,
      })

      if (!validation.valid) {
        console.warn('[fairtab] backup restore blocked: validation failed', {
          mode: options.mode,
          errors: validation.errors.length,
        })
        return restoreError({
          mode: options.mode,
          error: 'Backup file failed validation.',
          validation,
        })
      }

      if (options.mode === 'empty' && !isEmptySummary(currentSummary)) {
        console.warn('[fairtab] backup restore blocked: current database is not empty', {
          mode: options.mode,
          currentSummary,
        })
        return restoreError({
          mode: options.mode,
          error: 'Current database is not empty. Use replace mode with explicit confirmation.',
          validation,
        })
      }

      if (options.mode === 'replace' && options.confirmation !== REPLACE_BACKUP_CONFIRMATION) {
        console.warn('[fairtab] backup restore blocked: confirmation mismatch', {
          mode: options.mode,
        })
        return restoreError({
          mode: options.mode,
          error: `Type "${REPLACE_BACKUP_CONFIRMATION}" to replace all FairTab data.`,
          validation,
        })
      }

      await repositories.backups.restoreSnapshot(parsed.backup.data, {
        replace: options.mode === 'replace',
      })

      const restoredAt = now().toISOString()
      console.info('[fairtab] backup restore completed', {
        mode: options.mode,
        restoredAt,
        summary: validation.summary,
      })

      return {
        restored: true,
        mode: options.mode,
        restoredAt,
        summary: validation.summary,
        validation,
      }
    },
  }
}
