import pytest
from fastapi.testclient import TestClient

from ai_server import main
from ai_server.model import FoodClassifier

client = TestClient(main.app)


def test_health_does_not_require_the_model(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_to_load() -> FoodClassifier:
        raise RuntimeError("model not loaded — /health must not care")

    monkeypatch.setattr(main, "get_classifier", fail_to_load)

    response = client.get("/health")

    assert response.status_code == 200


def test_ready_returns_200_once_the_model_loads(
    monkeypatch: pytest.MonkeyPatch, confident_classifier: FoodClassifier
) -> None:
    monkeypatch.setattr(main, "get_classifier", lambda: confident_classifier)

    response = client.get("/ready")

    assert response.status_code == 200


def test_ready_returns_503_if_the_model_fails_to_load(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_to_load() -> FoodClassifier:
        raise RuntimeError("simulated model load failure")

    monkeypatch.setattr(main, "get_classifier", fail_to_load)

    response = client.get("/ready")

    assert response.status_code == 503
