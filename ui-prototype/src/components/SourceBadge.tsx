import type { MealSource } from "../data/mockData";

export function SourceBadge({ source }: { source: MealSource }) {
  const isAi = source === "AI_PHOTO";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isAi ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isAi ? "\u{1F4F7} AI photo" : "\u{1F50D} Manual"}
    </span>
  );
}
