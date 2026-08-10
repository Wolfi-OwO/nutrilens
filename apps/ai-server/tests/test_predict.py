from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from ai_server.config import settings
from ai_server.main import app
from ai_server.model import FoodClassifier, get_classifier
from tests.conftest import tiny_jpeg_bytes


@contextmanager
def client_using(classifier: FoodClassifier) -> Iterator[TestClient]:
    app.dependency_overrides[get_classifier] = lambda: classifier
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_classifier, None)


def test_a_confident_prediction_is_flagged_confident(confident_classifier: FoodClassifier) -> None:
    with client_using(confident_classifier) as client:
        response = client.post(
            "/predict", files={"file": ("food.jpg", tiny_jpeg_bytes(), "image/jpeg")}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["is_confident"] is True
    assert body["predictions"][0]["label"] == "class_0"
    assert body["predictions"][0]["confidence"] > 0.9
    # Sorted descending by confidence.
    confidences = [p["confidence"] for p in body["predictions"]]
    assert confidences == sorted(confidences, reverse=True)


def test_an_uncertain_prediction_is_flagged_not_confident(
    uncertain_classifier: FoodClassifier,
) -> None:
    with client_using(uncertain_classifier) as client:
        response = client.post(
            "/predict", files={"file": ("food.jpg", tiny_jpeg_bytes(), "image/jpeg")}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["is_confident"] is False
    # Still returns its best guesses — the caller decides what to do with a
    # low-confidence result, this server doesn't just refuse to answer.
    assert len(body["predictions"]) > 0


def test_a_malformed_upload_is_a_400_not_a_500(confident_classifier: FoodClassifier) -> None:
    with client_using(confident_classifier) as client:
        response = client.post(
            "/predict", files={"file": ("not-an-image.txt", b"hello world", "text/plain")}
        )

    assert response.status_code == 400


def test_no_token_configured_means_no_auth_required(confident_classifier: FoodClassifier) -> None:
    """The default (unset) case — local dev, this test suite itself."""
    assert settings.internal_service_token is None
    with client_using(confident_classifier) as client:
        response = client.post(
            "/predict", files={"file": ("food.jpg", tiny_jpeg_bytes(), "image/jpeg")}
        )
    assert response.status_code == 200


def test_configured_token_rejects_missing_or_wrong_header(
    confident_classifier: FoodClassifier, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_service_token", "correct-token")

    with client_using(confident_classifier) as client:
        missing = client.post(
            "/predict", files={"file": ("food.jpg", tiny_jpeg_bytes(), "image/jpeg")}
        )
        wrong = client.post(
            "/predict",
            files={"file": ("food.jpg", tiny_jpeg_bytes(), "image/jpeg")},
            headers={"X-Internal-Service-Token": "wrong-token"},
        )

    assert missing.status_code == 401
    assert wrong.status_code == 401


def test_configured_token_accepts_the_matching_header(
    confident_classifier: FoodClassifier, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "internal_service_token", "correct-token")

    with client_using(confident_classifier) as client:
        response = client.post(
            "/predict",
            files={"file": ("food.jpg", tiny_jpeg_bytes(), "image/jpeg")},
            headers={"X-Internal-Service-Token": "correct-token"},
        )

    assert response.status_code == 200
