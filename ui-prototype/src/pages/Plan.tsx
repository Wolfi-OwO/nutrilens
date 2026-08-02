import { Beef, Droplet, Flame, Info, Wheat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { activePlan, user } from "../data/mockData";

const stats: { label: string; value: string; icon: LucideIcon }[] = [
  { label: "Daily calories", value: `${activePlan.dailyCalorieTarget} kcal`, icon: Flame },
  { label: "Protein", value: `${activePlan.proteinTargetGrams} g`, icon: Beef },
  { label: "Carbs", value: `${activePlan.carbTargetGrams} g`, icon: Wheat },
  { label: "Fat", value: `${activePlan.fatTargetGrams} g`, icon: Droplet },
];

export function Plan() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6 lg:px-8 lg:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Your diet plan</h1>
        <p className="mt-0.5 text-stone-500">
          Goal: {user.goal} &middot; active since {activePlan.startsAt}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-4 text-center shadow-[var(--shadow-card)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <stat.icon size={17} strokeWidth={2} />
            </span>
            <p className="font-mono text-lg font-bold tabular-nums text-stone-900">{stat.value}</p>
            <p className="text-xs text-stone-500">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 font-bold tracking-tight text-stone-900">Adjust targets</h2>
        <div className="space-y-4 text-sm text-stone-600">
          <label className="block">
            Daily calorie target
            <input
              type="range"
              min={1200}
              max={3500}
              defaultValue={activePlan.dailyCalorieTarget}
              className="mt-2 w-full accent-brand-600"
              disabled
            />
          </label>
          <p className="flex items-center gap-1.5 text-xs text-stone-400">
            <Info size={13} strokeWidth={2} />
            Prototype only — editing is wired up once apps/api exists (see M3 milestone).
          </p>
        </div>
      </section>
    </div>
  );
}
