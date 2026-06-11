import 'server-only'

import { getBackend } from '@/lib/backend/runtime'
import type { GroupWithMembers } from '@/types'

/**
 * Resolves a group from its share token. The unguessable token is FairTab's
 * entire access model, so every server action that mutates group data must
 * authorize through this helper instead of trusting a raw numeric groupId —
 * server actions are public HTTP endpoints and numeric ids are enumerable.
 */
export async function findGroupForToken(token: string): Promise<GroupWithMembers | null> {
  if (typeof token !== 'string' || token.length === 0) return null
  return getBackend().groups.getGroupByToken(token)
}
