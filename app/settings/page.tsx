import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default function SettingsPage() {
  return (
    <div className="container py-12 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            App Settings
            <Badge variant="secondary">Coming soon</Badge>
          </CardTitle>
          <CardDescription>
            Settings like default currency, theme, and notification preferences are on the roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Current defaults:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Default currency: CAD</li>
              <li>Language: English (Canada)</li>
              <li>Date format: YYYY-MM-DD</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
