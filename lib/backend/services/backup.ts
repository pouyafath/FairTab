import { backupDocumentSchema } from '@/lib/validations/backup'
import type { ActionResult, BackupCounts, BackupDocument } from '@/types'
import type { BackendServiceDeps } from './types'

function countRows(doc: BackupDocument): BackupCounts {
  return {
    groups: doc.data.groups.length,
    members: doc.data.members.length,
    expenses: doc.data.expenses.length,
    settlements: doc.data.settlements.length,
    personalTransactions: doc.data.personalTransactions.length,
    recurringRules: doc.data.recurringRules.length,
    savingsGoals: doc.data.savingsGoals.length,
    attachments: doc.data.attachments.length,
  }
}

export function createBackupService({ repositories, now }: BackendServiceDeps) {
  return {
    async exportBackup(): Promise<BackupDocument> {
      const data = await repositories.backup.exportAll()
      return {
        format: 'fairtab-backup',
        version: 1,
        generatedAt: now().toISOString(),
        data,
      }
    },

    async importBackup(raw: unknown): Promise<ActionResult<BackupCounts>> {
      const parsed = backupDocumentSchema.safeParse(raw)
      if (!parsed.success) {
        return {
          success: false,
          error: 'Not a valid FairTab backup file (or a newer format than this version understands)',
        }
      }

      try {
        await repositories.backup.importAll(parsed.data.data)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Restore failed',
        }
      }

      return { success: true, data: countRows(parsed.data) }
    },
  }
}
