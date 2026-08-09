import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LogMealPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Log a meal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snap a photo or search for what you ate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Photo upload</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">The photo-to-prediction flow is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
