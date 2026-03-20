from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from pydantic import BaseModel

import time

from services.storage import upload_resume_to_supabase
from services.gemini import parse_resume
from services.ats_scorer import compute_ats_score
from services.ml_scorer import hybrid_score, log_prediction
from services.suggestion_filter import filter_suggestions
from services.database import (
    insert_resume_record,
    update_resume_status,
    save_parsed_data,
    generate_embedding_for_resume,
    clear_resume_embedding,
)

router = APIRouter(prefix="/api/v1/resume", tags=["Resume"])

ALLOWED_TYPES = {"pdf", "doc", "docx"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    """
    Upload a resume file, store it in Supabase S3,
    parse it with Gemini, and persist the extracted data.

    Flow:
    1. Validate file type and size
    2. Upload to Supabase S3 storage
    3. Insert a resume record (status = processing)
    4. Extract text & parse with Gemini
    5. Save parsed education, experience, skills, projects, certs, feedback to DB
    6. Update resume status to completed
    7. Return full parsed result to the frontend
    """

    # --- Validate file extension ---
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Only {', '.join(ALLOWED_TYPES)} files are allowed.")

    # --- Validate file size (read once, use bytes later) ---
    raw_peek = await file.read()
    if len(raw_peek) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5 MB limit.")
    await file.seek(0)  # reset for storage upload

    # --- 1) Upload to Supabase S3 ---
    try:
        storage_result = await upload_resume_to_supabase(file, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {e}")

    # --- 2) Create resume DB record (status = processing) ---
    try:
        resume_id = insert_resume_record(
            user_id=user_id,
            file_name=storage_result["file_name"],
            file_url=storage_result["file_url"],
            file_type=storage_result["file_type"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insert failed: {e}")

    # --- 3) Parse resume with Gemini ---
    try:
        parsed = await parse_resume(
            raw_bytes=storage_result["raw_bytes"],
            file_type=storage_result["file_type"],
        )
    except Exception as e:
        update_resume_status(resume_id, "failed")
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {e}")

    # --- 4) Save all parsed data to DB ---
    try:
        save_parsed_data(resume_id, parsed)
    except Exception as e:
        update_resume_status(resume_id, "failed")
        raise HTTPException(status_code=500, detail=f"Saving parsed data failed: {e}")

    # --- 5) Compute ATS score (deterministic + ML hybrid) ---
    score_start = time.time()
    ats = compute_ats_score(parsed)
    result = hybrid_score(ats["section_scores"], ats["overall_score"])
    score_ms = round((time.time() - score_start) * 1000)

    fb = parsed.get("feedback", {})
    raw_suggestions = fb.get("suggestions", [])
    validated_suggestions = filter_suggestions(raw_suggestions, parsed)

    parsed["feedback"] = {
        "overall_score": result["overall_score"],
        "section_scores": ats["section_scores"],
        "scoring_source": result["source"],
        "ml_confidence": result["ml_confidence"],
        "suggestions": validated_suggestions,
        "keyword_analysis": fb.get("keyword_analysis", {}),
        "formatting_issues": fb.get("formatting_issues", []),
    }

    # --- 6) Log prediction for ML training pipeline ---
    try:
        log_prediction(
            user_id=user_id,
            resume_id=resume_id,
            feature_scores=ats["section_scores"],
            overall_score=result["overall_score"],
            source=result["source"],
            confidence=result["ml_confidence"],
            latency_ms=score_ms,
        )
    except Exception as e:
        print(f"Warning: failed to log prediction: {e}")

    # --- 7) Return response ---
    return {
        "success": True,
        "resume_id": resume_id,
        "file_url": storage_result["file_url"],
        "parsed_data": parsed,
    }


class EmbeddingRequest(BaseModel):
    resume_id: str
    old_primary_id: str | None = None


@router.post("/embedding")
async def generate_embedding(body: EmbeddingRequest):
    """
    Generate embedding for the new primary resume and
    optionally clear the embedding from the old primary.
    Called by the backend when the user switches primary resume.
    """
    # Clear embedding from old primary
    if body.old_primary_id:
        try:
            clear_resume_embedding(body.old_primary_id)
        except Exception as e:
            print(f"Warning: failed to clear old embedding: {e}")

    # Generate embedding for new primary
    try:
        success = generate_embedding_for_resume(body.resume_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {e}")

    if not success:
        raise HTTPException(status_code=400, detail="Resume has no parsed data to generate embedding from")

    return {"success": True, "message": "Embedding generated for primary resume"}
