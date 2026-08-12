import { Barcode, Camera, Search } from 'lucide-react'
import type { MealLogSource } from '@/types/api'
import { cn } from '@/lib/utils'

const SOURCE_META: Record<MealLogSource, { label: string; icon: typeof Camera; className: string }> = {
  ai_photo: { label: 'AI photo', icon: Camera, className: 'bg-secondary text-secondary-foreground' },
  manual_search: { label: 'Manual', icon: Search, className: 'bg-muted text-muted-foreground' },
  barcode: { label: 'Barcode', icon: Barcode, className: 'bg-muted text-muted-foreground' },
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
      {meta.label}
    </span>
  )
}
