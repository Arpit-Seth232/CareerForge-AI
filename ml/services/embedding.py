"""
Embedding service for generating vector embeddings for resumes.
Uses sentence-transformers for generating dense vector representations.
"""

from sentence_transformers import SentenceTransformer

# Initialize the embedding model globally (loads once)
# nomic-embed-text-v1.5 generates 768-dimensional embeddings
_model = SentenceTransformer("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)


def generate_resume_embedding(resume_text: str) -> list[float]:
    """
    Generate a dense vector embedding for resume text.
    
    Args:
        resume_text: The combined resume text (metadata + content)
    
    Returns:
        A list of floats representing the embedding vector (1536 dimensions)
    """
    if not resume_text.strip():
        raise ValueError("Resume text cannot be empty")
    
    # Truncate very long resumes to avoid excessive processing
    # Most models have context limits
    max_length = 10000
    if len(resume_text) > max_length:
        resume_text = resume_text[:max_length]
    
    # Generate embedding
    embedding = _model.encode(resume_text, convert_to_tensor=False)
    
    # Convert to list of floats for database storage
    return embedding.tolist()


def generate_skill_embedding(skill_name: str) -> list[float]:
    """
    Generate embedding for a skill name.
    Useful for semantic search of skills.
    
    Args:
        skill_name: The skill name string
    
    Returns:
        A list of floats representing the embedding vector
    """
    if not skill_name.strip():
        raise ValueError("Skill name cannot be empty")
    
    embedding = _model.encode(skill_name, convert_to_tensor=False)
    return embedding.tolist()
