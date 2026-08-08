#!/usr/bin/env python3
"""
Load-tests a running apps/ai-server instance against NFR-PERF-01: photo
upload -> AI prediction returned completes in under 3s at the 95th
percentile (issue #40).

Hits a real, already-running server over real HTTP — this is deliberately
not a unit test with a mocked classifier, since the NFR is about the whole
request path (multipart parsing, preprocessing, inference, serialization),
not just the model call.

Usage:
    python scripts/load_test.py --base-url http://localhost:8000 \
        --requests 50 --concurrency 5
"""

from __future__ import annotations

import argparse
import asyncio
import io
import statistics
import sys
import time

import httpx
from PIL import Image


def synthetic_photo_bytes() -> bytes:
    """
    A representative-sized JPEG (800x600, matching a typical phone photo
    downscaled for upload) — synthetic, not a real food photo, because this
    test measures latency/throughput, not prediction accuracy (already
    verified separately against a real held-out image, see ADR-0002).
    """
    buffer = io.BytesIO()
    Image.new("RGB", (800, 600), (180, 90, 40)).save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


async def timed_predict(client: httpx.AsyncClient, photo: bytes) -> float:
    start = time.perf_counter()
    response = await client.post(
        "/predict", files={"file": ("photo.jpg", photo, "image/jpeg")}, timeout=30.0
    )
    elapsed = time.perf_counter() - start
    response.raise_for_status()
    return elapsed


async def run(base_url: str, total_requests: int, concurrency: int) -> list[float]:
    photo = synthetic_photo_bytes()
    latencies: list[float] = []
    semaphore = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(base_url=base_url) as client:
        # One unmeasured warm-up request — the model is already loaded at
        # container build time (#38), but this absorbs any first-connection
        # overhead so it doesn't skew the measured percentiles.
        await client.get("/ready", timeout=30.0)

        async def one_request() -> None:
            async with semaphore:
                latencies.append(await timed_predict(client, photo))

        await asyncio.gather(*(one_request() for _ in range(total_requests)))

    return latencies


def percentile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    index = min(int(len(ordered) * pct), len(ordered) - 1)
    return ordered[index]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--requests", type=int, default=50)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument(
        "--p95-target-seconds",
        type=float,
        default=3.0,
        help="NFR-PERF-01's target — the script exits non-zero if p95 exceeds this.",
    )
    args = parser.parse_args()

    print(
        f"Load-testing {args.base_url}/predict: "
        f"{args.requests} requests, concurrency {args.concurrency} ..."
    )
    latencies = asyncio.run(run(args.base_url, args.requests, args.concurrency))

    p50 = percentile(latencies, 0.50)
    p95 = percentile(latencies, 0.95)
    p99 = percentile(latencies, 0.99)
    mean = statistics.mean(latencies)
    worst = max(latencies)

    print(f"requests:  {len(latencies)}")
    print(f"mean:      {mean:.3f}s")
    print(f"p50:       {p50:.3f}s")
    print(f"p95:       {p95:.3f}s")
    print(f"p99:       {p99:.3f}s")
    print(f"max:       {worst:.3f}s")

    if p95 > args.p95_target_seconds:
        print(f"FAIL: p95 {p95:.3f}s exceeds the {args.p95_target_seconds}s NFR-PERF-01 target.")
        return 1

    print(f"PASS: p95 {p95:.3f}s is within the {args.p95_target_seconds}s NFR-PERF-01 target.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
