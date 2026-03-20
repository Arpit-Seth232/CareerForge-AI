import uuid
import json
import psycopg
import google.generativeai as genai

import config
from prompts.roadmap_generator import ROADMAP_GENERATE_PROMPT

genai.configure(api_key=config.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")


def _get_conn():
    return psycopg.connect(config.DATABASE_URL)


def fetch_user_resume_data(user_id: str) -> dict:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT current_title, experience_level, year_of_exp,
                          role_preference, full_name
                   FROM job_seeker_profiles WHERE user_id = %s""",
                (user_id,),
            )
            row = cur.fetchone()
            profile = {
                "current_title": row[0] if row else "Not specified",
                "experience_level": row[1] if row else "Not specified",
                "years_of_exp": row[2] if row else 0,
                "role_preference": row[3] if row else "Not specified",
                "full_name": row[4] if row else "User",
            }

            cur.execute(
                """SELECT id FROM resumes
                   WHERE user_id = %s AND status = 'completed' AND is_primary = true
                   LIMIT 1""",
                (user_id,),
            )
            resume_row = cur.fetchone()

            if not resume_row:
                cur.execute(
                    """SELECT id FROM resumes
                       WHERE user_id = %s AND status = 'completed'
                       ORDER BY created_at DESC LIMIT 1""",
                    (user_id,),
                )
                resume_row = cur.fetchone()

            if not resume_row:
                raise ValueError("No completed resume found. Please upload a resume first.")

            resume_id = str(resume_row[0])

            cur.execute(
                """SELECT sm.name, sm.category, rs.skill_type
                   FROM resume_skills rs
                   JOIN skills_master sm ON rs.skill_id = sm.id
                   WHERE rs.resume_id = %s""",
                (resume_id,),
            )
            skills = [{"name": r[0], "category": r[1], "type": r[2]} for r in cur.fetchall()]

            cur.execute(
                "SELECT degree, stream, institution, year FROM resume_education WHERE resume_id = %s",
                (resume_id,),
            )
            education = [
                {"degree": r[0], "stream": r[1], "institution": r[2], "year": r[3]}
                for r in cur.fetchall()
            ]

            cur.execute(
                """SELECT company_name, role, start_date, end_date, description
                   FROM resume_experience WHERE resume_id = %s ORDER BY start_date DESC""",
                (resume_id,),
            )
            experience = [
                {
                    "company": r[0],
                    "role": r[1],
                    "start": str(r[2]) if r[2] else None,
                    "end": str(r[3]) if r[3] else "present",
                    "description": r[4],
                }
                for r in cur.fetchall()
            ]

            cur.execute(
                "SELECT title, description, tech_used FROM resume_projects WHERE resume_id = %s",
                (resume_id,),
            )
            projects = [
                {"title": r[0], "description": r[1], "tech_used": r[2]} for r in cur.fetchall()
            ]

            cur.execute(
                "SELECT cert_name, organization FROM resume_certifications WHERE resume_id = %s",
                (resume_id,),
            )
            certifications = [{"name": r[0], "organization": r[1]} for r in cur.fetchall()]

            cur.execute(
                """SELECT overall_score, suggestions
                   FROM resume_feedback WHERE resume_id = %s
                   ORDER BY created_at DESC LIMIT 1""",
                (resume_id,),
            )
            fb_row = cur.fetchone()
            feedback = {
                "overall_score": fb_row[0] if fb_row else 0,
                "suggestions": fb_row[1] if fb_row and fb_row[1] else [],
            }

            cur.execute("SELECT parsed_data FROM resumes WHERE id = %s", (resume_id,))
            parsed_row = cur.fetchone()
            strength_areas = []
            improvement_areas = []
            if parsed_row and parsed_row[0]:
                raw = parsed_row[0]
                pd = raw if isinstance(raw, dict) else json.loads(raw) if isinstance(raw, str) else {}
                metadata = pd.get("metadata", {})
                strength_areas = metadata.get("strength_areas", [])
                improvement_areas = metadata.get("improvement_areas", [])

    return {
        "profile": profile,
        "skills": skills,
        "education": education,
        "experience": experience,
        "projects": projects,
        "certifications": certifications,
        "feedback": feedback,
        "strength_areas": strength_areas,
        "improvement_areas": improvement_areas,
    }


def _fmt_skills(skills: list) -> str:
    grouped = {}
    for s in skills:
        cat = s.get("category") or "other"
        grouped.setdefault(cat, []).append(s["name"])
    return "\n".join(f"  - {cat}: {', '.join(names)}" for cat, names in grouped.items()) or "  None"


def _fmt_education(education: list) -> str:
    lines = []
    for e in education:
        line = f"  - {e.get('degree', 'N/A')} in {e.get('stream', 'N/A')} from {e.get('institution', 'N/A')}"
        if e.get("year"):
            line += f" ({e['year']})"
        lines.append(line)
    return "\n".join(lines) or "  None"


def _fmt_experience(experience: list) -> str:
    lines = []
    for e in experience:
        period = f"{e.get('start', '?')} to {e.get('end', 'present')}"
        lines.append(f"  - {e.get('role', 'N/A')} at {e.get('company', 'N/A')} ({period})")
        if e.get("description"):
            lines.append(f"    {e['description'][:200]}")
    return "\n".join(lines) or "  None"


def _fmt_projects(projects: list) -> str:
    lines = []
    for p in projects:
        lines.append(f"  - {p.get('title', 'N/A')}: {(p.get('description') or '')[:150]}")
        if p.get("tech_used"):
            lines.append(f"    Tech: {p['tech_used']}")
    return "\n".join(lines) or "  None"


def _fmt_certs(certifications: list) -> str:
    return "\n".join(
        f"  - {c.get('name', 'N/A')} ({c.get('organization', 'N/A')})" for c in certifications
    ) or "  None"


def build_prompt(user_data: dict, target_role: str) -> str:
    p = user_data["profile"]
    replacements = {
        "{current_title}": p.get("current_title") or "Not specified",
        "{experience_level}": p.get("experience_level") or "Not specified",
        "{years_of_exp}": str(p.get("years_of_exp", 0)),
        "{role_preference}": p.get("role_preference") or "Not specified",
        "{target_role}": target_role,
        "{skills_section}": _fmt_skills(user_data["skills"]),
        "{education_section}": _fmt_education(user_data["education"]),
        "{experience_section}": _fmt_experience(user_data["experience"]),
        "{projects_section}": _fmt_projects(user_data["projects"]),
        "{certifications_section}": _fmt_certs(user_data["certifications"]),
        "{overall_score}": str(user_data["feedback"].get("overall_score", 0)),
        "{strength_areas}": ", ".join(user_data.get("strength_areas", [])) or "Not available",
        "{improvement_areas}": ", ".join(user_data.get("improvement_areas", [])) or "Not available",
    }
    prompt = ROADMAP_GENERATE_PROMPT
    for placeholder, value in replacements.items():
        prompt = prompt.replace(placeholder, value)
    return prompt


def save_roadmap_to_db(user_id: str, roadmap_data: dict) -> str:
    roadmap_id = str(uuid.uuid4())
    milestones = roadmap_data.get("milestones", [])

    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE career_roadmaps SET is_active = false, updated_at = NOW() WHERE job_seeker_id = %s AND is_active = true",
                (user_id,),
            )

            cur.execute(
                """INSERT INTO career_roadmaps
                       (id, job_seeker_id, target, goal, target_timeline,
                        current_milestone, total_milestones, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, true)""",
                (
                    roadmap_id,
                    user_id,
                    roadmap_data["target"],
                    roadmap_data.get("goal"),
                    roadmap_data.get("target_timeline"),
                    0,
                    len(milestones),
                ),
            )

            for i, m in enumerate(milestones):
                cur.execute(
                    """INSERT INTO roadmap_milestones
                           (id, roadmap_id, title, description, order_index,
                            action_items, resources, status, estimated_weeks)
                       VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, 'pending', %s)""",
                    (
                        str(uuid.uuid4()),
                        roadmap_id,
                        m["title"],
                        m.get("description"),
                        m.get("order_index", i),
                        json.dumps(m.get("action_items", [])),
                        json.dumps(m.get("resources", [])),
                        m.get("estimated_weeks"),
                    ),
                )

            conn.commit()

    return roadmap_id


async def generate_roadmap(user_id: str, target_role: str) -> dict:
    user_data = fetch_user_resume_data(user_id)
    prompt = build_prompt(user_data, target_role)
    response = _model.generate_content(prompt)

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    if text.startswith("json"):
        text = text[4:]

    roadmap_data = json.loads(text)
    roadmap_id = save_roadmap_to_db(user_id, roadmap_data)

    return {
        "roadmap_id": roadmap_id,
        "target": roadmap_data["target"],
        "goal": roadmap_data["goal"],
        "target_timeline": roadmap_data["target_timeline"],
        "skill_gaps": roadmap_data.get("skill_gaps", []),
        "total_milestones": len(roadmap_data["milestones"]),
        "current_milestone": 0,
        "milestones": roadmap_data["milestones"],
    }
