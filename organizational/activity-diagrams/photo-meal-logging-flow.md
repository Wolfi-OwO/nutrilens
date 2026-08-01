# Activity Diagram: Photo Meal Logging

The central flow of the product — see
[UC-21](../use-cases/meal-logging.md#uc-21--log-meal-via-photo) and
[UC-30](../use-cases/ai-food-detection.md#uc-30--run-food-inference).

```plantuml
@startuml
start
:User captures/uploads meal photo;
:apps/api validates image (format, size);
:apps/api strips EXIF metadata;
if (Valid?) then (no)
  :Reject with error;
  stop
endif
:apps/api forwards image to apps/ai-server\n(internal network only);
:apps/ai-server runs food recognition model;
if (Confident match found?) then (no)
  :Return "no confident match";
  :apps/api offers manual logging;
  stop
else (yes)
  :Return structured prediction\n(items, portions, macros, confidence);
endif
:apps/ai-server discards image from memory;
:apps/api presents prediction to user;
if (User accepts as-is?) then (yes)
  :Create MealLog (source=AI_PHOTO, userCorrected=false);
else (no)
  :User edits items/portions;
  :Create MealLog (source=AI_PHOTO, userCorrected=true);
endif
:Recalculate daily totals against active diet plan;
stop
@enduml
```
