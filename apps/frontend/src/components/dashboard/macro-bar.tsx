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
        {/* Track stays muted so the coloured fill (barClassName, already
            passed per-macro from the caller) is what carries the color —
            painting the track itself in the macro color made the fill
            invisible against it. */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'relative h-full overflow-hidden rounded-full transition-[width] duration-[var(--motion-standard)] ease-out',
              barClassName,
            )}
            style={{ width: `${String(pct)}%` }}
            aria-hidden="true"
          >
            {/* Shine is a child of the fill, not the track, so it is clipped
                to the filled width instead of washing out the empty track. */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{ background: 'linear-gradient(to right, rgba(255, 255, 255, 0.3), transparent)' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
