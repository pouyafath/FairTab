'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Archive, ArchiveRestore } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { CURRENCIES } from '@/lib/constants'
import type { GroupWithMembers } from '@/types'
import type { ArchiveGroupAction, DeleteGroupAction, UpdateGroupAction } from '@/types/actions'

interface Props {
  group: GroupWithMembers
  updateGroupAction: UpdateGroupAction
  deleteGroupAction: DeleteGroupAction
  archiveGroupAction: ArchiveGroupAction
}

export function GroupSettingsDialog({ group, updateGroupAction, deleteGroupAction, archiveGroupAction }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'settings' | 'confirmDelete'>('settings')
  const [name, setName] = useState(group.name)
  const [currency, setCurrency] = useState(group.currency)
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setView('settings')
      setName(group.name)
      setCurrency(group.currency)
    }
    setOpen(next)
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateGroupAction(group.token, { name, currency })
      if (result.success) {
        toast({ title: 'Group updated', description: result.data.name })
        setOpen(false)
        router.refresh()
      } else {
        toast({ title: 'Could not update', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleArchiveToggle() {
    startTransition(async () => {
      const newState = !group.isArchived
      const result = await archiveGroupAction(group.token, newState)
      if (result.success) {
        toast({
          title: newState ? 'Group archived' : 'Group unarchived',
          description: newState
            ? 'This group has been moved to your archive.'
            : 'This group is now active again.',
        })
        setOpen(false)
        router.refresh()
      } else {
        toast({ title: 'Could not update', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGroupAction(group.token)
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

              <form onSubmit={handleSaveSettings} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="group-name">Group name</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currency !== group.currency && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Existing expense amounts are not converted — only the display currency
                      changes.
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isPending || (name === group.name && currency === group.currency)}
                >
                  {isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </form>

              <Separator />

              {/* Archive section */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Archive</p>
                <p className="text-sm text-muted-foreground">
                  {group.isArchived
                    ? 'This group is archived. Unarchive it to add new expenses.'
                    : 'Archive this group to hide it from your recent groups list. You can unarchive it later.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchiveToggle}
                  disabled={isPending}
                >
                  {group.isArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      {isPending ? 'Unarchiving…' : 'Unarchive group'}
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" />
                      {isPending ? 'Archiving…' : 'Archive group'}
                    </>
                  )}
                </Button>
              </div>

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
