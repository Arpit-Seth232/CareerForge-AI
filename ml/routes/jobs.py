"""
Job-related ML endpoints:
- POST /api/v1/job/embedding — generate embedding for a job
- POST /api/v1/jobs/match — match jobs to user's resume
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.embedding import _model
from services.job_matching import match_jobs_for_user

router = APIRouter(prefix="/api/v1", tags=["jobs"])


# ── Job Embedding ───────────────────────────────────────────────────

class JobEmbeddingRequest(BaseModel):
    title: str
    description: str
    requirements: str = ""


@router.post("/job/embedding")
def generate_job_embedding(body: JobEmbeddingRequest):
    """Generate 768d embedding for a job posting."""
    combined = f"{body.title}\n\n{body.description}"
    if body.requirements:
        combined += f"\n\nRequirements:\n{body.requirements}"

    if len(combined) > 8000:
        combined = combined[:8000]

    try:
        embedding = _model.encode(combined, convert_to_tensor=False)
        return {"embedding": embedding.tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")


# ── Job Matching ────────────────────────────────────────────────────

class JobMatchFilters(BaseModel):
    jobType: Optional[str] = None
    workType: Optional[str] = None
    location: Optional[str] = None
    search: Optional[str] = None


class JobMatchRequest(BaseModel):
    user_id: str
    limit: int = 20
    offset: int = 0
    filters: Optional[JobMatchFilters] = None


@router.post("/jobs/match")
def match_jobs(body: JobMatchRequest):
    """Match jobs against user's primary resume (FAISS + TF-IDF hybrid)."""
    try:
        filters_dict = body.filters.model_dump() if body.filters else None
        result = match_jobs_for_user(
            user_id=body.user_id,
            limit=body.limit,
            offset=body.offset,
            filters=filters_dict,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")
