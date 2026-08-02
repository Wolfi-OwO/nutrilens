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
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Log a meal</h1>
        <p className="text-gray-500">Photo goes to the AI-detection server for analysis.</p>
      </header>

      {stage === "idle" && (
        <div className="space-y-4">
          <button
            onClick={simulateUpload}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-10 text-gray-500 transition-colors hover:border-brand-500 hover:text-brand-600"
          >
            <span className="text-4xl" aria-hidden="true">
              {"\u{1F4F7}"}
            </span>
            <span className="font-medium">Take or upload a photo</span>
            <span className="text-xs text-gray-400">(prototype — simulates the AI response)</span>
          </button>
          <p className="text-center text-sm text-gray-400">or</p>
          <button className="w-full rounded-xl border border-gray-200 bg-white py-3 font-medium text-gray-700 hover:bg-gray-50">
            {"\u{1F50D}"} Search food database manually
          </button>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-10 text-gray-500">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="font-medium">Analyzing photo…</p>
          <p className="text-xs text-gray-400">apps/api &rarr; apps/ai-server</p>
        </div>
      )}

      {(stage === "result" || stage === "confirmed") && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">AI prediction</h2>
              <span className="text-sm text-gray-500">{totalCalories} kcal total</span>
            </div>
            <ul className="space-y-3">
              {mockAiPrediction.map((item) => (
                <li key={item.foodName} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{item.foodName}</p>
                    <p className="text-xs text-gray-400">{item.estimatedPortionGrams}g estimated</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.confidence >= 0.85
                          ? "bg-brand-100 text-brand-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {Math.round(item.confidence * 100)}%
                    </span>
                    <span className="w-16 text-right font-medium text-gray-700">
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
                className="flex-1 rounded-xl bg-brand-600 py-3 font-medium text-white hover:bg-brand-700"
              >
                Confirm & log
              </button>
              <button className="flex-1 rounded-xl border border-gray-200 bg-white py-3 font-medium text-gray-700 hover:bg-gray-50">
                Edit items
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-brand-50 p-4 text-center text-brand-700">
              {"✓"} Logged to today's meals.
            </div>
          )}

          {stage === "result" && (
            <button
              onClick={() => setStage("idle")}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600"
            >
              Discard and retake photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
