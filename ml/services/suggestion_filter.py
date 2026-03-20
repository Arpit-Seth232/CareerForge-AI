"""
Post-processing filter for AI-generated resume suggestions.

Validates Gemini suggestions against actual parsed data to remove
contradictory or irrelevant recommendations. The LLM sometimes suggests
adding things that already exist in the resume — this filter catches that.
"""

import re


def filter_suggestions(suggestions: list[str], parsed: dict) -> list[str]:
    """
    Remove suggestions that contradict the parsed resume data.

    Args:
        suggestions: Raw suggestions from Gemini
        parsed: The full parsed resume dict (metadata, skills, experience, etc.)

    Returns:
        Filtered list of valid suggestions
    """
    if not suggestions:
        return []

    meta = parsed.get("metadata", {})
    skills = parsed.get("skills", [])
    experience = parsed.get("experience", [])
    projects = parsed.get("projects", [])
    certifications = parsed.get("certifications", [])
    education = parsed.get("education", [])

    # Build sets of what exists for quick lookup
    skill_names = {(s.get("name") or "").lower() for s in skills}
    skill_names |= {(s.get("_canonical") or "").lower() for s in skills if s.get("_canonical")}
    skill_names.discard("")

    has_linkedin = bool((meta.get("linkedin_url") or "").strip())
    has_github = bool((meta.get("github_url") or "").strip())
    has_portfolio = bool((meta.get("portfolio_url") or "").strip())
    has_email = bool((meta.get("email") or "").strip())
    has_phone = bool((meta.get("phone") or "").strip())

    # Check if projects have github urls
    project_has_github = any((p.get("github_url") or "").strip() for p in projects)
    has_any_github = has_github or project_has_github

    # Check if experience has quantified achievements
    all_exp_desc = " ".join((e.get("description") or "") for e in experience)
    has_quantified = bool(re.findall(r'\d+[%+xX]|\$\d+', all_exp_desc))
    numeric_count = len(re.findall(r'\d+[%+xX]|\$\d+|\d{2,}', all_exp_desc))

    # Check for soft skills
    soft_skills = {(s.get("name") or "").lower() for s in skills if s.get("skill_type") == "soft"}
    has_soft_skills = len(soft_skills) >= 2

    # Check if experience has descriptions
    has_exp_descriptions = any((e.get("description") or "").strip() for e in experience)

    # Check if dates are already properly formatted (e.g., "May 2025 – Aug 2025")
    all_dates = []
    for exp in experience:
        sd = (exp.get("start_date") or "")
        ed = (exp.get("end_date") or "")
        if sd:
            all_dates.append(sd)
        if ed:
            all_dates.append(ed)
    # If Gemini parsed valid dates, the original formatting was fine
    has_proper_dates = len(all_dates) >= 2

    filtered = []
    for suggestion in suggestions:
        s_lower = suggestion.lower()

        # Filter: date formatting suggestions when dates are already well-formatted
        if has_proper_dates and _mentions_date_formatting(s_lower):
            continue

        # Filter: "links are blank/missing" when projects have embedded URLs
        if project_has_github and _mentions_blank_links(s_lower):
            continue

        # Filter: "add LinkedIn" when LinkedIn already exists
        if has_linkedin and _mentions_adding(s_lower, ["linkedin"]):
            continue

        # Filter: "add GitHub" when GitHub already exists
        if has_any_github and _mentions_adding(s_lower, ["github"]):
            continue

        # Filter: "add portfolio" when portfolio exists
        if has_portfolio and _mentions_adding(s_lower, ["portfolio"]):
            continue

        # Filter: "add email/phone" when they exist
        if has_email and _mentions_adding(s_lower, ["email", "e-mail"]):
            continue
        if has_phone and _mentions_adding(s_lower, ["phone", "contact number"]):
            continue

        # Filter: "add quantifiable achievements" when they already have them
        if numeric_count >= 3 and _mentions_adding(s_lower, [
            "quantif", "quantitat", "numbers", "metrics", "measurable"
        ]):
            continue

        # Filter: "add soft skills" when soft skills already exist
        if has_soft_skills and _mentions_adding(s_lower, ["soft skill"]):
            continue

        # Filter: "add <specific skill>" when that skill is already listed
        for skill_name in skill_names:
            if len(skill_name) >= 3 and _mentions_adding(s_lower, [skill_name]):
                break
        else:
            # No skill match triggered the break — suggestion is valid
            filtered.append(suggestion)
            continue

        # If we got here, a skill match was found — skip this suggestion

    return filtered


def _mentions_blank_links(text: str) -> bool:
    """Check if the suggestion claims links/URLs are blank, missing, or broken in the PDF."""
    return any(kw in text for kw in [
        "blank", "empty link", "embedded link", "properly associated",
        "was blank", "missing link", "broken link", "link was",
        "repo:", "deploy:", "ensure all", "visible text",
    ])


def _mentions_date_formatting(text: str) -> bool:
    """Check if the suggestion is about date formatting/standardization."""
    date_keywords = ["date format", "standardize date", "date consistency",
                     "consistent date", "date style", "format date",
                     "date readability", "date presentation"]
    return any(kw in text for kw in date_keywords)


def _mentions_adding(text: str, keywords: list[str]) -> bool:
    """
    Check if the text suggests adding/including something matching the keywords.

    Matches patterns like:
      - "add Python to your skills"
      - "include a LinkedIn link"
      - "provide GitHub URLs"
      - "consider adding a portfolio"
    """
    add_patterns = [
        "add ", "include ", "provide ", "consider adding",
        "consider including", "missing ", "lacks ", "no ",
        "doesn't have", "does not have", "doesn't include",
        "does not include", "should have", "should include",
    ]

    for kw in keywords:
        if kw not in text:
            continue
        # Check if any "add" pattern appears near the keyword
        for pattern in add_patterns:
            if pattern in text:
                return True
        # Also catch "LinkedIn/GitHub ... clickable/direct/URL"
        if any(w in text for w in ["clickable", "direct", "url", "link"]):
            return True

    return False
