import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { GlassWater, Minus, Plus } from 'lucide-react'

interface WaterCardProps {
  glasses: number
  onAdd: () => void
  onRemove: () => void
  target?: number
}

export function WaterCard({ glasses, onAdd, onRemove, target = 8 }: WaterCardProps) {
  const pct = Math.min(100, Math.round((glasses / target) * 100))

  // Micro-interaction: scale factor based on recent action
  const [scale, setScale] = useState(1)

  // Scale up on add, scale down on remove
  // The global prefers-reduced-motion guard (index.css) will override
  // transition-duration to 0.01ms when the user prefers reduced motion,
  // so the transform is applied instantaneously but without animation.

  useEffect(() => {
    const timer = setTimeout(() => setScale(1), 150)
    return () => clearTimeout(timer)
  }, [])

  const handleAdd = () => {
    setScale(1.05)
    onAdd()
  }

  const handleRemove = () => {
    setScale(0.95)
    onRemove()
  }

  return (
    <div className="space-y-2">
      <Card>
        <CardHeader className="flex items-center gap-2">
          <GlassWater size={18} strokeWidth={2} className="text-chart-water" />
          <CardTitle>Hydration</CardTitle>
        </CardHeader>

        <CardDescription>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {glasses}
          </span>{' '}
          / {target} glasses · {pct}% of goal
        </CardDescription>

        <CardContent className="flex flex-col gap-3">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[length:var(--_water_gradient)_content-box]"
            style={{
              backgroundImage: `linear-gradient(90deg, var(--chart-water), var(--chart-water))`,
              transform: `scale(${scale})`,
              transformOrigin: '0 center',
              transitionProperty: 'transform',
              transitionDuration: '0.15s ease-out',
              transitionTimingFunction: 'ease-out',
            }}
          >
            <div
              className="h-full rounded-full bg-[length:var(--_water_gradient)_inset] [&_:*]{inset-0}"
              style={{
                backgroundImage: `linear-gradient(90deg, var(--chart-water), var(--chart-water))`,
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              className="flex-1 py-1.5 rounded-md bg-transparent border border-border text-sm font-medium text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={handleRemove}
              aria-label="Remove glass"
              disabled={glasses <= 0}
            >
              <Minus size={16} strokeWidth={2} />
              Remove
            </button>
            <button
              className="flex-1 py-1.5 rounded-md bg-transparent border border-border text-sm font-medium text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={handleAdd}
              aria-label="Add glass"
            >
              <Plus size={16} strokeWidth={2} />
              Add
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}