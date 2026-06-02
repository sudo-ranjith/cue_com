import io
import logging
import uuid
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)


def _get_s3_client():
    """Return a boto3 S3 client."""
    import boto3
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def upload_file(
    file_bytes: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    folder: str = "uploads",
) -> Optional[str]:
    """
    Upload a file to S3.

    Args:
        file_bytes: File content as bytes
        filename: Destination filename (will be prefixed with folder)
        content_type: MIME type of the file
        folder: S3 folder/prefix

    Returns:
        Public URL of the uploaded file, or None on failure
    """
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_S3_BUCKET:
        logger.warning("AWS S3 not configured. File upload skipped.")
        return None

    try:
        s3 = _get_s3_client()
        key = f"{folder}/{filename}"
        s3.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
            ACL="public-read",
        )
        url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
        logger.info("Uploaded file to S3: %s", url)
        return url
    except Exception as exc:
        logger.error("S3 upload failed for %s: %s", filename, exc)
        return None


def upload_image(
    file_bytes: bytes,
    original_filename: str,
    folder: str = "products",
) -> Optional[str]:
    """
    Upload an image to S3 with a unique filename.

    Returns:
        Public URL of the image, or None on failure
    """
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "jpg"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    content_type_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
    }
    content_type = content_type_map.get(ext, "image/jpeg")
    return upload_file(file_bytes, unique_name, content_type, folder)


def upload_invoice(pdf_bytes: bytes, order_number: str) -> Optional[str]:
    """
    Upload an invoice PDF to S3.

    Returns:
        Public URL of the PDF, or None on failure
    """
    filename = f"invoice_{order_number}.pdf"
    return upload_file(pdf_bytes, filename, "application/pdf", "invoices")


def delete_file(url: str) -> bool:
    """
    Delete a file from S3 given its public URL.

    Returns:
        True on success, False on failure
    """
    if not settings.AWS_S3_BUCKET or not settings.AWS_ACCESS_KEY_ID:
        return False

    try:
        # Extract the key from the URL
        prefix = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/"
        if not url.startswith(prefix):
            logger.warning("URL does not belong to configured bucket: %s", url)
            return False
        key = url[len(prefix):]

        s3 = _get_s3_client()
        s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
        logger.info("Deleted S3 object: %s", key)
        return True
    except Exception as exc:
        logger.error("S3 delete failed for %s: %s", url, exc)
        return False


def generate_presigned_url(key: str, expiration: int = 3600) -> Optional[str]:
    """
    Generate a pre-signed URL for temporary access to a private S3 object.

    Args:
        key: S3 object key
        expiration: URL expiry in seconds (default 1 hour)

    Returns:
        Pre-signed URL string, or None on failure
    """
    if not settings.AWS_S3_BUCKET or not settings.AWS_ACCESS_KEY_ID:
        return None
    try:
        s3 = _get_s3_client()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
            ExpiresIn=expiration,
        )
        return url
    except Exception as exc:
        logger.error("Failed to generate presigned URL for %s: %s", key, exc)
        return None
