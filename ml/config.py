import os
from dotenv import load_dotenv

load_dotenv()

# Supabase S3
SUPABASE_S3_ENDPOINT = os.getenv("SUPABASE_S3_ENDPOINT")
SUPABASE_S3_REGION = os.getenv("SUPABASE_S3_REGION")
SUPABASE_S3_ACCESS_KEY_ID = os.getenv("SUPABASE_S3_ACCESS_KEY_ID")
SUPABASE_S3_SECRET_ACCESS_KEY = os.getenv("SUPABASE_S3_SECRET_ACCESS_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "resumes")
SUPABASE_URL = os.getenv("SUPABASE_URL")

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Database
DATABASE_URL = os.getenv("DATABASE_URL")

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
