import { useState, useEffect } from 'react'
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { GlassWater, Minus, Plus } from 'lucide-react'

interface WaterCardProps {
  glasses: number
  onAdd: () => void
  onRemove: () => void
  target?: number
}

export function WaterCard({ glasses, onAdd, onRemove, target = 8 }: WaterCardProps) {
  const intl = useIntl()
  const pct = target > 0 ? Math.min(100, Math.round((glasses / target) * 100)) : 0
  // ICU's `percent` skeleton takes a fraction, not a 0-100 number — the bar
  // below wants the integer, the sentence wants the fraction.
  const fraction = pct / 100

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
    <Card className="flex h-full flex-col">
      {/* Header matches StatTile's exactly, because this card sits in the same
          four-up row as Serie/Gewicht/Mahlzeiten and was the only one of the
          four that did not. Seen side by side at 320px: the bare icon read as a
          missing chip next to three tinted ones, and text-sm rendered
          "FLÜSSIGKEIT" visibly larger than its three text-xs siblings. The
          chip is h-7 w-7 rounded-md at /15 alpha, the same recipe StatTile
          passes as iconClassName. The scale transform stays on the glyph, not
          the chip, so the fill-up animation still reads. */}
      <CardHeader className="flex-row items-center gap-2 p-4 pb-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-chart-water/15">
          <GlassWater
            size={14}
            strokeWidth={2}
            className="text-chart-water transition-transform duration-[var(--motion-fast)] ease-out"
            style={{ transform: `scale(${String(scale)})` }}
          />
        </span>
        <CardTitle className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <FormattedMessage id="water.title" />
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
            <FormattedNumber value={glasses} />
          </span>
          <span className="text-xs text-muted-foreground">
            <FormattedMessage id="water.summary" values={{ glasses, target, percent: fraction }} />
          </span>
        </div>

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

        {/* The word labels are dropped below 360px. Measured at a 320px
            viewport: the two flex-1 buttons need 49px of min-content each and
            the card only offers ~120px between them, so "+ Mehr" rendered 9px
            PAST the card's own right border -- the button outline visibly
            crossed the tile outline. Nothing is lost by hiding the word: both
            buttons already carry a full aria-label (water.removeLabel /
            water.addLabel), so the accessible name never depended on the
            visible text, and a plus/minus pair on a glass counter is not
            ambiguous. Same measured-breakpoint idiom as the header wordmark in
            app-layout.tsx. */}
        <div className="mt-auto flex gap-2">
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-transparent py-1.5 text-sm font-medium text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleRemove}
            aria-label={intl.formatMessage({ id: 'water.removeLabel' })}
            disabled={glasses <= 0}
          >
            <Minus size={16} strokeWidth={2} />
            <span className="hidden min-[360px]:inline">
              <FormattedMessage id="water.remove" />
            </span>
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-transparent py-1.5 text-sm font-medium text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleAdd}
            aria-label={intl.formatMessage({ id: 'water.addLabel' })}
          >
            <Plus size={16} strokeWidth={2} />
            <span className="hidden min-[360px]:inline">
              <FormattedMessage id="water.add" />
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
