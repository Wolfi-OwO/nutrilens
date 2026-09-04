import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        // aria-invalid: the 15 form fields that set this prop (login,
        // register, plan, log-meal, profile, progress) previously had no
        // visual pairing for it at all — the boolean reached the DOM but
        // nothing here read it. Tailwind's built-in aria-invalid variant
        // wires the existing prop to a solid destructive border/ring rather
        // than adding a second invalid-tracking mechanism.
        'flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
