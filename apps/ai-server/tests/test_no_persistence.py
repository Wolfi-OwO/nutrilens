"""
Issue #36: nothing on the /predict path may write an uploaded image (or
anything derived from it) to disk. Uses the fake classifier from conftest,
so this also confirms no model-loading side path sneaks in a write during
the request — `get_classifier`'s real download/cache path is dependency-
overridden away entirely, not just mocked at the network layer.
"""

import builtins

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from ai_server.main import app
from ai_server.model import FoodClassifier, get_classifier
from tests.conftest import tiny_jpeg_bytes

_WRITE_MODE_CHARS = frozenset("wax+")


def test_predict_never_writes_the_uploaded_image_to_disk(
    confident_classifier: FoodClassifier, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Built before the guard below is armed — this itself legitimately uses
    # Image.save() to produce test fixture bytes, which isn't part of the
    # predict path this test is actually checking.
    image_bytes = tiny_jpeg_bytes()

    real_open = builtins.open

    def guarded_open(file: object, mode: str = "r", *args: object, **kwargs: object) -> object:
        if any(char in mode for char in _WRITE_MODE_CHARS):
            raise AssertionError(f"Unexpected filesystem write attempted: open({file!r}, {mode!r})")
        return real_open(file, mode, *args, **kwargs)  # type: ignore[arg-type]

    def guarded_save(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Unexpected Image.save() call on the predict path.")

    monkeypatch.setattr(builtins, "open", guarded_open)
    monkeypatch.setattr(Image.Image, "save", guarded_save)

    app.dependency_overrides[get_classifier] = lambda: confident_classifier
    try:
        client = TestClient(app)
        response = client.post("/predict", files={"file": ("food.jpg", image_bytes, "image/jpeg")})
    finally:
        app.dependency_overrides.pop(get_classifier, None)

    assert response.status_code == 200
