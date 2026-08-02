interface Props {
  consumed: number;
  target: number;
}

const RADIUS = 54;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CalorieRing({ consumed, target }: Props) {
  const fraction = Math.min(consumed / target, 1);
  const offset = CIRCUMFERENCE * (1 - fraction);
  const remaining = Math.max(target - consumed, 0);

  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke="var(--color-stone-200)"
          strokeWidth={STROKE}
        />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl font-semibold tabular-nums text-stone-900">
          {remaining}
        </span>
        <span className="text-xs font-medium text-stone-500">kcal left</span>
      </div>
    </div>
  );
}
