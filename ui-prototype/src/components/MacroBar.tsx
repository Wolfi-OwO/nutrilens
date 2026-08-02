import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  icon: LucideIcon;
  consumed: number;
  target: number;
  unit?: string;
  barColorClass: string;
  iconColorClass: string;
}

export function MacroBar({
  label,
  icon: Icon,
  consumed,
  target,
  unit = "g",
  barColorClass,
  iconColorClass,
}: Props) {
  const pct = Math.min(100, Math.round((consumed / target) * 100));

  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColorClass}`}>
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-stone-700">{label}</span>
          <span className="font-mono text-xs tabular-nums text-stone-500">
            <span className="font-semibold text-stone-800">{consumed}</span>
            {unit} of {target}
            {unit}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${barColorClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
