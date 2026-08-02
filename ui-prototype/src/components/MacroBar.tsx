interface Props {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  colorClass: string;
}

export function MacroBar({ label, consumed, target, unit = "g", colorClass }: Props) {
  const pct = Math.min(100, Math.round((consumed / target) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span>
          {consumed}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
