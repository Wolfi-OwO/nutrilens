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

`/health` (liveness) and `/ready` (model loaded) endpoints, plus `/predict`
— identifies the food in an uploaded photo using a Swin Transformer
fine-tuned on Food-101, downloaded and cached from the Hugging Face Hub on
first use (see `organizational/adr/0002-food-recognition-model.md`).
Remaining M4 work: a Dockerfile with the model pre-baked or warmed at build
time (#38), a load/latency test (#40), structured logging (#41), and API
contract docs (#42).
