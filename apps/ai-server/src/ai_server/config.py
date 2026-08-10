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
    model_filename: str = "onnx/model_int8.onnx"
    # Computed, not a hardcoded "/tmp/..." literal — ruff/bandit (S108) flags
    # a hardcoded temp-dir path as predictable/racy; the container this
    # actually runs in is single-tenant anyway, but there's no reason not to
    # take the safer, still-simple option.
    model_cache_dir: str = str(Path(tempfile.gettempdir()) / "nutrilens-ai-server" / "model-cache")

    # Below this, a prediction is reported as "couldn't confidently identify
    # this" (issue #35) rather than a likely-wrong top guess.
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
