import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RecentGroups } from '@/components/groups/recent-groups'
import { Plus } from 'lucide-react'
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
    </div>
  )
}
