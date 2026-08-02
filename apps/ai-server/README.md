# nutrilens-ai-server

The isolated AI-detection service: food-photo recognition and nutrition
estimation. Called only by `apps/api` over an internal-only network path —
never reachable from the public internet or directly by clients. See
`../../organizational/adr/0001-two-server-split.md` for why this is a
separate service.

**No persistence.** This service holds no database and writes no uploaded
image to disk, by design.

## Development

```bash
python -m venv .venv && source .venv/bin/activate
make install
make dev     # uvicorn with reload on :8000
make lint
make test
```

## Status

Scaffold only: FastAPI app with a `/health` endpoint. Image preprocessing,
the `/predict` endpoint, and the actual recognition model land in follow-up
issues (see milestone M4).
