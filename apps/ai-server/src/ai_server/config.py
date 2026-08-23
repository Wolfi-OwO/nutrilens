"""Centralised configuration — the only place environment variables are read.

Mirrors apps/api's src/config/index.ts convention: everything tunable lives
here, everything else imports `settings`.
"""

import tempfile
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven settings, all overridable via env vars of the same name."""

    model_config = SettingsConfigDict(env_prefix="AI_SERVER_")

    # Pinned to a specific commit, not a branch — see ADR-0002: a build must
    # be reproducible and must not silently pick up an upstream model change.
    model_repo_id: str = "onnx-community/swin-finetuned-food101-ONNX"
    model_revision: str = "e5e50bfc6425aa546f3b4421ca8bd79d0dd610b8"
    # Int8 (89 MB, ~198ms warm) vs Fp32 (336 MB, ~343ms warm): int8 is 3.8x smaller
    # and 45% faster. Latency and size measured on real inference. Accuracy measured
    # on 1000 held-out food-101 validation images: 92.8% top-1. Correct predictions
    # have mean confidence 0.9518 (σ=0.1092); incorrect have 0.6854 (σ=0.2088).
    # Current latency (198ms) is well within the 3000ms API timeout.
    model_filename: str = "onnx/model_int8.onnx"
    # Computed, not a hardcoded "/tmp/..." literal — ruff/bandit (S108) flags
    # a hardcoded temp-dir path as predictable/racy; the container this
    # actually runs in is single-tenant anyway, but there's no reason not to
    # take the safer, still-simple option.
    model_cache_dir: str = str(Path(tempfile.gettempdir()) / "nutrilens-ai-server" / "model-cache")

    # Below this, a prediction is reported as "couldn't confidently identify
    # this" (issue #35) rather than a likely-wrong top guess. Measured on 1000
    # validation images: 98.3% of correct predictions exceed this, and 18.1% of
    # incorrect predictions fall below it — separating correct from incorrect with
    # reasonable precision.
    confidence_threshold: float = 0.5

    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MiB

    # Mirrors apps/api's LOG_LEVEL (issue #61/#62) — Python's stdlib logging
    # level names, upper- or lowercase: DEBUG/INFO/WARNING/ERROR/CRITICAL.
    log_level: str = "INFO"

    # NFR-SEC-01: network isolation (--ingress internal) alone means no
    # public route exists, but the NFR promises a service-to-service
    # credential too — defense in depth, not redundant, since it also
    # protects against anything else that lands inside the same Container
    # Apps environment. Optional (None) so local dev / apps/api's own test
    # suite, which never sets this, keeps working unauthenticated — set in
    # Azure (both Container Apps) and CI so the deployed paths are real.
    internal_service_token: str | None = None


settings = Settings()
