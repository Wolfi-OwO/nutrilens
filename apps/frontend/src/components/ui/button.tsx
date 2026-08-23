import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // No shadow by default — structure comes from the fill/border, not
  // elevation (see index.css). transition-colors respects prefers-reduced-
  // motion globally via Tailwind's motion-safe defaults being absent here;
  // color transitions aren't motion, only transform/opacity are gated.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer",
  {
    variants: {
      variant: {
        // hover states use solid --primary-hover/--destructive-hover, not an
        // alpha-blended `/90` — that used to compose with whatever sat behind
        // the button, and its settled color measured 3.92:1 (primary/accent)
        // and 4.29:1 (destructive) against white text on --background in
        // light mode, both under the 4.5:1 AA floor (see index.css). Accent
        // reuses primary-hover: --accent already equals --primary verbatim
        // in both themes (see index.css), so a separate accent-hover token
        // would just be the same value under a second name.
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        accent: 'bg-accent text-accent-foreground hover:bg-primary-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
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
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { buttonVariants }
