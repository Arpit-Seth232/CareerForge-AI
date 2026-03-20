import uuid
import json
import psycopg

import config
from .embedding import generate_resume_embedding
from .ats_scorer import compute_ats_score


def _get_conn():
    return psycopg.connect(config.DATABASE_URL)


def insert_resume_record(user_id: str, file_name: str, file_url: str, file_type: str) -> str:
    """Insert a row into resumes table and return its id."""
    resume_id = str(uuid.uuid4())
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO resumes (id, user_id, file_name, file_url, file_type, status)
                VALUES (%s, %s, %s, %s, %s, 'processing')
                RETURNING id
                """,
                (resume_id, user_id, file_name, file_url, file_type),
            )
            conn.commit()
    return resume_id


def update_resume_status(resume_id: str, status: str, parsed_data: dict | None = None, embedding: list[float] | None = None):
    with _get_conn() as conn:
        with conn.cursor() as cur:
            if parsed_data is not None and embedding is not None:
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                cur.execute(
                    """
                    UPDATE resumes
                    SET status = %s, parsed_data = %s::jsonb, embedding = %s::vector, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (status, json.dumps(parsed_data), embedding_str, resume_id),
                )
            elif parsed_data is not None:
                cur.execute(
                    """
                    UPDATE resumes
                    SET status = %s, parsed_data = %s::jsonb, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (status, json.dumps(parsed_data), resume_id),
                )
            elif embedding is not None:
                embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                cur.execute(
                    """
                    UPDATE resumes
                    SET status = %s, embedding = %s::vector, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (status, embedding_str, resume_id),
                )
            else:
                cur.execute(
                    "UPDATE resumes SET status = %s, updated_at = NOW() WHERE id = %s",
                    (status, resume_id),
                )
            conn.commit()


def _ensure_skill(cur, skill_name: str, category: str | None) -> str:
    """Get or create a skill in skills_master. Returns skill id."""
    cur.execute("SELECT id FROM skills_master WHERE LOWER(name) = LOWER(%s)", (skill_name,))
    row = cur.fetchone()
    if row:
        return str(row[0])
    skill_id = str(uuid.uuid4())
    cur.execute(
        "INSERT INTO skills_master (id, name, category) VALUES (%s, %s, %s)",
        (skill_id, skill_name, category),
    )
    return skill_id


