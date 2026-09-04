import { Barcode, Camera, Search } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import type { MealLogSource } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'

// Keyed by the API's own enum, so the message id derives from the value rather
// than from a second hand-maintained mapping. `variant` maps onto Badge's
// existing neutral/info palette — ai_photo gets `info` (cobalt) as the one
// source worth calling out, the other two stay `neutral`.
const SOURCE_META: Record<MealLogSource, { icon: typeof Camera; variant: BadgeProps['variant'] }> = {
  ai_photo: { icon: Camera, variant: 'info' },
  manual_search: { icon: Search, variant: 'neutral' },
  barcode: { icon: Barcode, variant: 'neutral' },
}

export function SourceBadge({ source }: { source: MealLogSource }) {
  const meta = SOURCE_META[source]
  const Icon = meta.icon

  // Icon-only below `sm`, label from `sm` up. Measured on a 320px capture: the
  // meal row's right-hand cluster (this badge + the kcal figure + the delete
  // button) took 185px of a 293px row, which left the FOOD NAME about 95px and
  // truncated it to five characters -- "Vollk...", "Ruehr...", "Curry...". The
  // name is the only thing that identifies the row, so the metadata yields
  // first. The label stays in the accessible name via sr-only, so the badge is
  // still announced as "Manuell"/"KI-Foto"/"Barcode" at every width.
  return (
    <Badge variant={meta.variant}>
      <Icon size={11} strokeWidth={2.25} />
      <span className="sr-only sm:not-sr-only">
        <FormattedMessage id={`source.${source}`} />
      </span>
    </Badge>
  )
}
