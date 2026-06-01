import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RecentGroups } from '@/components/groups/recent-groups'
import { GroupTokenSearch } from '@/components/groups/group-token-search'
import { Plus } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Groups' }

export default function GroupsPage() {
  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-muted-foreground mt-1">Your recently visited groups</p>
        </div>
        <Button asChild>
          <Link href="/groups/new">
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </Link>
        </Button>
      </div>
      <RecentGroups />
      <Separator className="my-8" />
      <div className="space-y-3">
        <p className="text-sm font-medium">Find a group by token</p>
        <p className="text-xs text-muted-foreground">
          Use this if you have a group token but it&apos;s not showing in your recent groups.
        </p>
        <GroupTokenSearch />
      </div>
    </div>
  )
}
