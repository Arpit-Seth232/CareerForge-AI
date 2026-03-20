RESUME_PARSE_PROMPT = """
You are an expert resume parser for CareerForge, an AI-powered career platform.
Your job is to extract EVERY piece of structured information from the resume text below
and return it as a single valid JSON object. Be thorough — do not skip any section.

=== EXTRACTION RULES ===

1. **Skills**: Extract ALL skills mentioned anywhere in the resume — in the skills section,
   inside project descriptions, work experience bullet points, certifications, summary, etc.
   Classify each skill into one of these categories:
   - "programming_language" (Python, Java, C++, JavaScript, TypeScript, Go, Rust, etc.)
   - "framework" (React, Angular, Django, Flask, FastAPI, Spring Boot, Express, Next.js, etc.)
   - "database" (PostgreSQL, MySQL, MongoDB, Redis, Supabase, Firebase, DynamoDB, etc.)
   - "cloud" (AWS, GCP, Azure, Docker, Kubernetes, Terraform, CI/CD, etc.)
   - "tool" (Git, VS Code, Jira, Figma, Postman, Linux, Nginx, etc.)
   - "data_science" (Pandas, NumPy, TensorFlow, PyTorch, Scikit-learn, NLP, Computer Vision, etc.)
   - "soft_skill" (Leadership, Communication, Team Management, Agile, Scrum, etc.)
   - "domain" (Machine Learning, Web Development, Mobile Development, DevOps, Cybersecurity, etc.)
   - "other" (anything that doesn't fit above)

   For each skill also provide:
   - "source": where you found it — "skills_section", "experience", "projects", "certifications", "summary"
   - "skill_type": "technical" or "soft"

2. **Education**: Extract ALL educational qualifications. For Indian resumes, look for:
   - B.Tech/B.E./M.Tech/M.E./BCA/MCA/BSc/MSc/MBA/PhD etc.
   - 10th / 12th board exams (CBSE, ICSE, State Board)
   - Percentage / CGPA / GPA
   - Stream / Branch / Specialization
   For each entry extract: degree, stream (field of study), institution, branch, year, percentage/CGPA, board (if applicable)

3. **Experience**: Extract ALL work experiences including internships.
   For each: company_name, role/title, start_date (YYYY-MM-DD or partial), end_date (YYYY-MM-DD or "present"),
   is_current (true/false), description (keep the original bullet points as a single string)

4. **Projects**: Extract ALL projects.
   For each: title, description (brief summary), tech_used (comma-separated string of technologies),
   github_url (if mentioned), role (your role in the project — if not explicit, infer from context)

5. **Certifications**: Extract ALL certifications, courses, and online credentials.
   For each: cert_name, organization (issuing body like Coursera, AWS, Google, etc.), url (if mentioned)

6. **Resume Feedback** (qualitative only — scores are computed separately):
   - suggestions: array of actionable improvement strings (at least 5, be specific and helpful)
   - keyword_analysis: { "strong_keywords": [...], "missing_keywords": [...], "industry_alignment": "Technology" | "Finance" | "Healthcare" | etc. }
   - formatting_issues: array of formatting problems found (empty array if none)
   NOTE: Do NOT include overall_score or section_scores — those are computed by our scoring engine.

   CRITICAL RULES FOR SUGGESTIONS:
   - You MUST cross-check your suggestions against the data you already extracted above.
   - NEVER suggest adding something that is already present in the resume. For example:
     - If you extracted linkedin_url in metadata, do NOT suggest "add LinkedIn link"
     - If you extracted github_url in metadata or projects, do NOT suggest "add GitHub link"
     - If a skill like Python is in the skills array, do NOT suggest "add Python"
     - If experience has quantified achievements (numbers/%), do NOT suggest "add quantifiable achievements"
   - Each suggestion must be specific to what is genuinely MISSING or WEAK in THIS resume.
   - Reference the exact section or content you are critiquing.
   - Focus on: missing sections, weak descriptions, missing keywords for their target industry,
     formatting problems, content gaps compared to industry standards.

7. **Summary metadata**:
   - full_name: candidate's name
   - email: if present
   - phone: if present
   - linkedin_url: if present
   - github_url: if present
   - portfolio_url: if present
   - location: city/state if mentioned
   - experience_level: "Fresher" | "Junior" | "Mid" | "Senior" | "Lead" | "Principal"
     (Fresher = 0 yrs, Junior = 0-2 yrs, Mid = 2-5 yrs, Senior = 5-10 yrs, Lead = 10-15 yrs, Principal = 15+ yrs)
   - total_years_of_experience: number (calculate from work experiences, 0 for freshers)
   - current_title: their most recent job title or "Student" / "Fresher"
   - industry_match: primary industry the candidate fits into
   - strength_areas: array of top 3-5 strength areas
   - improvement_areas: array of top 3-5 areas needing improvement

=== OUTPUT FORMAT ===

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, no code fences):

{
  "metadata": {
    "full_name": "",
    "email": "",
    "phone": "",
    "linkedin_url": "",
    "github_url": "",
    "portfolio_url": "",
    "location": "",
    "experience_level": "",
    "total_years_of_experience": 0,
    "current_title": "",
    "industry_match": "",
    "strength_areas": [],
    "improvement_areas": []
  },
  "skills": [
    {
      "name": "Python",
      "category": "programming_language",
      "skill_type": "technical",
      "source": "skills_section"
    }
  ],
  "education": [
    {
      "degree": "B.Tech",
      "stream": "Computer Science",
      "institution": "IIT Delhi",
      "branch": "Computer Science and Engineering",
      "year": 2024,
      "percentage": 85.5,
      "board": null
    }
  ],
  "experience": [
    {
      "company_name": "Google",
      "role": "Software Engineer Intern",
      "start_date": "2023-05-01",
      "end_date": "2023-08-01",
      "is_current": false,
      "description": "Worked on search ranking algorithms..."
    }
  ],
  "projects": [
    {
      "title": "CareerForge",
      "description": "AI-powered career platform...",
      "tech_used": "React, FastAPI, PostgreSQL",
      "github_url": "https://github.com/user/project",
      "role": "Full-stack Developer"
    }
  ],
  "certifications": [
    {
      "cert_name": "AWS Solutions Architect",
      "organization": "Amazon Web Services",
      "url": ""
    }
  ],
  "feedback": {
    "suggestions": [
      "Add quantifiable achievements to work experience (e.g., 'Reduced latency by 30%')",
      "Include more relevant keywords for ATS optimization",
      "Add a professional summary section at the top",
      "Use stronger action verbs like 'architected', 'optimized', 'spearheaded'",
      "Add links to live projects or GitHub repositories"
    ],
    "keyword_analysis": {
      "strong_keywords": ["Python", "Machine Learning"],
      "missing_keywords": ["CI/CD", "Agile", "System Design"],
      "industry_alignment": "Technology"
    },
    "formatting_issues": []
  }
}

=== RESUME TEXT ===

{resume_text}
"""
