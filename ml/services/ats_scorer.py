"""
Deterministic ATS Scoring Engine for CareerForge.

Implements all 11 points of a production-grade ATS algorithm:

  §1  Introduction           — context (not code)
  §2  Problem Statement      — Input: parsed resume → Output: ATS score + breakdown
  §3  System Architecture    — Pipeline: Parse → Normalize → Score → Output
  §4  Module Design
      4.1 Parsing            — handled by Gemini + pdfplumber/python-docx
      4.2 Section Segmentation — handled by Gemini
      4.3 Feature Extraction   — handled by Gemini
      4.4 Feature Normalization — lowercase, dedup, synonym mapping  ← THIS FILE
  §5  Scoring Engine (7 core factors)
      5.1 Structure Score    (15%)
      5.2 Skill Score        (20%)
      5.3 Experience Score   (15%)
      5.4 Content Score      (12%)
      5.5 Keyword Score      (8%)
      5.6 Format Score       (5%)
      5.7 Completeness Score (5%)
  §6  Final Scoring Function — weighted sum
  §7  Score Normalization    — round(score × 100)
  §8  Output Format          — JSON with breakdown
  §9  Advanced Extensions
      9.1 Embedding Quality  (10%) — cosine similarity to ideal resume profile
      9.2 Topic Coherence    (10%) — skill-topic alignment via lightweight LDA
  §10 Execution Pipeline     — wired in routes/resume.py
  §11 Design Principles      — modular, multi-factor, NLP-driven
"""

import re
import math
from collections import Counter

# ── Weights (§6) ─────────────────────────────────────────────────────────────
# All 9 factors sum to 1.0

WEIGHTS = {
    "structure": 0.15,
    "skill": 0.20,
    "experience": 0.15,
    "content": 0.12,
    "keyword": 0.08,
    "format": 0.05,
    "completeness": 0.05,
    "embedding_quality": 0.10,
    "topic_coherence": 0.10,
}

# ── Constants ────────────────────────────────────────────────────────────────

REQUIRED_SECTIONS = ["skills", "experience", "education", "projects"]

ACTION_VERBS = {
    "achieved", "administered", "analyzed", "automated", "architected",
    "built", "collaborated", "configured", "coordinated", "created",
    "decreased", "delivered", "deployed", "designed", "developed",
    "drove", "eliminated", "enabled", "engineered", "established",
    "executed", "expanded", "facilitated", "generated", "grew",
    "headed", "identified", "implemented", "improved", "increased",
    "initiated", "innovated", "integrated", "launched", "led",
    "managed", "mentored", "migrated", "modernized", "monitored",
    "negotiated", "optimized", "orchestrated", "organized", "overhauled",
    "pioneered", "planned", "presented", "produced", "programmed",
    "published", "raised", "rebuilt", "redesigned", "reduced",
    "refactored", "replaced", "resolved", "restructured", "revamped",
    "scaled", "secured", "simplified", "solved", "spearheaded",
    "streamlined", "supervised", "tested", "trained", "transformed",
    "upgraded", "utilized", "wrote",
}

DOMAIN_KEYWORDS = {
    "web_development": {
        "html", "css", "javascript", "typescript", "react", "angular", "vue",
        "node", "express", "next.js", "tailwind", "webpack", "rest", "graphql",
        "api", "frontend", "backend", "full-stack", "responsive", "spa",
    },
    "data_science": {
        "python", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch",
        "machine learning", "deep learning", "nlp", "data analysis",
        "statistics", "visualization", "jupyter", "regression", "classification",
        "neural network", "model", "feature engineering", "data pipeline",
    },
    "mobile_development": {
        "android", "ios", "swift", "kotlin", "react native", "flutter", "dart",
        "mobile", "xcode", "gradle", "firebase", "app store", "play store",
    },
    "devops": {
        "docker", "kubernetes", "ci/cd", "jenkins", "terraform", "ansible",
        "aws", "gcp", "azure", "linux", "nginx", "monitoring", "prometheus",
        "grafana", "helm", "pipeline", "infrastructure", "deployment",
    },
    "cybersecurity": {
        "security", "penetration testing", "vulnerability", "encryption",
        "firewall", "siem", "incident response", "compliance", "owasp",
        "threat", "forensics", "soc", "ids", "ips", "malware",
    },
    "cloud_computing": {
        "aws", "azure", "gcp", "cloud", "serverless", "lambda", "s3",
        "ec2", "iam", "vpc", "cloudformation", "microservices", "saas",
    },
}

