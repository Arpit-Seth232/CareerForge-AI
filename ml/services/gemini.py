import io
import json
import pdfplumber
from docx import Document
import google.generativeai as genai

import config
from prompts.resume_parser import RESUME_PARSE_PROMPT

genai.configure(api_key=config.GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-flash")


def extract_text_from_pdf(raw_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
        # Extract hyperlinks embedded in the PDF (not visible in text extraction)
        links = []
        for page in pdf.pages:
            if page.hyperlinks:
                for link in page.hyperlinks:
                    uri = link.get("uri", "")
                    if uri:
                        links.append(uri)

    text = "\n".join(pages)
    if links:
        unique_links = list(dict.fromkeys(links))  # dedupe, preserve order
        text += "\n\n--- EMBEDDED LINKS FOUND IN PDF ---\n"
        text += "\n".join(unique_links)
    return text


def extract_text_from_docx(raw_bytes: bytes) -> str:
    doc = Document(io.BytesIO(raw_bytes))
    return "\n".join(p.text for p in doc.paragraphs)


def extract_text(raw_bytes: bytes, file_type: str) -> str:
    if file_type in ("pdf",):
        return extract_text_from_pdf(raw_bytes)
    if file_type in ("docx", "doc"):
        return extract_text_from_docx(raw_bytes)
    raise ValueError(f"Unsupported file type: {file_type}")


async def parse_resume(raw_bytes: bytes, file_type: str) -> dict:
    """Extract text from resume and parse it with Gemini."""
    resume_text = extract_text(raw_bytes, file_type)

    if not resume_text.strip():
        raise ValueError("Could not extract any text from the resume file.")

    prompt = RESUME_PARSE_PROMPT.replace("{resume_text}", resume_text)
    response = _model.generate_content(prompt)

    text = response.text.strip()
    # Strip markdown code fences if Gemini wraps the response
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    if text.startswith("json"):
        text = text[4:]

    return json.loads(text)