def save_parsed_data(resume_id: str, parsed: dict):
    """Persist all parsed sections into their respective tables."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            # --- Education ---
            for edu in parsed.get("education", []):
                cur.execute(
                    """
                    INSERT INTO resume_education
                        (id, resume_id, degree, stream, institution, branch, year, percentage, board)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        resume_id,
                        edu.get("degree"),
                        edu.get("stream"),
                        edu.get("institution"),
                        edu.get("branch"),
                        edu.get("year"),
                        edu.get("percentage"),
                        edu.get("board"),
                    ),
                )

            # --- Experience ---
            for exp in parsed.get("experience", []):
                cur.execute(
                    """
                    INSERT INTO resume_experience
                        (id, resume_id, company_name, role, start_date, end_date, description, is_current)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        resume_id,
                        exp.get("company_name"),
                        exp.get("role"),
                        exp.get("start_date") or None,
                        exp.get("end_date") if exp.get("end_date") != "present" else None,
                        exp.get("description"),
                        exp.get("is_current", False),
                    ),
                )

            # --- Skills ---
            for skill in parsed.get("skills", []):
                skill_name = skill.get("name")
                if not skill_name:
                    continue
                skill_id = _ensure_skill(cur, skill_name, skill.get("category"))
                cur.execute(
                    """
                    INSERT INTO resume_skills (id, resume_id, skill_id, skill_type, source)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    """,
                    (
                        str(uuid.uuid4()),
                        resume_id,
                        skill_id,
                        skill.get("skill_type"),
                        skill.get("source"),
                    ),
                )

            # --- Projects ---
            for proj in parsed.get("projects", []):
                cur.execute(
                    """
                    INSERT INTO resume_projects
                        (id, resume_id, title, description, tech_used, github_url, role)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        resume_id,
                        proj.get("title"),
                        proj.get("description"),
                        proj.get("tech_used"),
                        proj.get("github_url"),
                        proj.get("role"),
                    ),
                )

            # --- Certifications ---
            for cert in parsed.get("certifications", []):
                cur.execute(
                    """
                    INSERT INTO resume_certifications
                        (id, resume_id, cert_name, organization, url)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        resume_id,
                        cert.get("cert_name"),
                        cert.get("organization"),
                        cert.get("url"),
                    ),
                )

            # --- Feedback (deterministic ATS scoring + Gemini suggestions) ---
            ats = compute_ats_score(parsed)
            fb = parsed.get("feedback", {})

            cur.execute(
                """
                INSERT INTO resume_feedback
                    (id, resume_id, overall_score, section_scores, suggestions,
                     keyword_analysis, formatting_issues)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb)
                """,
                (
                    str(uuid.uuid4()),
                    resume_id,
                    ats["overall_score"],
                    json.dumps(ats["section_scores"]),
                    json.dumps(fb.get("suggestions", [])),
                    json.dumps(fb.get("keyword_analysis", {})),
                    json.dumps(fb.get("formatting_issues", [])),
                ),
            )

            conn.commit()

    # Only generate embedding if this resume is marked as primary
    is_primary = _is_resume_primary(resume_id)

    if is_primary:
        try:
            combined_text = _build_embedding_text(parsed)
            if combined_text.strip():
                embedding = generate_resume_embedding(combined_text)
                update_resume_status(resume_id, "completed", parsed, embedding)
            else:
                update_resume_status(resume_id, "completed", parsed)
        except Exception as e:
            print(f"Error generating embedding for resume {resume_id}: {e}")
            update_resume_status(resume_id, "completed", parsed)
    else:
        update_resume_status(resume_id, "completed", parsed)


def _is_resume_primary(resume_id: str) -> bool:
    """Check if a resume is marked as primary."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_primary FROM resumes WHERE id = %s", (resume_id,))
            row = cur.fetchone()
            return bool(row and row[0])


def _build_embedding_text(parsed: dict) -> str:
    """Combine parsed resume sections into a single text for embedding."""
    parts = []

    metadata = parsed.get("metadata") or {}
    if metadata:
        parts.append(f"Name: {metadata.get('full_name') or ''}")
        parts.append(f"Title: {metadata.get('current_title') or ''}")
        parts.append(f"Experience: {metadata.get('experience_level') or ''}")

    skills = parsed.get("skills") or []
    if skills:
        skill_names = ", ".join([(s.get("name") or "") for s in skills])
        parts.append(f"Skills: {skill_names}")

    for exp in parsed.get("experience") or []:
        desc = exp.get("description")
        if desc:
            parts.append(str(desc))

    for proj in parsed.get("projects") or []:
        desc = proj.get("description")
        if desc:
            parts.append(str(desc))

    return "\n".join(parts)


def generate_embedding_for_resume(resume_id: str) -> bool:
    """Generate and store embedding for a specific resume. Returns True on success."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT parsed_data FROM resumes WHERE id = %s", (resume_id,))
            row = cur.fetchone()
            if not row or not row[0]:
                return False
            parsed = row[0] if isinstance(row[0], dict) else json.loads(row[0])

    combined_text = _build_embedding_text(parsed)
    if not combined_text.strip():
        return False

    embedding = generate_resume_embedding(combined_text)
    update_resume_status(resume_id, "completed", embedding=embedding)
    return True


def clear_resume_embedding(resume_id: str):
    """Remove the embedding from a resume."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE resumes SET embedding = NULL, updated_at = NOW() WHERE id = %s",
                (resume_id,),
            )
            conn.commit()