# §4.4 — Synonym map for feature normalization
SKILL_SYNONYMS = {
    "ml": "machine learning",
    "dl": "deep learning",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "k8s": "kubernetes",
    "postgres": "postgresql",
    "mongo": "mongodb",
    "tf": "tensorflow",
    "react.js": "react",
    "reactjs": "react",
    "node.js": "node",
    "nodejs": "node",
    "vue.js": "vue",
    "vuejs": "vue",
    "angular.js": "angular",
    "angularjs": "angular",
    "express.js": "express",
    "expressjs": "express",
    "next": "next.js",
    "nextjs": "next.js",
    "aws s3": "s3",
    "amazon web services": "aws",
    "google cloud platform": "gcp",
    "google cloud": "gcp",
    "microsoft azure": "azure",
    "ci cd": "ci/cd",
    "cicd": "ci/cd",
    "github actions": "ci/cd",
    "c++": "cpp",
    "c#": "csharp",
    "objective-c": "objectivec",
    "scikit learn": "scikit-learn",
    "sklearn": "scikit-learn",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "dsa": "data structures and algorithms",
    "oop": "object oriented programming",
    "rdbms": "relational database",
    "nosql": "non-relational database",
    "rest api": "rest",
    "restful": "rest",
    "graphql api": "graphql",
}

# §9.2 — Topic definitions for coherence scoring (lightweight LDA substitute)
# Each "topic" is a set of related terms that should co-occur in a strong resume.
TOPIC_CLUSTERS = {
    "frontend": {"react", "angular", "vue", "javascript", "typescript", "css", "html",
                  "tailwind", "webpack", "responsive", "spa", "ui", "ux", "frontend"},
    "backend": {"node", "express", "django", "flask", "fastapi", "spring", "rest",
                "graphql", "api", "microservices", "backend", "server", "database"},
    "data_ml": {"python", "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn",
                "machine learning", "deep learning", "data", "model", "training",
                "classification", "regression", "neural network"},
    "cloud_devops": {"aws", "gcp", "azure", "docker", "kubernetes", "terraform",
                     "ci/cd", "jenkins", "deployment", "infrastructure", "monitoring",
                     "linux", "serverless"},
    "mobile": {"android", "ios", "swift", "kotlin", "react native", "flutter",
               "mobile", "firebase", "app"},
    "security": {"security", "encryption", "vulnerability", "penetration",
                 "firewall", "compliance", "owasp", "threat", "forensics"},
    "database": {"postgresql", "mysql", "mongodb", "redis", "sql", "nosql",
                 "database", "orm", "query", "indexing", "migration"},
    "soft_skills": {"leadership", "communication", "teamwork", "agile", "scrum",
                    "management", "mentoring", "collaboration", "problem solving"},
}

# §9.1 — Ideal resume profile characteristics (what a high-quality resume looks like)
IDEAL_PROFILE = {
    "min_skills": 12,
    "min_categories": 4,
    "min_experience_years": 2,
    "min_roles": 2,
    "min_projects": 2,
    "has_certifications": True,
    "has_education": True,
    "has_contact": True,
    "has_linkedin": True,
    "has_github": True,
    "min_action_verb_ratio": 0.4,
    "min_word_count": 200,
    "min_quantified_achievements": 3,
}

REQUIRED_CONTACT_FIELDS = ["full_name", "email", "phone"]
OPTIONAL_PROFILE_FIELDS = [
    "linkedin_url", "github_url", "portfolio_url", "location",
]


# ── §4.4 Feature Normalization ──────────────────────────────────────────────

