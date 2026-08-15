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

  // The one place a gradient earns a curve rather than a flat fill: the arc
  // sweeps through it as it fills, so progress reads as travel along the
  // ring instead of a bar that happens to be bent. Both stops are built from
  // the same tokens the flat version used (success -> success+carb-ochre,
  // destructive -> destructive+accent), so it stays inside the palette; the
  // weakest stop still measures 5.83:1 (light) / 5.27:1 (dark) against the
  // --muted track, past the 3:1 WCAG 1.4.11 bar for a graphical object.
  const gradientId = isOver ? 'calorie-ring-over' : 'calorie-ring-under'

  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
      {/* The SVG is decorative: the same two numbers it encodes are printed
          in the middle of it as real text, so announcing the ring as well
          would only make a screen reader say everything twice. */}
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0%"
              stopColor={isOver ? 'var(--destructive)' : 'var(--success)'}
            />
            <stop
              offset="100%"
              stopColor={
                isOver
                  ? 'color-mix(in oklab, var(--destructive) 70%, var(--accent))'
                  : 'color-mix(in oklab, var(--success) 70%, var(--chart-carb))'
              }
            />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-(--motion-slow) ease-(--ease-enter)"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
          {Math.round(isOver ? consumed - target : remaining)}
        </span>
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {isOver ? 'kcal over' : 'kcal left'}
        </span>
      </div>
    </div>
  )
}
