import { createExpenseService } from './expenses'
import { createGroupService } from './groups'
import { createPersonalService } from './personal'
import { createRecurringService } from './recurring'
import { createSettlementService } from './settlements'
import type { BackendServiceDeps } from './types'

export function createBackendServices(deps: BackendServiceDeps) {
  return {
    groups: createGroupService(deps),
    expenses: createExpenseService(deps),
    personal: createPersonalService(deps),
    settlements: createSettlementService(deps),
    recurring: createRecurringService(deps),
  }
}

export type BackendServices = ReturnType<typeof createBackendServices>
