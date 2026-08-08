# syntax=docker/dockerfile:1

# The model (ADR-0002) is downloaded and cached at BUILD time, not on first
# request: a container meant to be reachable only from apps/api over an
# internal network (ADR-0001) shouldn't need outbound internet access at
# runtime just to become ready, and it removes the cold-start download from
# the request path entirely.

FROM python:3.11-slim AS builder
WORKDIR /app

COPY pyproject.toml README.md ./
COPY src src
RUN pip install --no-cache-dir .

RUN python -c "from ai_server.model import get_classifier; get_classifier()"

FROM python:3.11-slim AS runtime
WORKDIR /app

RUN useradd --create-home --uid 1000 appuser
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
# Matches Settings.model_cache_dir (tempfile.gettempdir() / "nutrilens-ai-server" / "model-cache").
COPY --from=builder /tmp/nutrilens-ai-server /tmp/nutrilens-ai-server
COPY src src

RUN chown -R appuser:appuser /tmp/nutrilens-ai-server
USER appuser

EXPOSE 8000
CMD ["uvicorn", "ai_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
