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
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconClassName)}>
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
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500 ease-out', barClassName)}
            style={{ width: `${String(pct)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
