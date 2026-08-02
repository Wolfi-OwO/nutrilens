import { Camera, PenLine } from "lucide-react";

import type { MealSource } from "../data/mockData";

export function SourceBadge({ source }: { source: MealSource }) {
  const isAi = source === "AI_PHOTO";
  const Icon = isAi ? Camera : PenLine;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isAi ? "bg-brand-100 text-brand-700" : "bg-stone-100 text-stone-600"
      }`}
    >
      <Icon size={12} strokeWidth={2.25} />
      {isAi ? "AI photo" : "Manual"}
    </span>
  );
}
