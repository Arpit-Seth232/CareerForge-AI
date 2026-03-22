"""
Job matching service — FAISS + TF-IDF hybrid scoring.

1. FAISS: Semantic similarity between resume embedding ↔ job embeddings
2. TF-IDF: Keyword overlap between resume skills ↔ job text
3. Combined score: 0.7 × semantic + 0.3 × keyword
"""

import logging
import re
from typing import Optional

import numpy as np
import psycopg
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

import config
from .embedding import _model

logger = logging.getLogger(__name__)


def _get_conn():
    return psycopg.connect(config.DATABASE_URL)


def _get_resume_embedding(user_id: str) -> Optional[np.ndarray]:
    """Get the primary resume embedding for a user."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT embedding::text FROM resumes
                WHERE user_id = %s AND is_primary = true AND embedding IS NOT NULL
                LIMIT 1
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row or not row[0]:
                return None
            # Parse "[0.1,0.2,...]" → numpy array
            vec_str = row[0].strip("[]")
            return np.array([float(x) for x in vec_str.split(",")], dtype=np.float32)


def _get_resume_skills(user_id: str) -> list[str]:
    """Get skills from the user's primary resume."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT rs.name FROM resume_skills rs
                JOIN resumes r ON rs.resume_id = r.id
                WHERE r.user_id = %s AND r.is_primary = true
                """,
                (user_id,),
            )
            return [row[0] for row in cur.fetchall() if row[0]]


def _get_active_jobs(
    limit: int = 100,
    offset: int = 0,
    filters: Optional[dict] = None,
) -> list[dict]:
    """Fetch active jobs with their embeddings."""
    where_clauses = ["j.is_active = true"]
    params: list = []

    if filters:
        if filters.get("jobType"):
            where_clauses.append("j.job_type = %s")
            params.append(filters["jobType"])
        if filters.get("workType"):
            where_clauses.append("j.work_type = %s")
            params.append(filters["workType"])
        if filters.get("location"):
            where_clauses.append("j.job_location ILIKE %s")
            params.append(f"%{filters['location']}%")
        if filters.get("search"):
            where_clauses.append(
                "(j.job_title ILIKE %s OR j.job_description ILIKE %s)"
            )
            params.extend([f"%{filters['search']}%"] * 2)

    where_sql = " AND ".join(where_clauses)

    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    j.id, j.job_title, j.job_description, j.job_requirement,
                    j.min_experience, j.max_experience,
                    j.min_salary, j.max_salary,
                    j.job_location, j.job_type, j.work_type,
                    j.open_slots, j.created_at, j.expires_at,
                    j.embedding::text,
                    c.name as company_name, c.logo_url as company_logo,
                    c.website as company_website
                FROM jobs j
                LEFT JOIN companies c ON j.company_id = c.id
                WHERE {where_sql}
                ORDER BY j.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            return [dict(zip(columns, row)) for row in rows]


def _parse_embedding(emb_str: Optional[str]) -> Optional[np.ndarray]:
    """Parse DB embedding string to numpy array."""
    if not emb_str:
        return None
    try:
        vec_str = emb_str.strip("[]")
        return np.array([float(x) for x in vec_str.split(",")], dtype=np.float32)
    except (ValueError, AttributeError):
        return None


def _semantic_scores(
    resume_emb: np.ndarray,
    job_embeddings: list[Optional[np.ndarray]],
) -> list[float]:
    """Compute cosine similarity between resume and each job embedding."""
    scores = []
    resume_norm = resume_emb / (np.linalg.norm(resume_emb) + 1e-10)

    for job_emb in job_embeddings:
        if job_emb is None:
            scores.append(0.0)
            continue
        job_norm = job_emb / (np.linalg.norm(job_emb) + 1e-10)
        sim = float(np.dot(resume_norm, job_norm))
        # Clamp to [0, 1]
        scores.append(max(0.0, min(1.0, sim)))

    return scores


def _tfidf_scores(
    resume_skills: list[str],
    job_texts: list[str],
) -> list[float]:
    """Compute TF-IDF keyword overlap between resume skills and job texts."""
    if not resume_skills or not job_texts:
        return [0.0] * len(job_texts)

    resume_doc = " ".join(resume_skills)
    all_docs = [resume_doc] + job_texts

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=500,
        ngram_range=(1, 2),
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(all_docs)
        # Compare resume (index 0) against each job (index 1+)
        sims = sklearn_cosine(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
        return [float(s) for s in sims]
    except ValueError:
        return [0.0] * len(job_texts)


def match_jobs_for_user(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    filters: Optional[dict] = None,
) -> dict:
    """
    Match jobs against user's primary resume using hybrid scoring.
    Returns jobs sorted by match_score (0.7 semantic + 0.3 TF-IDF).
    """
    # Get resume data
    resume_emb = _get_resume_embedding(user_id)
    resume_skills = _get_resume_skills(user_id)

    has_embedding = resume_emb is not None
    has_skills = len(resume_skills) > 0

    # Fetch more jobs than needed so we can sort and slice
    fetch_limit = min(limit * 5, 200)
    jobs = _get_active_jobs(limit=fetch_limit, offset=0, filters=filters)

    if not jobs:
        return {"jobs": [], "pagination": {"page": 1, "limit": limit, "total": 0, "totalPages": 0}}

    # Extract embeddings and texts for scoring
    job_embeddings = [_parse_embedding(j.get("embedding")) for j in jobs]
    job_texts = [
        f"{j.get('job_title', '')} {j.get('job_description', '')} {j.get('job_requirement', '')}"
        for j in jobs
    ]

    # Compute scores
    if has_embedding:
        sem_scores = _semantic_scores(resume_emb, job_embeddings)
    else:
        sem_scores = [0.0] * len(jobs)

    if has_skills:
        kw_scores = _tfidf_scores(resume_skills, job_texts)
    else:
        kw_scores = [0.0] * len(jobs)

    # Hybrid score
    for i, job in enumerate(jobs):
        if has_embedding and has_skills:
            job["match_score"] = round(0.7 * sem_scores[i] + 0.3 * kw_scores[i], 4)
        elif has_embedding:
            job["match_score"] = round(sem_scores[i], 4)
        elif has_skills:
            job["match_score"] = round(kw_scores[i], 4)
        else:
            job["match_score"] = 0.0

        job["semantic_score"] = round(sem_scores[i], 4)
        job["keyword_score"] = round(kw_scores[i], 4)

        # Remove raw embedding from response
        job.pop("embedding", None)

    # Sort by match_score descending
    jobs.sort(key=lambda j: j["match_score"], reverse=True)

    # Paginate
    total = len(jobs)
    paged_jobs = jobs[offset: offset + limit]

    # Convert datetime objects to strings
    for job in paged_jobs:
        for key in ("created_at", "expires_at"):
            if job.get(key) and hasattr(job[key], "isoformat"):
                job[key] = job[key].isoformat()

    return {
        "jobs": paged_jobs,
        "matching_method": "hybrid" if has_embedding and has_skills else (
            "semantic" if has_embedding else ("keyword" if has_skills else "none")
        ),
        "pagination": {
            "page": (offset // limit) + 1,
            "limit": limit,
            "total": total,
            "totalPages": max(1, (total + limit - 1) // limit),
        },
    }
    
    
