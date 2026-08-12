import * as React from 'react'
import { cn } from '@/lib/utils'

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        // Small-caps letterspaced label per the editorial direction —
        // uppercase + tracking reads as a print caption, not a UI chip.
        'text-xs font-semibold tracking-wide text-muted-foreground uppercase peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  ),
)
Label.displayName = 'Label'
