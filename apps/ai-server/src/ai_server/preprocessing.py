"""Turns an uploaded photo into the tensor shape the model expects.

Issue #33: entirely in memory (`io.BytesIO`/`PIL.Image`, never a temp file
on disk) and handles malformed/oversized images with a clear error instead
of an unhandled exception.
"""

from __future__ import annotations

import io

import numpy as np
from PIL import Image, UnidentifiedImageError


class InvalidImageError(ValueError):
    """A photo that can't be decoded, or is too large to bother trying."""


def preprocess_image(
    image_bytes: bytes,
    *,
    max_bytes: int,
    target_size: int,
    mean: tuple[float, float, float],
    std: tuple[float, float, float],
) -> np.ndarray:
    """
    Decodes and normalises an uploaded photo for the model.

    :param image_bytes: The raw uploaded file content.
    :param max_bytes: Rejects anything larger than this before attempting to
        decode it — PIL's own `Image.MAX_IMAGE_PIXELS` guard (left at its
        default) additionally rejects a small file that decompresses into
        an enormous pixel grid (a decompression bomb).
    :param target_size: The model's expected square input size in pixels.
    :param mean: Per-channel (R, G, B) normalisation mean, `0..1` scale.
    :param std: Per-channel (R, G, B) normalisation standard deviation.
    :returns: A `(1, 3, target_size, target_size)` float32 array, ready to
        pass straight to `FoodClassifier.predict`.
    :raises InvalidImageError: If the upload is oversized, empty, or not a
        decodable image.
    """
    if len(image_bytes) == 0:
        raise InvalidImageError("Uploaded file is empty.")
    if len(image_bytes) > max_bytes:
        raise InvalidImageError(f"Uploaded file exceeds the {max_bytes} byte limit.")

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()  # Forces the decode now, inside this try block.
            rgb = image.convert("RGB").resize((target_size, target_size), Image.Resampling.BILINEAR)
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise InvalidImageError("Uploaded file is not a readable image.") from error

    pixels = np.asarray(rgb, dtype=np.float32) / 255.0
    mean_arr = np.array(mean, dtype=np.float32)
    std_arr = np.array(std, dtype=np.float32)
    normalized = (pixels - mean_arr) / std_arr

    chw = normalized.transpose(2, 0, 1)
    return chw[np.newaxis, ...].astype(np.float32)
