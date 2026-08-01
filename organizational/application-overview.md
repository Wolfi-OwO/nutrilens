# Application Overview

## Purpose

Nutrilens helps a user follow a diet plan without the friction of manual food
diaries. The core loop: photograph a meal, get an AI-generated estimate of
its contents and macros within seconds, confirm or correct it, and see it
reflected against a personal daily target immediately.

## Key features

- **Diet plans** — a user (optionally with input from a coach/admin) sets
  calorie and macro targets, either manually or via a guided goal wizard
  (lose/maintain/gain weight, activity level, dietary restrictions).
- **Photo-based meal logging** — the centerpiece: a photo is sent to the
  AI-detection service, which returns identified food items, estimated
  portions, and a macro/calorie estimate. The user confirms or edits before
  it's logged.
- **Manual meal logging** — a fallback/alternative path via a searchable food
  database, for when a photo isn't practical or the AI estimate is wrong.
- **Progress tracking** — daily/weekly/monthly trends against targets, weight
  log, adherence streaks.
- **Notifications** — logging reminders, goal-check-ins, streak nudges.

**Later on:**

- **Coach/admin dashboards** — for a nutrition coach managing multiple
  clients' plans.
- **Barcode scanning** — packaged-food lookup as a third logging path.
- **Wearable integration** — activity and weight data from third-party
  devices feeding into the target calculation.

## Architecture

Two independently deployable services, plus a frontend. See
[README.md](../README.md#why-a-two-server-architecture) for the reasoning
behind the split.

```plantuml
@startuml
actor User

package "apps/api (Node.js/TypeScript)" {
  [Auth]
  [User & Plan Service]
  [Meal Log Service]
  [Notification Service]
  database "PostgreSQL" as DB
}

package "apps/ai-server (Python/FastAPI)" {
  [Inference Endpoint]
  [Food Recognition Model]
}

User --> [Auth]
User --> [User & Plan Service]
User --> [Meal Log Service]
[Meal Log Service] --> [Inference Endpoint] : photo (internal network only)
[Inference Endpoint] --> [Food Recognition Model]
[Inference Endpoint] --> [Meal Log Service] : structured prediction, no persistence
[Auth] --> DB
[User & Plan Service] --> DB
[Meal Log Service] --> DB
[Notification Service] --> DB
@enduml
```

### Core domain model

```plantuml
@startuml
class User {
    UUID id
    String email
    String passwordHash
    String displayName
    DateTime createdAt
    DateTime updatedAt
    ROLE role
    STATUS status
}

enum ROLE {
    USER
    COACH
    ADMIN
}

enum STATUS {
    ACTIVE
    SUSPENDED
    DELETED
}

class DietPlan {
    UUID id
    UUID userId
    Int dailyCalorieTarget
    Int proteinTargetGrams
    Int carbTargetGrams
    Int fatTargetGrams
    GOAL goal
    DateTime startsAt
    DateTime endsAt
}

enum GOAL {
    LOSE_WEIGHT
    MAINTAIN
    GAIN_WEIGHT
}

class MealLog {
    UUID id
    UUID userId
    UUID dietPlanId
    LOG_SOURCE source
    DateTime loggedAt
    Int totalCalories
    Int proteinGrams
    Int carbGrams
    Int fatGrams
    Boolean userCorrected
}

enum LOG_SOURCE {
    AI_PHOTO
    MANUAL_SEARCH
    BARCODE
}

class MealLogItem {
    UUID id
    UUID mealLogId
    String foodName
    Float portionGrams
    Float confidence
    Int calories
}

class WeightEntry {
    UUID id
    UUID userId
    Float weightKg
    DateTime recordedAt
}

User "1" -- "0..*" DietPlan
User "1" -- "0..*" MealLog
DietPlan "1" -- "0..*" MealLog
MealLog "1" -- "1..*" MealLogItem
User "1" -- "0..*" WeightEntry
@enduml
```

## Related documents

- [Use cases](use-cases/overview.md)
- [Activity diagrams](activity-diagrams/)
- [Requirements](requirements/)
- [Architecture decision records](adr/)
