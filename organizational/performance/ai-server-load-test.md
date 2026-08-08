# apps/ai-server load test — NFR-PERF-01

## Requirement

> NFR-PERF-01: Photo-based meal logging (upload → AI prediction returned)
> completes in under 3 seconds at the 95th percentile.

## Method

`apps/ai-server/scripts/load_test.py` sends real HTTP `POST /predict`
requests (not a mocked classifier — the full path: multipart parsing,
in-memory preprocessing, ONNX inference, response serialization) against a
running instance of the Docker image built by `apps/ai-server/Dockerfile`
(model baked in at build time, per #38), using a synthetic 800×600 JPEG
sized like a typical downscaled phone photo. Latency is measured
client-side, start-to-finish of each request.

```bash
docker build -t nutrilens-ai-server apps/ai-server
docker run -d -p 8000:8000 nutrilens-ai-server
python apps/ai-server/scripts/load_test.py --base-url http://localhost:8000 \
    --requests 100 --concurrency 10
```

## Results

Run on a 16-core / 16 GB development machine (not the eventual Azure
Container App, which will have far less CPU — see **Caveat** below), CPU-only
inference (`onnxruntime`, `CPUExecutionProvider`), single container instance.

| Concurrency | Requests | mean   | p50    | p95    | p99    | max    |
| ----------- | -------- | ------ | ------ | ------ | ------ | ------ |
| 5           | 50       | 0.314s | 0.314s | 0.358s | 0.359s | 0.359s |
| 10          | 100      | 0.641s | 0.659s | 0.671s | 0.726s | 0.726s |

**p95 at concurrency 10: 0.671s — well within the 3s NFR-PERF-01 target**
(4.5× headroom).

## Caveat

This ran on a 16-core dev machine; the deployed Azure Container App
(consumption plan) has meaningfully less CPU per replica. The measured
per-request inference cost itself is small enough (mean ~65ms of the ~650ms
total at concurrency 10, per the `prediction completed` log line vs. the
`request completed` log line — see #41) that there's substantial headroom
even on a smaller instance, but this should be re-run against the real
deployed Container App once it exists (tracked under M5/M8 deployment work)
rather than assumed from this number alone.
