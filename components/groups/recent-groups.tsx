'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Plus, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/formatting'

export interface RecentGroup {
  token: string
  name: string
  visitedAt: number
  currency: string
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

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Users className="h-8 w-8 text-muted-foreground" />
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <Link key={g.token} href={`/groups/${g.token}`}>
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-xs text-muted-foreground">{g.currency}</p>
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
  )
}
