"""
Auth service: password reset token store and helper utilities.
Uses an in-memory dict with 1-hour expiry for simplicity.
"""
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple

# In-memory store: token -> (user_id, expiry_datetime)
_reset_tokens: Dict[str, Tuple[str, datetime]] = {}

TOKEN_EXPIRY_HOURS = 1


def generate_reset_token() -> str:
    """Generate a cryptographically secure URL-safe token."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(64))


def store_reset_token(user_id: str) -> str:
    """
    Create a password reset token for a user and store it with expiry.

    Returns:
        The generated token string
    """
    # Purge expired tokens lazily
    _purge_expired_tokens()

    token = generate_reset_token()
    expiry = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)
    _reset_tokens[token] = (str(user_id), expiry)
    return token


def validate_reset_token(token: str) -> Optional[str]:
    """
    Validate a password reset token.

    Returns:
        user_id string if token is valid and not expired, else None
    """
    entry = _reset_tokens.get(token)
    if entry is None:
        return None
    user_id, expiry = entry
    if datetime.utcnow() > expiry:
        # Token expired – clean it up
        _reset_tokens.pop(token, None)
        return None
    return user_id


def consume_reset_token(token: str) -> Optional[str]:
    """
    Validate and consume (delete) a password reset token.

    Returns:
        user_id string if token was valid, else None
    """
    user_id = validate_reset_token(token)
    if user_id:
        _reset_tokens.pop(token, None)
    return user_id


def _purge_expired_tokens() -> None:
    """Remove expired tokens from the in-memory store."""
    now = datetime.utcnow()
    expired = [t for t, (_, exp) in _reset_tokens.items() if now > exp]
    for t in expired:
        _reset_tokens.pop(t, None)
