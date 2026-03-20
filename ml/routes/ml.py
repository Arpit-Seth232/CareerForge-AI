from fastapi import APIRouter, HTTPException

from services.ml_scorer import train_model, get_training_status

router = APIRouter(prefix="/api/v1/ml", tags=["ML Model"])


@router.get("/status")
async def model_status():
    """Check ML model training status and data availability."""
    return get_training_status()


@router.post("/train")
async def trigger_training():
    """
    Train or retrain the ATS scoring model using collected hiring data.

    Requires at least 50 labeled samples (resumes with application outcomes).
    The trained model is saved to disk and registered in ml_model_versions.
    """
    try:
        result = train_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result
