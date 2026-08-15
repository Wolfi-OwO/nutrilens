import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// Only <Button> and <Input> declared a focus style. Every link, nav item and
// icon-only button in the chrome fell back to the UA outline — the
// `* { outline-ring/50 }` base rule recolors that outline but sets no width,
// so what a keyboard user actually saw depended on the browser. This is the
// one ring, so focus looks identical wherever it lands.
//
// ring-offset-card, not -background: everything using this sits on a card or
// sidebar surface, and an offset ring punches a hole in the ring's colour
// with whatever ring-offset-color says — get it wrong and the gap is the
// wrong shade rather than invisible.
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'
