import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createGroup } from '@/lib/actions/groups'
import { NewGroupForm } from '@/components/groups/new-group-form'

export default function NewGroupPage() {
  return (
    <div className="container py-12 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Create a Group</CardTitle>
          <CardDescription>
            Give your group a name and start splitting expenses. No account required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewGroupForm createGroupAction={createGroup} />
        </CardContent>
      </Card>
    </div>
  )
}
