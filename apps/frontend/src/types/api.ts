// Mirrors apps/api's domain models — dates as ISO strings, not Date, since
// that's what actually crosses the wire as JSON.

export type UserRole = 'user' | 'coach' | 'admin'

export type OAuthProviderName = 'github' | 'google' | 'microsoft'

export interface PublicUser {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: 'active' | 'suspended' | 'deleted'
  createdAt: string
  updatedAt: string
  avatarUrl: string | null
  avatarUploaded: boolean
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

export interface PerHundredGramMacros {
  calories: number | null
  proteinGrams: number | null
  carbGrams: number | null
  fatGrams: number | null
}

export interface PhotoPrediction {
  label: string
  confidence: number
  macros?: PerHundredGramMacros
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

// #100 — GET /users search/filter/pagination.
export interface UserListResult {
  users: PublicUser[]
  total: number
  page: number
  pageSize: number
}

// #102 — GET /admin/stats.
export interface AdminStats {
  usersByRole: Record<UserRole, number>
  usersByStatus: Record<PublicUser['status'], number>
  activeDietPlans: number
  mealLogsLast7Days: number
  mealLogsLast30Days: number
  signupsLast30Days: { date: string; count: number }[]
}

// #103 — GET /admin/audit-log.
export type AdminAuditAction = 'role_change' | 'status_change'

export interface AdminAuditLogEntry {
  id: string
  actorId: string
  targetUserId: string
  action: AdminAuditAction
  previousValue: string
  newValue: string
  createdAt: string
}

export interface AuditLogResult {
  entries: AdminAuditLogEntry[]
  total: number
  page: number
  pageSize: number
}

export interface ApiErrorBody {
  error: string
  message: string
  statusCode: number
  issues?: { path: string; message: string }[]
}
