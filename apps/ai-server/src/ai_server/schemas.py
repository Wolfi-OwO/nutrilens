from pydantic import BaseModel, Field


class Prediction(BaseModel):
    """One candidate food label with the model's confidence in it."""

    label: str
    confidence: float = Field(ge=0.0, le=1.0)


class PredictResponse(BaseModel):
    """
    The `/predict` response contract (ADR-0001: "image in, structured
    prediction out").

    `is_confident` is `False` when the top prediction falls below
    `Settings.confidence_threshold` (issue #35) — `predictions` is still
    populated in that case (the best guesses are still useful context), but
    the caller should treat the result as "couldn't confidently identify
    this" rather than trust the top label outright.
    """

    predictions: list[Prediction]
    is_confident: bool
