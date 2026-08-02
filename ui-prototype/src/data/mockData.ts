// All data in this file is hardcoded. ui-prototype has no backend — see
// organizational/adr/0001-two-server-split.md for what the real API will do.

export const user = {
  displayName: "Alex",
  goal: "Lose weight" as const,
};

export const activePlan = {
  dailyCalorieTarget: 2100,
  proteinTargetGrams: 150,
  carbTargetGrams: 210,
  fatTargetGrams: 65,
  startsAt: "2026-06-01",
};

export const today = {
  caloriesConsumed: 1340,
  proteinGrams: 92,
  carbGrams: 118,
  fatGrams: 41,
};

export type MealSource = "AI_PHOTO" | "MANUAL_SEARCH";

export interface LoggedMeal {
  id: string;
  name: string;
  loggedAt: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  source: MealSource;
}

export const todaysMeals: LoggedMeal[] = [
  {
    id: "m1",
    name: "Greek yogurt with berries",
    loggedAt: "08:15",
    calories: 280,
    proteinGrams: 24,
    carbGrams: 32,
    fatGrams: 6,
    source: "AI_PHOTO",
  },
  {
    id: "m2",
    name: "Grilled chicken bowl",
    loggedAt: "12:40",
    calories: 610,
    proteinGrams: 48,
    carbGrams: 58,
    fatGrams: 18,
    source: "AI_PHOTO",
  },
  {
    id: "m3",
    name: "Protein shake",
    loggedAt: "16:05",
    calories: 220,
    proteinGrams: 20,
    carbGrams: 14,
    fatGrams: 5,
    source: "MANUAL_SEARCH",
  },
  {
    id: "m4",
    name: "Almonds (30g)",
    loggedAt: "18:30",
    calories: 230,
    proteinGrams: 8,
    carbGrams: 14,
    fatGrams: 12,
    source: "MANUAL_SEARCH",
  },
];

export interface DetectedItem {
  foodName: string;
  estimatedPortionGrams: number;
  confidence: number;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

// Stand-in for a real response from apps/ai-server (see
// organizational/use-cases/ai-food-detection.md, UC-30).
export const mockAiPrediction: DetectedItem[] = [
  {
    foodName: "Grilled salmon fillet",
    estimatedPortionGrams: 150,
    confidence: 0.93,
    calories: 310,
    proteinGrams: 34,
    carbGrams: 0,
    fatGrams: 18,
  },
  {
    foodName: "Steamed broccoli",
    estimatedPortionGrams: 90,
    confidence: 0.88,
    calories: 32,
    proteinGrams: 3,
    carbGrams: 6,
    fatGrams: 0,
  },
  {
    foodName: "Jasmine rice",
    estimatedPortionGrams: 120,
    confidence: 0.76,
    calories: 156,
    proteinGrams: 3,
    carbGrams: 34,
    fatGrams: 0,
  },
];

export const weeklyTrend = [
  { day: "Mon", calories: 2050 },
  { day: "Tue", calories: 1980 },
  { day: "Wed", calories: 2210 },
  { day: "Thu", calories: 1890 },
  { day: "Fri", calories: 2340 },
  { day: "Sat", calories: 2480 },
  { day: "Sun", calories: 1340 },
];

export const weightTrend = [
  { date: "Jun 01", kg: 84.2 },
  { date: "Jun 08", kg: 83.6 },
  { date: "Jun 15", kg: 83.1 },
  { date: "Jun 22", kg: 82.7 },
  { date: "Jun 29", kg: 82.0 },
];

export const streak = { current: 12, best: 21 };
