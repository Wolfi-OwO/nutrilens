import * as React from 'react'
import { cn } from '@/lib/utils'

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        // Re-decided against Werkbank, not carried over: the uppercase +
        // tracking-wide treatment was the OLD editorial direction's print-
        // caption device. Werkbank's thesis is "the number is the interface"
        // — a form label is quiet metadata standing next to the value it
        // names, not a decorative element competing for attention, so it
        // drops to sentence case. text-sm (13px) still separates it from the
        // 15px input value above it without the print-caption styling.
        // TableHead keeps uppercase deliberately: dense column headers are a
        // different, still-current convention in this direction.
        'text-sm font-medium text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  ),
)
Label.displayName = 'Label'
