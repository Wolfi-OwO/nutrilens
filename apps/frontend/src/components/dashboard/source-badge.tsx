import { Barcode, Camera, Search } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import type { MealLogSource } from '@/types/api'
import { cn } from '@/lib/utils'

// Keyed by the API's own enum, so the message id derives from the value rather
// than from a second hand-maintained mapping.
const SOURCE_META: Record<MealLogSource, { icon: typeof Camera; className: string }> = {
  ai_photo: { icon: Camera, className: 'bg-secondary text-secondary-foreground' },
  manual_search: { icon: Search, className: 'bg-muted text-muted-foreground' },
  barcode: { icon: Barcode, className: 'bg-muted text-muted-foreground' },
}

export function SourceBadge({ source }: { source: MealLogSource }) {
  const meta = SOURCE_META[source]
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        meta.className,
      )}
    >
      <Icon size={11} strokeWidth={2.25} />
      <FormattedMessage id={`source.${source}`} />
    </span>
  )
}
