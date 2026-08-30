import { FormattedMessage, FormattedNumber } from 'react-intl'

interface CalorieRingProps {
  consumed: number
  target: number
}

const RADIUS = 54
const STROKE = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CalorieRing({ consumed, target }: CalorieRingProps) {
  const fraction = target > 0 ? Math.min(consumed / target, 1) : 0
  const offset = CIRCUMFERENCE * (1 - fraction)
  const remaining = Math.max(target - consumed, 0)
  const isOver = consumed > target

  return (
    <div
      className="relative flex h-40 w-40 shrink-0 items-center justify-center"
      aria-live="polite"
      aria-atomic="true"
    >
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={STROKE}
        />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={isOver ? 'var(--destructive)' : 'var(--success)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          // box-shadow does not apply to SVG shapes; drop-shadow is the SVG/CSS
          // filter equivalent and actually renders the glow.
          style={{ filter: 'drop-shadow(0 0 8px var(--accent-glow))' }}
          // Reduced motion is handled globally in index.css
          // (@media prefers-reduced-motion collapses all durations to 0.01ms),
          // so this only needs the one correct standard-motion transition.
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="relative z-10 font-display text-3xl font-semibold tabular-nums text-foreground"
        >
          <FormattedNumber value={Math.round(isOver ? consumed - target : remaining)} />
        </span>
        <span
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          <FormattedMessage id={isOver ? 'calorieRing.over' : 'calorieRing.left'} />
        </span>
      </div>
    </div>
  )
}