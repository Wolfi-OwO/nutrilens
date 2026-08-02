import { MacroBar } from "../components/MacroBar";
import { SourceBadge } from "../components/SourceBadge";
import { activePlan, streak, today, todaysMeals, user } from "../data/mockData";

export function Dashboard() {
  const remaining = activePlan.dailyCalorieTarget - today.caloriesConsumed;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">
          Good evening, {user.displayName}
        </h1>
        <p className="text-gray-500">
          {streak.current}-day streak &middot; best {streak.best}
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-gray-500">Remaining today</p>
            <p className="text-3xl font-bold text-gray-900">
              {remaining.toLocaleString()}{" "}
              <span className="text-base font-normal text-gray-400">kcal</span>
            </p>
          </div>
          <p className="text-sm text-gray-500">
            {today.caloriesConsumed.toLocaleString()} / {activePlan.dailyCalorieTarget.toLocaleString()} kcal
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <MacroBar
            label="Protein"
            consumed={today.proteinGrams}
            target={activePlan.proteinTargetGrams}
            colorClass="bg-brand-500"
          />
          <MacroBar
            label="Carbs"
            consumed={today.carbGrams}
            target={activePlan.carbTargetGrams}
            colorClass="bg-amber-500"
          />
          <MacroBar
            label="Fat"
            consumed={today.fatGrams}
            target={activePlan.fatTargetGrams}
            colorClass="bg-sky-500"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Today's meals</h2>
        <ul className="space-y-2">
          {todaysMeals.map((meal) => (
            <li
              key={meal.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
            >
              <div>
                <p className="font-medium text-gray-900">{meal.name}</p>
                <p className="text-xs text-gray-500">{meal.loggedAt}</p>
              </div>
              <div className="flex items-center gap-3">
                <SourceBadge source={meal.source} />
                <span className="w-16 text-right text-sm font-medium text-gray-700">
                  {meal.calories} kcal
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
