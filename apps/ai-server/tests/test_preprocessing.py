import numpy as np
import pytest

from ai_server.preprocessing import InvalidImageError, preprocess_image
from tests.conftest import tiny_jpeg_bytes

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


def test_produces_the_shape_the_model_expects() -> None:
    result = preprocess_image(
        tiny_jpeg_bytes(),
        max_bytes=10_000_000,
        target_size=8,
        mean=MEAN,
        std=STD,
    )

    assert result.shape == (1, 3, 8, 8)
    assert result.dtype == np.float32


def test_rejects_an_empty_upload() -> None:
    with pytest.raises(InvalidImageError, match="empty"):
        preprocess_image(b"", max_bytes=10_000_000, target_size=8, mean=MEAN, std=STD)


def test_rejects_an_oversized_upload() -> None:
    oversized = tiny_jpeg_bytes()
    with pytest.raises(InvalidImageError, match="exceeds"):
        preprocess_image(oversized, max_bytes=len(oversized) - 1, target_size=8, mean=MEAN, std=STD)


def test_rejects_a_malformed_image() -> None:
    with pytest.raises(InvalidImageError, match="not a readable image"):
        preprocess_image(
            b"this is not an image", max_bytes=10_000_000, target_size=8, mean=MEAN, std=STD
        )


def test_rejects_a_truncated_image() -> None:
    truncated = tiny_jpeg_bytes()[:20]
    with pytest.raises(InvalidImageError, match="not a readable image"):
        preprocess_image(truncated, max_bytes=10_000_000, target_size=8, mean=MEAN, std=STD)
