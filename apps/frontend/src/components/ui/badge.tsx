import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// One primitive for the status-pill shape three places already hand-roll
// today — components/dashboard/source-badge.tsx (meal log source), the role
// and status columns in pages/admin/users.tsx, and the nav's "Beta" pill —
// and that #106/#107/#108's tables will want for the same reason. Not
// speculative: every variant here already has a real, named consumer or a
// roadmap issue that will.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold tracking-wide uppercase whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        // success/danger/info follow the tint + "-strong"/plain-color-on-top
        // pattern index.css already measures for primary/destructive (see
        // pages/profile.tsx's STATUS_BADGE_STYLES) — a solid pill reads
        // heavier than this dense, tabular direction wants for a value
        // repeated down a column. --success has no "-strong" pairing in
        // index.css (only primary/destructive got the full triple), so this
        // uses --success directly; unlike primary/destructive it is not
        // re-verified by scripts/contrast.mjs, so keep it off raw page
        // backgrounds and only over --card/table surfaces, which is where
        // every named consumer above already places it.
        success: 'bg-success/10 text-success',
        // No dedicated --warning token exists in index.css. --chart-carb is
        // this palette's only amber hue (measured >=5:1 on --card there), so
        // it is reused here rather than inlining a new hex for one variant.
        warning: 'bg-chart-carb/10 text-chart-carb',
        danger: 'bg-destructive/10 text-destructive-strong',
        info: 'bg-primary/10 text-primary-strong',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, className }))} {...props} />
  ),
)
Badge.displayName = 'Badge'

// badgeVariants is intentionally NOT exported (unlike buttonVariants):
// nothing consumes it yet, and re-exporting it would add a second
// react-refresh "only-export-components" warning next to button.tsx's
// baseline one — export it if and when #106/#107/#108 actually need the
// raw variant function outside this file.
