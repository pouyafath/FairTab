'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Plus, ExternalLink, Archive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/formatting'

export interface RecentGroup {
  token: string
  name: string
  visitedAt: number
  currency: string
  isArchived?: boolean
}

const STORAGE_KEY = 'fairtab_recent_groups'
const EMPTY_RECENT_GROUPS: RecentGroup[] = []
let lastStoredValue: string | null = null
let lastSnapshot: RecentGroup[] = EMPTY_RECENT_GROUPS

function readRecentGroups(): RecentGroup[] {
  if (typeof window === 'undefined') return EMPTY_RECENT_GROUPS

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === lastStoredValue) return lastSnapshot

    lastStoredValue = stored
    lastSnapshot = stored ? JSON.parse(stored) : EMPTY_RECENT_GROUPS
    return lastSnapshot
  } catch {
    return EMPTY_RECENT_GROUPS
  }
}

function subscribeToRecentGroups(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  return () => window.removeEventListener('storage', onStoreChange)
}

export function saveRecentGroup(group: RecentGroup) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const existing: RecentGroup[] = stored ? JSON.parse(stored) : []
    const filtered = existing.filter((g) => g.token !== group.token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([group, ...filtered].slice(0, 10)))
  } catch {
    // localStorage unavailable
  }
}

export function RecentGroups() {
  const groups = useSyncExternalStore(
    subscribeToRecentGroups,
    readRecentGroups,
    () => EMPTY_RECENT_GROUPS
  )

  const [showArchived, setShowArchived] = useState(false)

  const activeGroups = groups.filter((g) => !g.isArchived)
  const archivedGroups = groups.filter((g) => g.isArchived)
  const displayGroups = showArchived ? archivedGroups : activeGroups

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="rounded-lg bg-primary/10 p-4">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">No recent groups</h3>
          <p className="text-muted-foreground mt-1">
            Create a group or open a group link to get started.
          </p>
        </div>
        <Button asChild>
          <Link href="/groups/new">
            <Plus className="h-4 w-4 mr-2" />
            Create your first group
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {archivedGroups.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="text-muted-foreground"
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived
              ? `Active groups (${activeGroups.length})`
              : `Archived (${archivedGroups.length})`}
          </Button>
        </div>
      )}

      {displayGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-muted-foreground">
            {showArchived ? 'No archived groups.' : 'No active groups.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayGroups.map((g) => (
            <Link key={g.token} href={`/groups/${g.token}`}>
              <Card className="h-full cursor-pointer p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{g.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-muted-foreground">{g.currency}</p>
                        {g.isArchived && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            Archived
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Last visited: {formatDate(g.visitedAt)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
