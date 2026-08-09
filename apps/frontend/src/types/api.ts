// Mirrors apps/api's domain models — dates as ISO strings, not Date, since
// that's what actually crosses the wire as JSON.

export type UserRole = 'user' | 'coach' | 'admin'

export interface PublicUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: 'active' | 'suspended' | 'deleted'
  createdAt: string
  updatedAt: string
}

export type DietPlanGoal = 'lose_weight' | 'maintain' | 'gain_weight'

export interface DietPlan {
  id: string
  userId: string
  dailyCalorieTarget: number
  proteinTargetGrams: number
  carbTargetGrams: number
  fatTargetGrams: number
  goal: DietPlanGoal
  startsAt: string
  endsAt: string | null
  createdAt: string
  updatedAt: string
}

export type MealLogSource = 'ai_photo' | 'manual_search' | 'barcode'

export interface MealLogItem {
  id: string
  mealLogId: string
  foodName: string
  portionGrams: number
  confidence: number
  calories: number
  proteinGrams: number
  carbGrams: number
  fatGrams: number
  createdAt: string
}

export interface MealLog {
  id: string
  userId: string
  dietPlanId: string
  source: MealLogSource
  loggedAt: string
  totalCalories: number
  proteinGrams: number
  carbGrams: number
  fatGrams: number
  userCorrected: boolean
  createdAt: string
  updatedAt: string
  items: MealLogItem[]
}

export interface WeightEntry {
  id: string
  userId: string
  weightKg: number
  recordedAt: string
  createdAt: string
}

export interface PhotoPrediction {
  label: string
  confidence: number
}

export interface PhotoPredictionResponse {
  available: boolean
  predictions?: PhotoPrediction[]
  isConfident?: boolean
  reason?: string
}

export interface BuildInfo {
  version: string
  revision: string
  buildDate: string
  repositoryUrl: string
}

export interface ApiErrorBody {
  error: string
  message: string
  statusCode: number
  issues?: { path: string; message: string }[]
}
