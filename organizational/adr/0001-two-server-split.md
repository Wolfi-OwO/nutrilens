# ADR-0001: Split the AI-detection service from the main API server

## Status

Accepted

## Context

Nutrilens needs to run a food-recognition ML model against user-uploaded
photos. Two options were considered:

1. Run inference inside the main API server (`apps/api`).
2. Run inference as a separate, isolated service (`apps/ai-server`).

The ML stack (PyTorch, model weights, CUDA/CPU inference libraries) is a
large, fast-moving dependency surface compared to the main API server's
stack, and has no inherent need to touch the primary datastore, session
state, or user credentials.

## Decision

Run the AI-detection model as a standalone Python/FastAPI service with:

- No database of its own, no persistence of uploaded images or predictions.
- No route reachable from the public internet — only `apps/api` can call it,
  over an internal network segment.
- A narrow contract: image in, structured prediction out.

## Consequences

- A vulnerability or compromised dependency in the inference stack cannot
  reach user data directly — it has no credentials to the primary database
  and nothing worth exfiltrating (it holds nothing at rest).
- Deployment and scaling are independent: the AI server can be scaled by
  inference load (potentially GPU-backed) without scaling the API server,
  and vice versa.
- Adds one network hop and one more service to operate (health checks,
  circuit breaking, correlation IDs) — accepted as a deliberate cost; see
  [AI server failure handling](../activity-diagrams/ai-server-failure-handling.md)
  for how the API server stays functional when the AI server isn't.
- Local development requires running two services instead of one — mitigated
  with a single `docker compose up` covering both.
