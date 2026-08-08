import io

import numpy as np
import pytest
from PIL import Image

from ai_server.model import FoodClassifier


class FakeSession:
    """A stand-in for onnxruntime.InferenceSession with a fixed output."""

    def __init__(self, logits: np.ndarray) -> None:
        self._logits = logits

    def get_inputs(self) -> list[object]:
        return [type("Input", (), {"name": "pixel_values"})()]

    def run(self, _output_names: object, _feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        return [self._logits[np.newaxis, ...]]


def make_fake_classifier(logits: np.ndarray, *, num_classes: int = 4) -> FoodClassifier:
    id2label = {str(i): f"class_{i}" for i in range(num_classes)}
    session = FakeSession(logits)
    return FoodClassifier(
        session=session,  # type: ignore[arg-type]
        id2label=id2label,
        image_size=8,
        image_mean=(0.5, 0.5, 0.5),
        image_std=(0.5, 0.5, 0.5),
    )


@pytest.fixture
def confident_classifier() -> FoodClassifier:
    """class_0 dominates the softmax — a clearly confident prediction."""
    return make_fake_classifier(np.array([10.0, 0.0, 0.0, 0.0]))


@pytest.fixture
def uncertain_classifier() -> FoodClassifier:
    """Near-uniform logits — nothing stands out, like an out-of-distribution photo."""
    return make_fake_classifier(np.array([0.01, 0.0, -0.01, 0.005]))


def tiny_jpeg_bytes(
    size: tuple[int, int] = (16, 16), color: tuple[int, int, int] = (200, 90, 40)
) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="JPEG")
    return buffer.getvalue()
