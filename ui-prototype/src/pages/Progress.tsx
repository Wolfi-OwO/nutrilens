import { streak, weeklyTrend, weightTrend } from "../data/mockData";

const CALORIE_BAR_AREA_PX = 128;
const WEIGHT_BAR_AREA_PX = 96;

export function Progress() {
  const maxCalories = Math.max(...weeklyTrend.map((d) => d.calories));
  const minWeight = Math.min(...weightTrend.map((d) => d.kg));
  const maxWeight = Math.max(...weightTrend.map((d) => d.kg));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6 lg:px-8 lg:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Progress</h1>
        <p className="mt-0.5 text-stone-500">Personal best {streak.best} days</p>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-5 font-bold tracking-tight text-stone-900">Calories this week</h2>
        <div className="flex items-end justify-between gap-2">
          {weeklyTrend.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col items-center gap-2">
              <div
                className="relative flex w-full items-end justify-center"
                style={{ height: CALORIE_BAR_AREA_PX }}
              >
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {d.calories}
                </span>
                <div
                  className="w-full rounded-t-md bg-brand-500 transition-colors group-hover:bg-brand-600"
                  style={{ height: (d.calories / maxCalories) * CALORIE_BAR_AREA_PX }}
                />
              </div>
              <span className="text-xs font-medium text-stone-400">{d.day}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-5 font-bold tracking-tight text-stone-900">Weight trend</h2>
        <div className="flex items-end justify-between gap-3">
          {weightTrend.map((d) => {
            const range = maxWeight - minWeight || 1;
            const heightFraction = 0.2 + ((d.kg - minWeight) / range) * 0.8;
            return (
              <div key={d.date} className="group flex flex-1 flex-col items-center gap-2">
                <div
                  className="relative flex w-full items-end justify-center"
                  style={{ height: WEIGHT_BAR_AREA_PX }}
                >
                  <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {d.kg}kg
                  </span>
                  <div
                    className="w-full rounded-t-md bg-sky-500 transition-colors group-hover:bg-sky-600"
                    style={{ height: heightFraction * WEIGHT_BAR_AREA_PX }}
                  />
                </div>
                <span className="text-xs font-medium text-stone-400">{d.date}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 border-t border-stone-100 pt-3 text-sm text-stone-500">
          <span className="font-mono font-semibold tabular-nums text-stone-800">
            {(weightTrend[0].kg - weightTrend[weightTrend.length - 1].kg).toFixed(1)} kg
          </span>{" "}
          since start
        </p>
      </section>
    </div>
  );
}
