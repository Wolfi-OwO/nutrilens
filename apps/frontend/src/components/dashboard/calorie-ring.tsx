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
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke={isOver ? 'var(--destructive)' : 'var(--primary)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
          {Math.round(isOver ? consumed - target : remaining)}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {isOver ? 'kcal over' : 'kcal left'}
        </span>
      </div>
    </div>
  )
}
