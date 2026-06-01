'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import type { GroupWithMembers } from '@/types'
import type { DeleteGroupAction, RenameGroupAction } from '@/types/actions'

interface Props {
  group: GroupWithMembers
  renameGroupAction: RenameGroupAction
  deleteGroupAction: DeleteGroupAction
}

export function GroupSettingsDialog({ group, renameGroupAction, deleteGroupAction }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'settings' | 'confirmDelete'>('settings')
  const [name, setName] = useState(group.name)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setView('settings')
      setName(group.name)
    }
    setOpen(next)
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await renameGroupAction(group.id, { name })
      if (result.success) {
        toast({ title: 'Group renamed', description: result.data.name })
        setOpen(false)
        router.refresh()
      } else {
        toast({ title: 'Could not rename', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGroupAction(group.id)
      if (result.success) {
        toast({ title: 'Group deleted' })
        setOpen(false)
        router.push('/groups')
      } else {
        toast({ title: 'Could not delete', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4 mr-2" />
        Settings
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          {view === 'settings' ? (
            <>
              <DialogHeader>
                <DialogTitle>Group settings</DialogTitle>
                <DialogDescription>{group.name}</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleRename} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="group-name">Group name</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <Button type="submit" disabled={isPending || name === group.name}>
                  {isPending ? 'Saving…' : 'Save name'}
                </Button>
              </form>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Danger zone</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this group, its members, and all expenses. This cannot be
                  undone.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setView('confirmDelete')}
                  disabled={isPending}
                >
                  Delete group
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Delete group?</DialogTitle>
                <DialogDescription>
                  &ldquo;{group.name}&rdquo; and all its expenses will be permanently removed. This
                  cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setView('settings')}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                  {isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
