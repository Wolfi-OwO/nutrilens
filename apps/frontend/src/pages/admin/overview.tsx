import { Activity, Salad, ShieldCheck, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminStats } from '@/hooks/use-admin-stats'

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users
  label: string
  value: number
  detail?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
            {value.toLocaleString()}
          </p>
          {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={20} strokeWidth={2} />
        </span>
      </CardContent>
    </Card>
  )
}

export default function AdminOverviewPage() {
  const stats = useAdminStats()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide activity at a glance.</p>
      </div>

      {stats.isLoading && (
        <Card>
          <CardContent className="flex h-48 items-center justify-center pt-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </CardContent>
        </Card>
      )}

      {stats.isError && !stats.isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load platform stats.</p>
            <Button variant="outline" size="sm" onClick={() => void stats.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {stats.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total users"
              value={Object.values(stats.data.usersByRole).reduce((a, b) => a + b, 0)}
              detail={`${String(stats.data.usersByStatus.suspended)} suspended`}
            />
            <StatCard icon={ShieldCheck} label="Admins" value={stats.data.usersByRole.admin} />
            <StatCard icon={Salad} label="Active diet plans" value={stats.data.activeDietPlans} />
            <StatCard
              icon={Activity}
              label="Meal logs (7d)"
              value={stats.data.mealLogsLast7Days}
              detail={`${stats.data.mealLogsLast30Days.toLocaleString()} in the last 30d`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Signups, last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.data.signupsLast30Days.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No signups in this window yet.</p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.data.signupsLast30Days}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                        tickLine={false}
                        axisLine={false}
                        width={32}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value) => [`${String(value)}`, 'Signups']}
                      />
                      <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
