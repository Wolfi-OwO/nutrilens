import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Hi, {user?.displayName.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's today at a glance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Calorie and macro tracking is coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
