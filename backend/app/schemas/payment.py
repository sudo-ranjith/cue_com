from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime
from decimal import Decimal
import uuid
from ..models.payment import PaymentStatus


class PaymentCreateOrderRequest(BaseModel):
    order_id: uuid.UUID


class PaymentCreateOrderResponse(BaseModel):
    razorpay_order_id: str
    amount: int  # in paise
    currency: str
    key_id: str
    order_number: str


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentWebhookPayload(BaseModel):
    event: str
    payload: Dict[str, Any]


class PaymentResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    amount: Decimal
    currency: str
    status: PaymentStatus
    payment_method: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    items: List[PaymentResponse]
    total: int
    page: int
    page_size: int
    pages: int
