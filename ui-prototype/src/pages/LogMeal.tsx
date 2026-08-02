import { Camera, Check, Loader2, Search } from "lucide-react";
import { useState } from "react";

import { mockAiPrediction } from "../data/mockData";

type Stage = "idle" | "analyzing" | "result" | "confirmed";

export function LogMeal() {
  const [stage, setStage] = useState<Stage>("idle");

  function simulateUpload() {
    setStage("analyzing");
    // Prototype only — a real upload calls apps/api, which forwards to
    // apps/ai-server. See organizational/activity-diagrams/photo-meal-logging-flow.md.
    setTimeout(() => setStage("result"), 1400);
  }

  const totalCalories = mockAiPrediction.reduce((sum, item) => sum + item.calories, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6 lg:px-8 lg:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Log a meal</h1>
        <p className="mt-0.5 text-stone-500">A photo goes to the AI-detection server for analysis.</p>
      </header>

      {stage === "idle" && (
        <div className="space-y-4">
          <button
            onClick={simulateUpload}
            className="group flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white p-10 text-stone-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors group-hover:bg-brand-100 group-hover:text-brand-600">
              <Camera size={24} strokeWidth={1.75} />
            </span>
            <span className="font-medium text-stone-700">Take or upload a photo</span>
            <span className="text-xs text-stone-400">Prototype — simulates the AI response</span>
          </button>
          <div className="flex items-center gap-3 text-xs font-medium text-stone-400">
            <span className="h-px flex-1 bg-stone-200" />
            or
            <span className="h-px flex-1 bg-stone-200" />
          </div>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 font-medium text-stone-700 transition-colors hover:bg-stone-50">
            <Search size={16} strokeWidth={2} />
            Search food database manually
          </button>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white p-10 text-stone-500">
          <Loader2 size={28} strokeWidth={2} className="animate-spin text-brand-600" />
          <p className="font-medium text-stone-700">Analyzing photo…</p>
          <p className="text-xs text-stone-400">apps/api &rarr; apps/ai-server</p>
        </div>
      )}

      {(stage === "result" || stage === "confirmed") && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold tracking-tight text-stone-900">AI prediction</h2>
              <span className="font-mono text-sm tabular-nums text-stone-500">
                {totalCalories} kcal total
              </span>
            </div>
            <ul className="divide-y divide-stone-100">
              {mockAiPrediction.map((item) => (
                <li key={item.foodName} className="flex items-center justify-between py-3 text-sm first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-stone-800">{item.foodName}</p>
                    <p className="text-xs text-stone-400">{item.estimatedPortionGrams}g estimated</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                        item.confidence >= 0.85
                          ? "bg-brand-100 text-brand-700"
                          : "bg-accent-100 text-accent-600"
                      }`}
                    >
                      {Math.round(item.confidence * 100)}%
                    </span>
                    <span className="whitespace-nowrap text-right font-mono font-semibold tabular-nums text-stone-700">
                      {item.calories} kcal
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {stage === "result" ? (
            <div className="flex gap-3">
              <button
                onClick={() => setStage("confirmed")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Check size={16} strokeWidth={2.5} />
                Confirm & log
              </button>
              <button className="flex-1 rounded-xl border border-stone-200 bg-white py-3 font-medium text-stone-700 transition-colors hover:bg-stone-50">
                Edit items
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-brand-50 p-4 text-center font-medium text-brand-700">
              <Check size={18} strokeWidth={2.5} />
              Logged to today's meals.
            </div>
          )}

          {stage === "result" && (
            <button
              onClick={() => setStage("idle")}
              className="w-full text-center text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              Discard and retake photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
