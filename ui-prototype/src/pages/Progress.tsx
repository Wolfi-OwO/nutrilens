import { streak, weeklyTrend, weightTrend } from "../data/mockData";

export function Progress() {
  const maxCalories = Math.max(...weeklyTrend.map((d) => d.calories));
  const minWeight = Math.min(...weightTrend.map((d) => d.kg));
  const maxWeight = Math.max(...weightTrend.map((d) => d.kg));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Progress</h1>
        <p className="text-gray-500">
          {streak.current}-day logging streak &middot; personal best {streak.best}
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-gray-900">Calories this week</h2>
        <div className="flex h-40 items-end justify-between gap-2">
          {weeklyTrend.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-brand-500"
                style={{ height: `${(d.calories / maxCalories) * 100}%` }}
                title={`${d.calories} kcal`}
              />
              <span className="text-xs text-gray-500">{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-gray-900">Weight trend</h2>
        <div className="flex h-32 items-end justify-between gap-3">
          {weightTrend.map((d) => {
            const range = maxWeight - minWeight || 1;
            const heightPct = 20 + ((d.kg - minWeight) / range) * 80;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-sky-500"
                  style={{ height: `${heightPct}%` }}
                  title={`${d.kg} kg`}
                />
                <span className="text-xs text-gray-500">{d.date}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-gray-500">
          {(weightTrend[0].kg - weightTrend[weightTrend.length - 1].kg).toFixed(1)} kg since start
        </p>
      </section>
    </div>
  );
}