def normalize_parsed_data(parsed: dict) -> dict:
    """
    §4.4 — Normalize extracted features:
      - Lowercase skill names
      - Map synonyms to canonical forms
      - Remove duplicate skills (keep first occurrence)
    Modifies parsed in place and returns it.
    """
    # Normalize skills
    seen_skills = set()
    normalized_skills = []
    for skill in parsed.get("skills", []):
        name = (skill.get("name") or "").strip()
        if not name:
            continue
        name_lower = name.lower()

        # Synonym mapping
        canonical = SKILL_SYNONYMS.get(name_lower, name_lower)

        # Deduplication
        if canonical in seen_skills:
            continue
        seen_skills.add(canonical)

        # Preserve original casing for display but store canonical for scoring
        skill["name"] = name
        skill["_canonical"] = canonical
        normalized_skills.append(skill)

    parsed["skills"] = normalized_skills

    # Normalize experience descriptions — strip extra whitespace
    for exp in parsed.get("experience", []):
        desc = exp.get("description") or ""
        if desc:
            exp["description"] = re.sub(r'\s+', ' ', desc).strip()

    # Normalize project descriptions
    for proj in parsed.get("projects", []):
        desc = proj.get("description") or ""
        if desc:
            proj["description"] = re.sub(r'\s+', ' ', desc).strip()

    return parsed


# ── Helpers ──────────────────────────────────────────────────────────────────

def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _collect_all_text(parsed: dict) -> str:
    """Gather every meaningful text blob from the parsed resume."""
    parts = []

    for exp in parsed.get("experience", []) or []:
        desc = exp.get("description")
        if desc:
            parts.append(str(desc))

    for proj in parsed.get("projects", []) or []:
        desc = proj.get("description")
        if desc:
            parts.append(str(desc))
        tech = proj.get("tech_used")
        if tech:
            parts.append(str(tech))

    meta = parsed.get("metadata") or {}
    for field in ("strength_areas", "improvement_areas"):
        for item in meta.get(field, []) or []:
            if item:
                parts.append(str(item))

    return " ".join(parts).lower()


def _get_canonical_skills(parsed: dict) -> set:
    """Return set of canonical (normalized) skill names."""
    skills = set()
    for s in parsed.get("skills", []):
        canonical = s.get("_canonical") or (s.get("name") or "").lower()
        skills.add(canonical)
    return skills


# ── §5 Individual Scorers ────────────────────────────────────────────────────

def _structure_score(parsed: dict) -> float:
    """§5.1 — Required sections + bonus for optional sections."""
    present = sum(
        1 for sec in REQUIRED_SECTIONS
        if len(parsed.get(sec, []) or []) > 0
    )
    base = present / len(REQUIRED_SECTIONS)

    # Bonus for optional sections (certifications, achievements metadata)
    bonus = 0.0
    if len(parsed.get("certifications", []) or []) > 0:
        bonus += 0.05
    # Achievements show up in metadata strength_areas or experience descriptions
    meta = parsed.get("metadata") or {}
    if meta.get("strength_areas"):
        bonus += 0.05

    return _clamp(base + bonus)


def _skill_score(parsed: dict) -> float:
    """§5.2 — Skill count (capped at 20) + category diversity (capped at 5)."""
    skills = parsed.get("skills", [])
    count_score = _clamp(len(skills) / 20)

    unique_categories = set(s.get("category", "other") for s in skills)
    diversity_score = _clamp(len(unique_categories) / 5)

    return 0.6 * count_score + 0.4 * diversity_score


