from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import uuid
from ..models.order import OrderStatus


class OrderCreate(BaseModel):
    product_id: uuid.UUID
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    country: str = "India"
    quantity: int = 1
    coupon_code: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v

    @field_validator("customer_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = v.replace("+", "").replace("-", "").replace(" ", "")
        if not digits.isdigit() or len(digits) < 10:
            raise ValueError("Invalid phone number")
        return v


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_id: Optional[str] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str
    product_id: Optional[uuid.UUID] = None
    seller_id: uuid.UUID
    customer_name: str
    customer_email: str
    customer_phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    pincode: str
    country: str
    quantity: int
    unit_price: Decimal
    discount_price: Optional[Decimal] = None
    shipping_charge: Decimal
    coupon_code: Optional[str] = None
    coupon_discount: Decimal
    total_amount: Decimal
    status: OrderStatus
    notes: Optional[str] = None
    invoice_url: Optional[str] = None
    tracking_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
    page: int
    page_size: int
    pages: int
