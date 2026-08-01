# Activity Diagram: AI Server Failure Handling

Enterprise-grade behavior requires the primary logging path to degrade
gracefully when the AI-detection service is unavailable, slow, or wrong —
see [ADR-0001](../adr/0001-two-server-split.md).

```plantuml
@startuml
start
:apps/api sends photo to apps/ai-server;
if (Response within timeout (3s p95 budget)?) then (no)
  :Cancel request;
  :Log AI-server latency incident;
  :Offer user manual logging fallback;
  stop
endif
if (apps/ai-server reachable?) then (no)
  :Circuit breaker opens after N consecutive failures;
  :Skip AI path entirely for a cooldown window;
  :Offer user manual logging fallback;
  stop
endif
if (HTTP error from apps/ai-server?) then (yes)
  :Log error with correlation ID;
  :Offer user manual logging fallback;
  stop
endif
:Return structured prediction to user;
stop
@enduml
```
