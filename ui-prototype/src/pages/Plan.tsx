import { activePlan, user } from "../data/mockData";

const stats = [
  { label: "Daily calories", value: `${activePlan.dailyCalorieTarget} kcal` },
  { label: "Protein", value: `${activePlan.proteinTargetGrams} g` },
  { label: "Carbs", value: `${activePlan.carbTargetGrams} g` },
  { label: "Fat", value: `${activePlan.fatTargetGrams} g` },
];

export function Plan() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Your diet plan</h1>
        <p className="text-gray-500">
          Goal: {user.goal} &middot; active since {activePlan.startsAt}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-gray-900">Adjust targets</h2>
        <div className="space-y-4 text-sm text-gray-600">
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
          <p className="text-xs text-gray-400">
            Prototype only — editing is wired up once apps/api exists (see M3 milestone).
          </p>
        </div>
      </section>
    </div>
  );
}
