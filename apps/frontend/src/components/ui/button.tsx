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
        // hover states use solid --primary-hover/--accent-hover/--destructive-
        // hover, never an alpha-blended `/90` — that composes with whatever
        // sits behind the button, and its settled color measured 3.92:1
        // (primary/accent) and 4.29:1 (destructive) against white text on
        // --background in the old palette, both under the 4.5:1 AA floor
        // (see index.css). Werkbank's --accent (lime) is no longer the same
        // value as --primary (cobalt) — the accent variant used to alias
        // hover:bg-primary-hover because the two tokens were byte-identical,
        // which would now make the button change hue mid-hover. --accent-
        // hover exists precisely so this stays a solid fill without that flip.
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        accent: 'bg-accent text-accent-foreground hover:bg-accent-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        outline: 'border border-input bg-card hover:bg-muted',
        // --secondary has no dedicated hover token — it equals --muted in
        // both themes, so hovering to bg-muted would be visually inert.
        // color-mix keeps the fill solid (never an alpha blend composing
        // with whatever sits behind the button) while darkening on light and
        // lightening on dark, matching primary/accent's hover direction.
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary),var(--foreground)_12%)]',
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
