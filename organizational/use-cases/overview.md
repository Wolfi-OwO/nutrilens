# Use Case Overview

## Actors

| Actor | Description |
| --- | --- |
| **User** | A person tracking their diet. Primary actor for nearly all use cases. |
| **Coach** *(later)* | A nutrition coach managing plans for multiple users. |
| **Admin** | Operates the platform: user management, moderation, system health. |
| **AI-Detection Server** | System actor — receives a photo, returns a structured prediction. Never initiates contact with a user directly. |

## Use case diagram

```plantuml
@startuml
left to right direction
actor User
actor Admin
actor "AI-Detection Server" as AI

rectangle Nutrilens {
  usecase "Register / Log in" as UC1
  usecase "Manage profile" as UC2
  usecase "Create / edit diet plan" as UC3
  usecase "Log meal via photo" as UC4
  usecase "Log meal manually" as UC5
  usecase "Correct AI prediction" as UC6
  usecase "View progress" as UC7
  usecase "Log body weight" as UC8
  usecase "Receive notifications" as UC9
  usecase "Manage users" as UC10
  usecase "Moderate content" as UC11
  usecase "Run food inference" as UC12
}

User --> UC1
User --> UC2
User --> UC3
User --> UC4
User --> UC5
User --> UC6
User --> UC7
User --> UC8
User --> UC9

Admin --> UC10
Admin --> UC11

UC4 ..> UC12 : includes
AI --> UC12
UC6 ..> UC4 : extends
@enduml
```

## Use case index

- [User account management](user-account-management.md)
- [Diet plan management](diet-plan-management.md)
- [Meal logging](meal-logging.md)
- [AI food detection](ai-food-detection.md)
- [Progress tracking](progress-tracking.md)
- [Notifications](notifications.md)
- [Admin management](admin-management.md)
