import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PlanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Your plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Calorie and macro targets.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diet plan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Setting up your plan is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
