'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, UserMinus } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import type { GroupMember } from '@/types'
import type { RemoveGroupMemberAction, UpdateGroupMemberAction } from '@/types/actions'

interface Props {
  groupToken: string
  members: GroupMember[]
  updateMemberAction: UpdateGroupMemberAction
  removeMemberAction: RemoveGroupMemberAction
  isArchived?: boolean
}

export function MemberList({
  groupToken,
  members,
  updateMemberAction,
  removeMemberAction,
  isArchived = false,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [editTarget, setEditTarget] = useState<GroupMember | null>(null)
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  function openEdit(member: GroupMember) {
    setEditName(member.name)
    setEditEmail(member.email ?? '')
    setEditTarget(member)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    const target = editTarget
    startTransition(async () => {
      const result = await updateMemberAction(groupToken, target.id, {
        name: editName,
        email: editEmail,
      })
      if (result.success) {
        toast({ title: 'Member updated', description: result.data.name })
        setEditTarget(null)
        router.refresh()
      } else {
        toast({ title: 'Could not update', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return
    const target = removeTarget
    startTransition(async () => {
      const result = await removeMemberAction(groupToken, target.id)
      if (result.success) {
        toast({ title: 'Member removed', description: target.name })
        setRemoveTarget(null)
        router.refresh()
      } else {
        toast({ title: 'Cannot remove member', description: result.error, variant: 'destructive' })
        setRemoveTarget(null)
      }
    })
  }

  if (members.length === 0) return null

  return (
    <>
      <div className="space-y-1">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
          >
            <div className="min-w-0">
              <span className="text-sm font-medium">{member.name}</span>
              {member.email && (
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              )}
            </div>
            {!isArchived && (
              <div className="flex flex-shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 sm:h-7 sm:w-7"
                  onClick={() => openEdit(member)}
                  disabled={isPending}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit {member.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-destructive hover:text-destructive sm:h-7 sm:w-7"
                  onClick={() => setRemoveTarget(member)}
                  disabled={isPending}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove {member.name}</span>
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit member dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email (optional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !editName.trim()}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation dialog */}
      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Remove ${removeTarget.name} from the group? This cannot be undone.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveConfirm} disabled={isPending}>
              {isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
