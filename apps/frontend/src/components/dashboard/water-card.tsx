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
  const pct = target > 0 ? Math.min(100, Math.round((glasses / target) * 100)) : 0

  // Micro-interaction: the icon pulses on add/remove. It rides the icon rather
  // than the bar because a transform on the track scales the fill with it, so
  // the bar would read as a different value than pct for the length of the
  // animation.
  //
  // The global prefers-reduced-motion guard (index.css) collapses every
  // transition-duration to 0.01ms, so the transform lands instantly and
  // unanimated for users who ask for that — no local media query needed.
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (scale === 1) return
    // Matches --motion-fast; with an empty dep array this timer only ever ran
    // once on mount, so the very first add left the icon stuck at 1.05.
    const timer = setTimeout(() => setScale(1), 150)
    return () => clearTimeout(timer)
  }, [scale])

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
          <GlassWater
            size={18}
            strokeWidth={2}
            className="text-chart-water transition-transform duration-[var(--motion-fast)] ease-out"
            style={{ transform: `scale(${String(scale)})` }}
          />
          <CardTitle>Hydration</CardTitle>
        </CardHeader>

        <CardDescription>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {glasses}
          </span>{' '}
          / {target} glasses · {pct}% of goal
        </CardDescription>

        <CardContent className="flex flex-col gap-3">
          {/* Track stays muted and full width; only the child carries the water
              colour, so an empty goal reads as an empty bar. */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="relative h-full overflow-hidden rounded-full bg-chart-water transition-[width] duration-[var(--motion-standard)] ease-out"
              style={{ width: `${String(pct)}%` }}
              aria-hidden="true"
            >
              {/* Sheen is a child of the fill, not the track, so it is clipped
                  to the filled width instead of washing out the empty track. */}
              <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{ background: 'linear-gradient(to right, rgba(255, 255, 255, 0.3), transparent)' }}
              />
            </div>
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
