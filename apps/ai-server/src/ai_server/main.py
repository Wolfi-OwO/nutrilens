from fastapi import FastAPI

app = FastAPI(
    title="nutrilens AI-detection server",
    description=(
        "Internal-only food-photo recognition service. Never reachable from the "
        "public internet — see organizational/adr/0001-two-server-split.md."
    ),
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
