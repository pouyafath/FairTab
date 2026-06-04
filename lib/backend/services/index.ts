import { createAttachmentService } from './attachments'
import { createExpenseService } from './expenses'
import { createGroupService } from './groups'
import { createPersonalService } from './personal'
import { createSettlementService } from './settlements'
import type { BackendServiceDeps } from './types'

export function createBackendServices(deps: BackendServiceDeps) {
  return {
    groups: createGroupService(deps),
    expenses: createExpenseService(deps),
    personal: createPersonalService(deps),
    settlements: createSettlementService(deps),
    attachments: createAttachmentService(deps),
    storage: deps.storage,
  }
}

export type BackendServices = ReturnType<typeof createBackendServices>
