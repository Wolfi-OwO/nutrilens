import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">Weight and trend history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weight trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Trend charts are coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
