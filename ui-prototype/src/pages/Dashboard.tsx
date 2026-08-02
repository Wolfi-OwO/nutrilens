import { Beef, Droplet, Wheat } from "lucide-react";

import { CalorieRing } from "../components/CalorieRing";
import { MacroBar } from "../components/MacroBar";
import { SourceBadge } from "../components/SourceBadge";
import { activePlan, today, todaysMeals, user } from "../data/mockData";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6 lg:px-8 lg:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {greeting()}, {user.displayName}
        </h1>
        <p className="mt-0.5 text-stone-500">Here's where today stands.</p>
      </header>

      <section className="flex flex-col items-center gap-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-stretch">
        <div className="flex items-center justify-center sm:border-r sm:border-stone-100 sm:pr-6">
          <CalorieRing consumed={today.caloriesConsumed} target={activePlan.dailyCalorieTarget} />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-stone-500">Today's intake</p>
            <p className="font-mono text-sm tabular-nums text-stone-500">
              <span className="font-semibold text-stone-800">
                {today.caloriesConsumed.toLocaleString()}
              </span>{" "}
              / {activePlan.dailyCalorieTarget.toLocaleString()} kcal
            </p>
          </div>
          <div className="space-y-3">
            <MacroBar
              label="Protein"
              icon={Beef}
              consumed={today.proteinGrams}
              target={activePlan.proteinTargetGrams}
              barColorClass="bg-brand-500"
              iconColorClass="bg-brand-50 text-brand-600"
            />
            <MacroBar
              label="Carbs"
              icon={Wheat}
              consumed={today.carbGrams}
              target={activePlan.carbTargetGrams}
              barColorClass="bg-accent-500"
              iconColorClass="bg-accent-100 text-accent-600"
            />
            <MacroBar
              label="Fat"
              icon={Droplet}
              consumed={today.fatGrams}
              target={activePlan.fatTargetGrams}
              barColorClass="bg-sky-500"
              iconColorClass="bg-sky-50 text-sky-600"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-stone-900">Today's meals</h2>
        <ul className="space-y-2">
          {todaysMeals.map((meal) => (
            <li
              key={meal.id}
              className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-800">{meal.name}</p>
                <p className="text-xs text-stone-400">{meal.loggedAt}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <SourceBadge source={meal.source} />
                <span className="whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums text-stone-700">
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
