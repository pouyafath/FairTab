'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function GroupTokenSearch() {
  const router = useRouter()
  const [token, setToken] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (trimmed) router.push(`/groups/${trimmed}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        aria-label="Group token"
        placeholder="Enter group token to find a group"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="max-w-sm"
      />
      <Button type="submit" variant="outline" disabled={!token.trim()}>
        <Search className="h-4 w-4 mr-2" />
        Find
      </Button>
    </form>
  )
}
