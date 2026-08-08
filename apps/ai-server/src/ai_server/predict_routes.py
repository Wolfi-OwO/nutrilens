from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from ai_server.config import settings
from ai_server.model import FoodClassifier, get_classifier
from ai_server.preprocessing import InvalidImageError, preprocess_image
from ai_server.schemas import Prediction, PredictResponse

router = APIRouter()

TOP_K = 5

# A FastAPI dependency (not a direct call to get_classifier()) so tests can
# swap in a fake classifier via app.dependency_overrides instead of hitting
# the real Hugging Face Hub download on every test run.
ClassifierDep = Annotated[FoodClassifier, Depends(get_classifier)]


def _predict(classifier: FoodClassifier, image_bytes: bytes) -> PredictResponse:
    pixel_values = preprocess_image(
        image_bytes,
        max_bytes=settings.max_upload_bytes,
        target_size=classifier.image_size,
        mean=classifier.image_mean,
        std=classifier.image_std,
    )
    probabilities = classifier.predict(pixel_values)

    top_indices = probabilities.argsort()[-TOP_K:][::-1]
    predictions = [
        Prediction(label=classifier.label_for(int(index)), confidence=float(probabilities[index]))
        for index in top_indices
    ]
    is_confident = predictions[0].confidence >= settings.confidence_threshold
    return PredictResponse(predictions=predictions, is_confident=is_confident)


@router.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile, classifier: ClassifierDep) -> PredictResponse:
    """
    Identifies the food in an uploaded photo.

    The upload is read into memory and never written to disk (issue #36) —
    `UploadFile.read()` returns `bytes`, and nothing in this handler or
    `preprocess_image` touches the filesystem.
    """
    image_bytes = await file.read()
    try:
        return _predict(classifier, image_bytes)
    except InvalidImageError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
