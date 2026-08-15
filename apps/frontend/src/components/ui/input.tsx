import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // aria-invalid gets a red border, not only a red message below the
        // field — the message alone made the error state depend on reading
        // order, and on a wide form the field itself gave no sign.
        'flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-sm transition-colors duration-(--motion-fast) ease-(--ease-enter) placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
