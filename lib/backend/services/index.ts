import { createAttachmentService } from './attachments'
import { createLegacyBackupService } from './backup'
import { createBackupService } from './backups'
import { createExpenseService } from './expenses'
import { createGroupService } from './groups'
import { createPersonalService } from './personal'
import { createRecurringService } from './recurring'
import { createSavingsService } from './savings'
import { createSettlementService } from './settlements'
import type { BackendServiceDeps } from './types'

export function createBackendServices(deps: BackendServiceDeps) {
  return {
    groups: createGroupService(deps),
    expenses: createExpenseService(deps),
    personal: createPersonalService(deps),
    settlements: createSettlementService(deps),
    recurring: createRecurringService(deps),
    savings: createSavingsService(deps),
    attachments: createAttachmentService(deps),
    legacyBackup: createLegacyBackupService(deps),
    storage: deps.storage,
    backups: createBackupService(deps),
  }
}

export type BackendServices = ReturnType<typeof createBackendServices>
