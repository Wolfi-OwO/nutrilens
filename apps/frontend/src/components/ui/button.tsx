import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // No shadow by default — structure comes from the fill/border, not
  // elevation (see index.css). The reduced-motion guard in index.css
  // collapses every duration below globally, so nothing here needs a
  // motion-safe: prefix.
  //
  // active:scale-[0.98] is the press acknowledgement: a tap previously had
  // no visual response at all until the color transition finished, which on
  // a phone reads as a dropped tap. Scale is a transform, so it composites
  // without touching layout, and it stays well inside the 0.95-1.05 band
  // that reads as "pressed" rather than as the button moving.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,transform] duration-(--motion-fast) ease-(--ease-enter) active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-card hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Every size meets the 44px touch-target minimum (Apple HIG /
        // Material) — this app's primary flow is a phone camera, so
        // mobile-first sizing applies everywhere, not just on small screens.
        default: 'h-11 px-4 py-2',
        sm: 'h-11 rounded-md px-3',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // Every async button in this app already swapped its label ("Saving…")
        // and set disabled by hand, which covers the double-submit half of the
        // problem but gives no sign the app is *doing* something — a slow
        // request just looked like a stuck button. `loading` adds the missing
        // spinner and takes over disabling so the two can't drift apart at a
        // call site. aria-busy announces the same thing to screen readers,
        // which never saw the label swap as a state change.
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* Slot needs exactly one child, so an asChild button never gets the
            spinner prepended — no call site combines the two, and silently
            breaking Children.only() would be worse than not supporting it. */}
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
