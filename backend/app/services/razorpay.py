import hmac
import hashlib
from typing import Optional, Dict, Any
import razorpay
from ..config import settings


def get_razorpay_client(key_id: Optional[str] = None, key_secret: Optional[str] = None) -> razorpay.Client:
    """Return a Razorpay client, using seller keys if provided, else global config."""
    kid = key_id or settings.RAZORPAY_KEY_ID
    ksecret = key_secret or settings.RAZORPAY_KEY_SECRET
    return razorpay.Client(auth=(kid, ksecret))


def create_order(
    amount: int,
    currency: str = "INR",
    receipt: str = "",
    notes: Optional[Dict[str, str]] = None,
    key_id: Optional[str] = None,
    key_secret: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a Razorpay order.

    Args:
        amount: Amount in paise (e.g., 10000 = ₹100)
        currency: Currency code (default: INR)
        receipt: Receipt identifier (usually order_number)
        notes: Optional notes dict
        key_id: Seller-specific Razorpay key (overrides global)
        key_secret: Seller-specific Razorpay secret (overrides global)

    Returns:
        Razorpay order dict
    """
    client = get_razorpay_client(key_id, key_secret)
    order_data = {
        "amount": amount,
        "currency": currency,
        "receipt": receipt,
        "payment_capture": 1,  # Auto-capture
    }
    if notes:
        order_data["notes"] = notes
    return client.order.create(order_data)


def verify_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    key_secret: Optional[str] = None,
) -> bool:
    """
    Verify Razorpay payment signature using HMAC-SHA256.

    Args:
        razorpay_order_id: Razorpay order ID
        razorpay_payment_id: Razorpay payment ID
        razorpay_signature: Signature from Razorpay
        key_secret: Seller-specific key secret (overrides global)

    Returns:
        True if signature is valid, False otherwise
    """
    secret = key_secret or settings.RAZORPAY_KEY_SECRET
    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, razorpay_signature)


def verify_webhook_signature(body: bytes, signature: str, webhook_secret: Optional[str] = None) -> bool:
    """
    Verify Razorpay webhook signature.

    Args:
        body: Raw request body bytes
        signature: X-Razorpay-Signature header value
        webhook_secret: Razorpay webhook secret

    Returns:
        True if valid
    """
    secret = webhook_secret or settings.RAZORPAY_KEY_SECRET
    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def fetch_payment(payment_id: str, key_id: Optional[str] = None, key_secret: Optional[str] = None) -> Dict[str, Any]:
    """Fetch payment details from Razorpay."""
    client = get_razorpay_client(key_id, key_secret)
    return client.payment.fetch(payment_id)


def refund_payment(
    payment_id: str,
    amount: Optional[int] = None,
    key_id: Optional[str] = None,
    key_secret: Optional[str] = None,
) -> Dict[str, Any]:
    """Initiate a refund for a Razorpay payment."""
    client = get_razorpay_client(key_id, key_secret)
    refund_data = {}
    if amount:
        refund_data["amount"] = amount
    return client.payment.refund(payment_id, refund_data)
