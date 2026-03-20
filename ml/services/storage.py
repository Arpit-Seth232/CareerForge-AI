import uuid
import boto3
from botocore.config import Config as BotoConfig
from fastapi import UploadFile

import config


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=config.SUPABASE_S3_ENDPOINT,
        region_name=config.SUPABASE_S3_REGION,
        aws_access_key_id=config.SUPABASE_S3_ACCESS_KEY_ID,
        aws_secret_access_key=config.SUPABASE_S3_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
    )


async def upload_avatar_to_supabase(
    file: UploadFile, user_id: str
) -> str:
    """Upload an avatar image to Supabase S3 storage. Returns the public URL."""
    s3 = _get_s3_client()

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    s3_key = f"avatars/{user_id}/{unique_name}"

    content = await file.read()

    s3.put_object(
        Bucket=config.SUPABASE_BUCKET,
        Key=s3_key,
        Body=content,
        ContentType=file.content_type or "image/png",
    )

    return (
        f"{config.SUPABASE_URL}/storage/v1/object/public/"
        f"{config.SUPABASE_BUCKET}/{s3_key}"
    )


async def upload_resume_to_supabase(
    file: UploadFile, user_id: str
) -> dict:
    """Upload a resume file to Supabase S3 storage.

    Returns dict with file_name, file_url, file_type, s3_key.
    """
    s3 = _get_s3_client()

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "pdf"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    s3_key = f"{user_id}/{unique_name}"

    content = await file.read()

    s3.put_object(
        Bucket=config.SUPABASE_BUCKET,
        Key=s3_key,
        Body=content,
        ContentType=file.content_type or "application/pdf",
    )

    file_url = (
        f"{config.SUPABASE_URL}/storage/v1/object/public/"
        f"{config.SUPABASE_BUCKET}/{s3_key}"
    )

    return {
        "file_name": file.filename,
        "file_url": file_url,
        "file_type": ext,
        "s3_key": s3_key,
        "raw_bytes": content,
    }
