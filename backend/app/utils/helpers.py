import random
import string
import re
from datetime import datetime
from typing import Optional


def generate_link_token(length: int = 8) -> str:
    """Generate a random alphanumeric string for product link tokens."""
    chars = string.ascii_letters + string.digits
    return "".join(random.choices(chars, k=length))


def generate_order_number() -> str:
    """Generate an order number in the format ORD-YYYYMMDD-XXXX."""
    date_str = datetime.utcnow().strftime("%Y%m%d")
    random_digits = "".join(random.choices(string.digits, k=4))
    return f"ORD-{date_str}-{random_digits}"


def slugify(text: str) -> str:
    """Convert a string to a URL-friendly slug."""
    text = text.lower().strip()
    # Replace spaces and special chars with hyphens
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")
    return text


def generate_unique_slug(base_slug: str, db, model_class) -> str:
    """Generate a unique slug by appending a suffix if needed."""
    slug = slugify(base_slug)
    counter = 0
    candidate = slug
    while db.query(model_class).filter(model_class.slug == candidate).first() is not None:
        counter += 1
        candidate = f"{slug}-{counter}"
    return candidate


def format_currency(amount_paise: int) -> str:
    """Format amount from paise to INR string."""
    rupees = amount_paise / 100
    return f"₹{rupees:,.2f}"


def amount_to_paise(amount) -> int:
    """Convert Decimal/float rupee amount to paise (integer)."""
    return int(float(amount) * 100)


def paise_to_rupees(paise: int):
    """Convert paise to rupees as Decimal."""
    from decimal import Decimal
    return Decimal(str(paise)) / Decimal("100")


def get_client_ip(request) -> Optional[str]:
    """Extract client IP from request, respecting X-Forwarded-For header."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return None