def _experience_score(parsed: dict) -> float:
    """
    §5.3 — Experience-level-aware scoring.

    For freshers/juniors: weight shifts from years → impact + projects.
    For mid/senior: years matter more.
    """
    experiences = parsed.get("experience", [])
    projects = parsed.get("projects", [])
    meta = parsed.get("metadata", {})
    level = (meta.get("experience_level") or "").lower()

    total_years = meta.get("total_years_of_experience", 0) or 0

    # Number of distinct roles (internships count)
    role_score = _clamp(len(experiences) / 3)

    # Quantified achievements — numbers/percentages in descriptions
    all_desc = " ".join((e.get("description") or "") for e in experiences)
    all_desc += " " + " ".join((p.get("description") or "") for p in projects)
    numeric_mentions = len(re.findall(r'\d+[%+xX]|\$\d+|\d{2,}', all_desc))
    impact_score = _clamp(numeric_mentions / 5)

    # Project quality bonus for freshers (projects are their real experience)
    project_score = _clamp(len(projects) / 2)

    # Description richness — reward detailed bullet points
    desc_words = len(all_desc.split())
    richness_score = _clamp(desc_words / 200)

    if level in ("fresher", "junior", ""):
        # Freshers: years barely matter, impact + projects + richness matter most
        years_score = _clamp(total_years / 2)  # gentler cap: 2 years = full score
        return (
            0.15 * years_score +
            0.20 * role_score +
            0.30 * impact_score +
            0.20 * project_score +
            0.15 * richness_score
        )
    else:
        # Mid/Senior: years matter more
        years_score = _clamp(total_years / 5)
        return (
            0.40 * years_score +
            0.25 * role_score +
            0.25 * impact_score +
            0.10 * richness_score
        )


