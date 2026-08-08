"""
Structured (JSON) logging — issue #41.

NFR-SEC-02 / NFR-PRIV-02: this server persists no user data and logs no
image content. Nothing in this module (or any call site of the logger it
configures) may be passed an image, a filename, or an uploaded file's raw
bytes — only request metadata (method, path, status, latency) and a
prediction's numeric confidence.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        extra = getattr(record, "fields", None)
        if extra:
            payload.update(extra)
        return json.dumps(payload)


def configure_logging() -> logging.Logger:
    logger = logging.getLogger("ai_server")
    if logger.handlers:
        return logger  # Already configured — e.g. re-imported under a test runner.

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger


logger = configure_logging()


def log_request(*, method: str, path: str, status_code: int, duration_ms: float) -> None:
    """Logged for every request, regardless of route."""
    logger.info(
        "request completed",
        extra={
            "fields": {
                "method": method,
                "path": path,
                "status_code": status_code,
                "duration_ms": round(duration_ms, 2),
            }
        },
    )


def log_prediction(*, is_confident: bool, top_confidence: float, duration_ms: float) -> None:
    """
    Logged once per successful /predict call, in addition to log_request.

    Deliberately excludes: the uploaded filename, the image bytes, the
    predicted label (food names aren't sensitive, but the point of this
    function's narrow signature is that it's structurally impossible to
    pass anything else in) — only the confidence issue #35's threshold
    already computed, and how long inference took.
    """
    logger.info(
        "prediction completed",
        extra={
            "fields": {
                "is_confident": is_confident,
                "top_confidence": round(top_confidence, 4),
                "duration_ms": round(duration_ms, 2),
            }
        },
    )


class Timer:
    """`with Timer() as t: ...` then `t.elapsed_ms`."""

    def __enter__(self) -> Timer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_exc_info: object) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000
