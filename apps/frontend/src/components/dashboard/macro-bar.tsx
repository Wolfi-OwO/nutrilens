import type { LucideIcon } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { cn } from '@/lib/utils'

interface MacroBarProps {
  /** Message id for the macro's name — 'macro.protein', 'macro.carbs', 'macro.fat'. */
  labelId: string
  icon: LucideIcon
  consumed: number
  target: number
  unit?: string
  barClassName: string
  iconClassName: string
  /**
   * Render the "X g left" / "X g over target" line under the bar.
   *
   * Opt-in, and default OFF on purpose: profile.tsx's average macro-split card
   * reuses this component with `target` set to the SUM of the three averages,
   * as a proportion denominator rather than a real goal (see its own comment).
   * A "remaining" figure against a fake denominator is meaningless -- it read
   * "noch 214 g" against a 340 g "target" that is not a target -- so a consumer
   * has to say that its target is real before this line appears.
   */
  showRemaining?: boolean
  /** Row wrapper classes — the dashboard's MacroTile uses this for the
   * py-4/divider rhythm between rows; profile.tsx's compact list leaves it
   * unset and keeps the plain flex row. */
  className?: string
}

export function MacroBar({
  labelId,
  icon: Icon,
  consumed,
  target,
  unit = 'g',
  barClassName,
  iconClassName,
  showRemaining = false,
  className,
}: MacroBarProps) {
  const isOver = target > 0 && consumed > target
  const pct = target > 0 ? Math.min(100, Math.round((consumed / target) * 100)) : 0

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* h-10/w-10 and icon size 20, up a step from h-8/16: this component is
          shared with profile.tsx's macro cards, so the bump applies there
          too, which is fine — it is still inside the Werkbank scale and
          profile.tsx has no space pressure of its own. The dashboard is why
          it moved: this bar is one of only three rows filling a tile that
          stretches to match its taller sibling (see MacroTile's comment). */}
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', iconClassName)}>
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-foreground">
            <FormattedMessage id={labelId} />
          </span>
          {/* The whole "42 g of 120 g" phrase is one message: German puts the
              preposition and the unit differently ("42 g von 120 g"), and a
              hand-concatenated version cannot express that. */}
          <span
            className={cn(
              'font-mono text-sm tabular-nums text-muted-foreground',
              // "Über Ziel" (WCAG 1.4.1) never rests on hue alone — the fill
              // below carries the hatch, this carries the bold weight, so
              // greyscale/colour-blind/photocopy still reads "exceeded".
              isOver && 'font-bold text-destructive-strong',
            )}
          >
            <FormattedMessage
              id="macro.barValue"
              values={{ consumed: Math.round(consumed), target: Math.round(target), unit }}
            />
          </span>
        </div>
        {/* Track stays muted so the coloured fill (barClassName, already
            passed per-macro from the caller) is what carries the color —
            painting the track itself in the macro color made the fill
            invisible against it. h-2, up from h-1.5, to match the heavier
            row above instead of looking like an afterthought under it. */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'relative h-full overflow-hidden rounded-full transition-[width] duration-[var(--motion-standard)] ease-out',
              // Over target: the hatch (index.css .over-target) replaces the
              // solid macro-colour fill outright rather than layering on top
              // of it, so "exceeded" is never a colour-plus-overlay guess.
              isOver ? 'over-target' : barClassName,
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
        {/* The actionable number, which the "X g von Y g" line above does not
            give you: how much is LEFT (or how far over). Same "über Ziel"
            treatment as the value line: never hue alone, the word itself
            says it. */}
        {showRemaining && (
        <p
          className={cn(
            'mt-1.5 text-right font-mono text-xs tabular-nums',
            isOver ? 'font-bold text-destructive-strong' : 'text-muted-foreground',
          )}
        >
          <FormattedMessage
            id={isOver ? 'macro.barOver' : 'macro.barRemaining'}
            values={{
              value: Math.abs(Math.round(target - consumed)),
              unit,
            }}
          />
        </p>
        )}
      </div>
    </div>
  )
}
