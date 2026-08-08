"""Loads and caches the food-recognition model (ADR-0002).

Downloading happens once, lazily, on first use — not committed to git (the
weights are a 93 MB, fixed, re-derivable third-party artifact) and not
baked into the image at build time yet (tracked by issue #38's Dockerfile).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download

from ai_server.config import settings


class FoodClassifier:
    """A loaded ONNX food-classification model, ready to run inference."""

    def __init__(
        self,
        session: ort.InferenceSession,
        id2label: dict[str, str],
        image_size: int,
        image_mean: tuple[float, float, float],
        image_std: tuple[float, float, float],
    ) -> None:
        self._session = session
        self._id2label = id2label
        self.image_size = image_size
        self.image_mean = image_mean
        self.image_std = image_std
        self._input_name = session.get_inputs()[0].name

    def label_for(self, index: int) -> str:
        return self._id2label[str(index)]

    def num_classes(self) -> int:
        return len(self._id2label)

    def predict(self, pixel_values: np.ndarray) -> np.ndarray:
        """
        Runs inference.

        :param pixel_values: A `(1, 3, image_size, image_size)` float32 array,
            already normalised by `preprocessing.preprocess_image`.
        :returns: Softmax probabilities over every class, shape `(num_classes,)`.
        """
        logits = self._session.run(None, {self._input_name: pixel_values})[0][0]
        shifted = logits - logits.max()
        exp = np.exp(shifted)
        return exp / exp.sum()


def _download(filename: str) -> str:
    return hf_hub_download(
        repo_id=settings.model_repo_id,
        filename=filename,
        revision=settings.model_revision,
        cache_dir=settings.model_cache_dir,
    )


@lru_cache(maxsize=1)
def get_classifier() -> FoodClassifier:
    """
    Returns the process-wide classifier, loading and caching it on first call.

    Cached with `lru_cache` (not a manual singleton) so a test can bypass it
    entirely with a fake and so there's exactly one load path to reason
    about — mirrors apps/api's `getPool()`.
    """
    model_path = _download(settings.model_filename)
    config_path = _download("config.json")
    preprocessor_config_path = _download("preprocessor_config.json")

    id2label = json.loads(Path(config_path).read_text())["id2label"]
    preprocessor_config = json.loads(Path(preprocessor_config_path).read_text())
    image_size = preprocessor_config["size"]["height"]
    image_mean = tuple(preprocessor_config["image_mean"])
    image_std = tuple(preprocessor_config["image_std"])

    session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    return FoodClassifier(session, id2label, image_size, image_mean, image_std)
