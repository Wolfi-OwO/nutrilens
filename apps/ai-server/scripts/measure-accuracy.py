"""Measure accuracy of the food-101 model on held-out validation images.

This script runs the classifier on the food-101 validation split and reports
top-1 accuracy plus confidence distribution for correct vs incorrect predictions.
Used to validate the confidence_threshold setting in config.py.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import numpy as np

# Add src to path so we can import from ai_server
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from datasets import load_dataset

from ai_server.model import get_classifier
from ai_server.preprocessing import InvalidImageError, preprocess_image


def measure_accuracy(sample_limit: int | None = None, seed: int = 42) -> None:
    """
    Measure model accuracy on food-101 validation split.

    Args:
        sample_limit: If set, only evaluate this many samples (useful for testing).
        seed: Random seed for shuffling the dataset. Default 42 for reproducibility.
    """
    classifier = get_classifier()
    dataset = load_dataset("ethz/food101", split="validation")

    # The food-101 validation split is ordered by class (each class occupies a
    # contiguous block). Taking the first N images without shuffling samples only
    # ~4 classes out of 101, giving an unrepresentative accuracy measurement.
    # Shuffle with a fixed seed before selecting to ensure a representative sample
    # across all classes.
    dataset = dataset.shuffle(seed=seed)

    if sample_limit:
        dataset = dataset.select(range(min(sample_limit, len(dataset))))

    correct_predictions = []
    incorrect_predictions = []
    seen_classes = set()
    total = 0
    correct = 0

    print(f"Evaluating on {len(dataset)} samples (seed={seed})...")

    for idx, sample in enumerate(dataset):
        if (idx + 1) % 1000 == 0:
            print(f"  Processed {idx + 1}/{len(dataset)}...")

        image = sample["image"]
        true_label_idx = sample["label"]
        seen_classes.add(true_label_idx)

        # Convert PIL Image to bytes for preprocessing
        image_bytes = io.BytesIO()
        image.save(image_bytes, format="JPEG")
        image_bytes.seek(0)

        try:
            pixel_values = preprocess_image(
                image_bytes.getvalue(),
                max_bytes=10 * 1024 * 1024,
                target_size=classifier.image_size,
                mean=classifier.image_mean,
                std=classifier.image_std,
            )

            probabilities = classifier.predict(pixel_values)
            predicted_idx = int(np.argmax(probabilities))
            confidence = float(probabilities[predicted_idx])

            total += 1
            if predicted_idx == true_label_idx:
                correct += 1
                correct_predictions.append(confidence)
            else:
                incorrect_predictions.append(confidence)

        except InvalidImageError:
            # Skip invalid images (should be rare)
            continue

    # Calculate statistics
    accuracy = (correct / total * 100) if total > 0 else 0
    correct_arr = np.array(correct_predictions) if correct_predictions else np.array([])
    incorrect_arr = np.array(incorrect_predictions) if incorrect_predictions else np.array([])

    print("\n" + "=" * 70)
    print("MEASUREMENT RESULTS")
    print("=" * 70)
    print("\nDataset coverage:")
    print(f"  Samples evaluated: {total}")
    print(f"  Distinct classes covered: {len(seen_classes)}/101")
    print(f"  Class coverage: {len(seen_classes)/101*100:.1f}%")
    print("\nAccuracy:")
    print(f"  Correct predictions: {correct}")
    print(f"  Top-1 accuracy: {accuracy:.2f}% ({correct}/{total})")

    if len(correct_arr) > 0:
        print(f"\nCorrect predictions (n={len(correct_arr)}):")
        print(f"  Mean confidence: {correct_arr.mean():.4f}")
        print(f"  Std dev:         {correct_arr.std():.4f}")
        print(f"  Min:             {correct_arr.min():.4f}")
        print(f"  Max:             {correct_arr.max():.4f}")

    if len(incorrect_arr) > 0:
        print(f"\nIncorrect predictions (n={len(incorrect_arr)}):")
        print(f"  Mean confidence: {incorrect_arr.mean():.4f}")
        print(f"  Std dev:         {incorrect_arr.std():.4f}")
        print(f"  Min:             {incorrect_arr.min():.4f}")
        print(f"  Max:             {incorrect_arr.max():.4f}")

    # Confidence threshold analysis
    print("\nConfidence threshold (currently 0.5):")
    if len(correct_arr) > 0:
        pct_correct_above_05 = (correct_arr >= 0.5).sum() / len(correct_arr) * 100
        print(f"  {pct_correct_above_05:.1f}% of correct predictions are >= 0.5")

    if len(incorrect_arr) > 0:
        pct_incorrect_below_05 = (incorrect_arr < 0.5).sum() / len(incorrect_arr) * 100
        print(f"  {pct_incorrect_below_05:.1f}% of incorrect predictions are < 0.5")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Measure model accuracy on food-101 validation split"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of samples to evaluate",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for dataset shuffling (default: 42)",
    )
    args = parser.parse_args()
    measure_accuracy(sample_limit=args.limit, seed=args.seed)
