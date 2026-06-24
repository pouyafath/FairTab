import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RecentGroups } from '@/components/groups/recent-groups'
import { GroupTokenSearch } from '@/components/groups/group-token-search'
import { Plus, Search } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Groups' }

export default function GroupsPage() {
  return (
    <div className="container max-w-5xl py-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker mb-2">Shared tabs</p>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Recent shared expense groups from this browser.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/groups/new">
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </Link>
        </Button>
      </div>
      <div className="page-panel p-4 sm:p-6">
        <RecentGroups />
      </div>

      <div className="mt-6 page-panel p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">Find a group by token</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a shared group that is not saved in this browser yet.
            </p>
          </div>
        </div>
        <GroupTokenSearch />
      </div>
    </div>
  )
}