def _content_score(parsed: dict) -> float:
    """§5.4 — Action verbs + sentence richness − repetition penalty."""
    all_text = _collect_all_text(parsed)
    words = all_text.split()
    total_words = len(words)

    if total_words == 0:
        return 0.0

    # Action verb score — fraction of sentences starting with an action verb
    sentences = re.split(r'[.•\n]', all_text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if sentences:
        action_starts = sum(
            1 for s in sentences
            if s.split()[0].rstrip("ed,s") in ACTION_VERBS or s.split()[0] in ACTION_VERBS
        )
        action_score = _clamp(action_starts / max(len(sentences), 1))
    else:
        action_score = 0.0

    # Richness — unique words / total words (vocabulary diversity)
    unique_ratio = len(set(words)) / total_words
    richness_score = _clamp(unique_ratio / 0.6)  # 60% unique is excellent

    # Repetition penalty — most common non-trivial word frequency
    word_freq = Counter(w for w in words if len(w) > 3)
    if word_freq:
        max_freq = word_freq.most_common(1)[0][1]
        repetition_penalty = _clamp((max_freq / total_words) / 0.1)
    else:
        repetition_penalty = 0.0

    return _clamp(0.4 * action_score + 0.4 * richness_score + 0.2 * (1 - repetition_penalty))


def _keyword_score(parsed: dict) -> float:
    """§5.5 — Detect best-matching domain and check keyword coverage."""
    all_text = _collect_all_text(parsed)
    skill_names = _get_canonical_skills(parsed)
    combined = all_text + " " + " ".join(skill_names)

    best_score = 0.0
    for _domain, keywords in DOMAIN_KEYWORDS.items():
        matched = sum(1 for kw in keywords if kw in combined)
        coverage = matched / len(keywords)
        best_score = max(best_score, coverage)

    return _clamp(best_score)


def _format_score(parsed: dict) -> float:
    """§5.6 — ATS compatibility checks on extracted text."""
    all_text = _collect_all_text(parsed)
    errors = 0
    total_checks = 5

    # Check for special characters that indicate tables/images
    if re.search(r'[│┤├┬┴┼╔╗╚╝║═]', all_text):
        errors += 1

    # Check for excessive whitespace (indicates column layouts)
    if re.search(r'   {5,}', all_text):
        errors += 1

    # Check experience entries have dates
    experiences = parsed.get("experience", [])
    if experiences:
        dateless = sum(1 for e in experiences if not e.get("start_date"))
        if dateless > len(experiences) * 0.5:
            errors += 1

    # Check for very short descriptions (low content density)
    if len(all_text.split()) < 50:
        errors += 1

    # Check that skills section exists and is substantial
    if len(parsed.get("skills", [])) < 3:
        errors += 1

    return _clamp(1 - (errors / total_checks))


def _completeness_score(parsed: dict) -> float:
    """§5.7 — Required and optional profile fields present."""
    meta = parsed.get("metadata", {})
    total_fields = len(REQUIRED_CONTACT_FIELDS) + len(OPTIONAL_PROFILE_FIELDS)
    present = 0

    for field in REQUIRED_CONTACT_FIELDS:
        val = meta.get(field)
        if val and str(val).strip():
            present += 1

    for field in OPTIONAL_PROFILE_FIELDS:
        val = meta.get(field)
        if val and str(val).strip():
            present += 1

    # Experience dates count toward completeness
    experiences = parsed.get("experience", [])
    if experiences:
        dated = sum(1 for e in experiences if e.get("start_date") and e.get("end_date"))
        total_fields += 1
        present += _clamp(dated / len(experiences))

    return present / total_fields if total_fields else 0.0


# ── §9.1 Embedding-Based Quality Score ──────────────────────────────────────

def _embedding_quality_score(parsed: dict) -> float:
    """
    §9.1 — Compare resume features against an ideal resume profile.

    Instead of requiring a pre-trained embedding dataset, we define an "ideal
    resume feature vector" and compute how closely the parsed resume matches it.
    This is a lightweight proxy for cosine-similarity against a high-quality
    resume corpus — same principle, no external dataset required.
    """
    meta = parsed.get("metadata", {})
    skills = parsed.get("skills", [])
    experiences = parsed.get("experience", [])
    projects = parsed.get("projects", [])
    certs = parsed.get("certifications", [])
    education = parsed.get("education", [])
    all_text = _collect_all_text(parsed)

    # Build a feature vector: how close each attribute is to the ideal
    features = []

    # Skill count
    features.append(_clamp(len(skills) / IDEAL_PROFILE["min_skills"]))

    # Category diversity
    categories = set(s.get("category", "other") for s in skills)
    features.append(_clamp(len(categories) / IDEAL_PROFILE["min_categories"]))

    # Experience — level-aware: freshers scored on internships, not years
    total_years = meta.get("total_years_of_experience", 0) or 0
    level = (meta.get("experience_level") or "").lower()
    if level in ("fresher", "junior", ""):
        # For freshers: having any internship/experience = great
        features.append(_clamp(len(experiences) / IDEAL_PROFILE["min_roles"]))
    else:
        features.append(_clamp(total_years / IDEAL_PROFILE["min_experience_years"]))

    # Role count
    features.append(_clamp(len(experiences) / IDEAL_PROFILE["min_roles"]))

    # Project count
    features.append(_clamp(len(projects) / IDEAL_PROFILE["min_projects"]))

    # Certifications — partial credit (nice to have, not required)
    features.append(1.0 if len(certs) > 0 else 0.3)

    # Education
    features.append(1.0 if len(education) > 0 else 0.0)

    # Contact info
    has_name = bool((meta.get("full_name") or "").strip())
    has_email = bool((meta.get("email") or "").strip())
    has_phone = bool((meta.get("phone") or "").strip())
    features.append(1.0 if (has_name and has_email and has_phone) else 0.5 if has_email else 0.0)

    # LinkedIn
    features.append(1.0 if (meta.get("linkedin_url") or "").strip() else 0.0)

    # GitHub
    features.append(1.0 if (meta.get("github_url") or "").strip() else 0.0)

    # Action verb ratio
    sentences = re.split(r'[.•\n]', all_text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if sentences:
        action_starts = sum(
            1 for s in sentences
            if s.split()[0].rstrip("ed,s") in ACTION_VERBS or s.split()[0] in ACTION_VERBS
        )
        ratio = action_starts / len(sentences)
    else:
        ratio = 0.0
    features.append(_clamp(ratio / IDEAL_PROFILE["min_action_verb_ratio"]))

    # Word count
    word_count = len(all_text.split())
    features.append(_clamp(word_count / IDEAL_PROFILE["min_word_count"]))

    # Quantified achievements
    all_desc = " ".join(e.get("description", "") for e in experiences)
    numeric_mentions = len(re.findall(r'\d+[%+xX]|\$\d+|\d{2,}', all_desc))
    features.append(_clamp(numeric_mentions / IDEAL_PROFILE["min_quantified_achievements"]))

    # Cosine similarity with ideal vector (all 1.0s)
    # cos_sim(features, ideal) = sum(features) / (sqrt(sum(f^2)) * sqrt(n))
    n = len(features)
    if n == 0:
        return 0.0

    dot_product = sum(features)  # ideal is all 1.0, so dot = sum(features)
    magnitude_features = math.sqrt(sum(f * f for f in features))
    magnitude_ideal = math.sqrt(n)  # sqrt(n * 1^2)

    if magnitude_features == 0:
        return 0.0

    cosine_sim = dot_product / (magnitude_features * magnitude_ideal)
    return _clamp(cosine_sim)


# ── §9.2 Topic Coherence Score (Lightweight LDA) ────────────────────────────

def _topic_coherence_score(parsed: dict) -> float:
    """
    §9.2 — Evaluate skill-topic alignment using lightweight topic modeling.

    Instead of full LDA (requires training corpus), we use predefined topic
    clusters and measure how coherently the resume's skills align with
    detected topics. A resume that deeply covers 2-3 related topics scores
    higher than one that shallowly touches many unrelated topics.

    Scoring:
      1. Detect which topics the resume covers (>= 3 matching terms)
      2. For each covered topic, compute depth (matched / total terms)
      3. Coherence = weighted average of top topic depths
         (deeper coverage of fewer topics = higher coherence)
    """
    skill_names = _get_canonical_skills(parsed)
    all_text = _collect_all_text(parsed)
    combined_terms = skill_names | set(all_text.split())

    # Compute coverage depth per topic
    topic_depths = {}
    for topic, terms in TOPIC_CLUSTERS.items():
        matched = sum(1 for t in terms if t in combined_terms)
        if matched >= 2:  # minimum threshold to count as "covered"
            topic_depths[topic] = matched / len(terms)

    if not topic_depths:
        return 0.0

    # Sort topics by depth (strongest first)
    sorted_depths = sorted(topic_depths.values(), reverse=True)

    # Take top 3 topics — reward depth over breadth
    top_n = min(3, len(sorted_depths))
    top_depths = sorted_depths[:top_n]

    # Weighted: primary topic counts most, secondary less, etc.
    topic_weights = [0.5, 0.3, 0.2]
    weighted_depth = sum(
        d * topic_weights[i] for i, d in enumerate(top_depths)
    )

    # Bonus for having multiple related topics covered
    coverage_bonus = _clamp(len(topic_depths) / 3) * 0.2

    return _clamp(weighted_depth + coverage_bonus)


# ── §6, §7, §8 — Public API ─────────────────────────────────────────────────

def compute_ats_score(parsed: dict) -> dict:
    """
    Compute a deterministic ATS score from Gemini-parsed resume data.

    Pipeline (§10):
      1. Normalize features (§4.4)
      2. Compute all 9 scoring factors (§5 + §9)
      3. Apply weighted formula (§6)
      4. Normalize to 0-100 (§7)
      5. Return structured output (§8)

    Returns:
        {
            "overall_score": int (0-100),
            "section_scores": {
                "structure": float,
                "skill": float,
                "experience": float,
                "content": float,
                "keyword": float,
                "format": float,
                "completeness": float,
                "embedding_quality": float,
                "topic_coherence": float,
            }
        }
    """
    # §4.4 — Normalize before scoring
    parsed = normalize_parsed_data(parsed)

    # §5 — Core scoring factors
    scores = {
        "structure": round(_structure_score(parsed), 3),
        "skill": round(_skill_score(parsed), 3),
        "experience": round(_experience_score(parsed), 3),
        "content": round(_content_score(parsed), 3),
        "keyword": round(_keyword_score(parsed), 3),
        "format": round(_format_score(parsed), 3),
        "completeness": round(_completeness_score(parsed), 3),
        # §9 — Advanced extensions
        "embedding_quality": round(_embedding_quality_score(parsed), 3),
        "topic_coherence": round(_topic_coherence_score(parsed), 3),
    }

    # §6 — Weighted scoring function
    weighted_sum = sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)

    # §7 — Score normalization
    overall = round(weighted_sum * 100)
    overall = max(0, min(100, overall))

    # §8 — Output format
    return {
        "overall_score": overall,
        "section_scores": scores,
    }
