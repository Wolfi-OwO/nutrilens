from fastapi import FastAPI, HTTPException, Request
from starlette.responses import Response

from ai_server.logging_config import Timer, log_request
from ai_server.model import get_classifier
from ai_server.predict_routes import router as predict_router

app = FastAPI(
    title="nutrilens AI-detection server",
    description=(
        "Internal-only food-photo recognition service. Never reachable from the "
        "public internet — see organizational/adr/0001-two-server-split.md."
    ),
    version="0.1.0",
)

app.include_router(predict_router)


@app.middleware("http")
async def log_every_request(request: Request, call_next: object) -> Response:
    """Issue #41: method/path/status/latency for every request — see logging_config.py."""
    with Timer() as timer:
        response: Response = await call_next(request)  # type: ignore[operator]
    log_request(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=timer.elapsed_ms,
    )
    return response


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness: the process is up. Does not imply the model is loaded."""
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    """
    Readiness: the model is downloaded, loaded, and able to serve `/predict`.

    Distinct from `/health` on purpose — an orchestrator should keep routing
    traffic to a live-but-not-yet-ready replica's `/health` while it's still
    downloading the model on a cold start, but hold off sending it `/predict`
    requests until this returns 200.
    """
    try:
        get_classifier()
    except Exception as error:  # any load failure at all means "not ready"
        raise HTTPException(status_code=503, detail="Model is not ready.") from error
    return {"status": "ready"}
