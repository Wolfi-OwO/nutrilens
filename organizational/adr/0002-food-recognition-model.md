# ADR-0002: Food-recognition model choice

## Status

Accepted

## Context

`apps/ai-server` needs a model that takes a food photo and returns one or
more food-item predictions with a confidence score, cheaply enough to run on
a CPU-only, scale-to-zero Azure Container App (see
`organizational/deploy/azure-container-apps.md` and issue #111) — a GPU
instance or an always-warm replica isn't in budget for a hobby-scale project
(ADR-0002 in `lattice`'s own docs: "not an enterprise app").

## Alternatives considered

1. **Train a custom CNN from scratch.** Rejected: no labeled dataset of our
   own, no GPU budget, and food classification is a solved problem at the
   scale this project needs — reinventing it wouldn't teach anything the
   next four alternatives don't already cover, and would cost the most time
   for the worst accuracy.

2. **A third-party cloud vision API** (Google Vision, Azure Computer Vision,
   Clarifai food model, ...). Rejected: sends user-uploaded food photos to
   an external party, which undercuts the entire point of ADR-0001's
   isolated, no-persistence AI server — the privacy guarantee that server
   exists to provide would leak at the network boundary instead of inside
   it. Also a recurring paid dependency with no free tier generous enough
   for unpredictable hobby-project traffic.

3. **CLIP zero-shot classification** (e.g. `openai/clip-vit-base-patch32`
   matching an uploaded photo against a hand-written list of food-name
   prompts). Rejected: the smallest usable CLIP checkpoint is still ~600 MB
   (slow cold start on scale-to-zero), and zero-shot similarity scores
   aren't calibrated probabilities — building issue #35's confidence
   threshold on top of them would be guesswork rather than something
   measurable against held-out accuracy.

4. **MobileNetV2 fine-tuned on Food-101** (`AlexKoff88/mobilenet_v2_food101`,
   ONNX export, ~9.8 MB). Attractive on paper — the smallest option by far —
   but rejected after testing: the published ONNX export produces
   near-zero logits (`std ≈ 1e-9`) regardless of input, on both a solid-color
   image and random noise. The classifier head's own weights aren't
   degenerate (`std ≈ 0.01`), so something upstream in this specific
   community export is broken (a batchnorm-folding bug in the conversion is
   the likely cause, but the actual cause doesn't matter — the point is
   this artifact doesn't work, confirmed by running it, not by inspecting
   its README). Not something to build a "critical" no-persistence
   guarantee (#36) on top of without being confident the rest of the
   pipeline is trustworthy first.

5. **Swin Transformer fine-tuned on Food-101**
   (`onnx-community/swin-finetuned-food101-ONNX`, int8-quantized ONNX
   export, ~93 MB) — **chosen**. From the `onnx-community` org, which
   auto-converts via `optimum`'s export pipeline rather than a one-off
   manual conversion; ships its own `preprocessor_config.json` (224×224,
   ImageNet mean/std) and `id2label` map, so preprocessing doesn't have to
   be guessed from a README. Verified directly, not assumed:
   - Random noise input → near-uniform ~1% per class across all 101
     classes (`std ≈ 0.19` in raw logits, i.e. genuinely computing
     something, and correctly unconfident on an out-of-distribution
     input — exactly what issue #35's fallback threshold needs).
   - A real, held-out Food-101 validation photo (`ethz/food101`, index 0,
     true label `beignets`) → **99.9% confidence, correct**, with the
     next-ranked classes (waffles, french toast, donuts, pancakes) all
     visually-plausible confusions rather than nonsense.

## Decision

Use `onnx-community/swin-finetuned-food101-ONNX`, the `onnx/model_int8.onnx`
weights (~93 MB, int8-quantized for CPU inference), served via
`onnxruntime` — no PyTorch/CUDA dependency, keeping the container image and
cold-start time small. 101 Food-101 categories; the model's own `id2label`
(shipped in `config.json`) is the source of truth for index → name, not a
hand-copied list, so it can't drift out of sync with the weights.

The model weights are not committed to git (93 MB, and a fixed,
re-derivable third-party artifact — not something worth carrying in
history). `apps/ai_server` downloads and caches them from the Hugging Face
Hub at startup, pinned to a specific revision (not `main`), so a build is
reproducible and doesn't silently pick up an upstream change.

## Consequences

- CPU-only inference is fast enough for a single request at a time; if
  concurrent load ever needs more, the Container App scales by adding
  replicas (ADR-0001), not by requiring a GPU.
- 101 categories is Food-101's full label set — a photo of something
  outside it (a novel dish, a barcode-only packaged snack) will get a
  low-confidence, wrong-ish top guess. Issue #35's confidence threshold
  turns that into an explicit "couldn't identify this" response instead of
  a silently wrong one.
- Resolved by #38: the Dockerfile downloads and caches the model at _build_
  time, not on first request. A scale-to-zero replica's cold start pays
  only for the container to boot — verified by running the built image
  with `--network none` and confirming `/ready` still returns 200.
- Revisiting this decision later (a newer/smaller/more accurate model) is a
  one-line change to the pinned repo id/revision, not a retraining project.
