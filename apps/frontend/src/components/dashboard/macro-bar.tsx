import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MacroBarProps {
  label: string
  icon: LucideIcon
  consumed: number
  target: number
  unit?: string
  barClassName: string
  iconClassName: string
}

export function MacroBar({
  label,
  icon: Icon,
  consumed,
  target,
  unit = 'g',
  barClassName,
  iconClassName,
}: MacroBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0

  return (
    <div className="flex items-center gap-3">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', iconClassName)}>
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            <span className="font-semibold text-foreground">{Math.round(consumed)}</span>
            {unit} of {Math.round(target)}
            {unit}
          </span>
        </div>
        {/* The fill is full-width and slid into view with translateX rather
            than grown with `width`. Animating width relayouts this element
            on every frame of every bar; a transform composites and touches
            nothing else. Sliding rather than scaling also keeps the pill's
            right cap a true half-circle at any percentage — scaleX would
            squash it flatter the emptier the bar got. */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${String(Math.round(consumed))}${unit} of ${String(Math.round(target))}${unit}`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-transform duration-(--motion-slow) ease-(--ease-enter)',
              barClassName,
            )}
            style={{ transform: `translateX(-${String(100 - pct)}%)` }}
          />
        </div>
      </div>
    </div>
  )
}
