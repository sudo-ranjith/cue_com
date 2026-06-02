from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import uuid
from ..models.coupon import DiscountType


class CouponCreate(BaseModel):
    code: str
    discount_type: DiscountType
    discount_value: Decimal
    min_order_value: Decimal = Decimal("0")
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        code = v.strip().upper()
        if len(code) < 3 or len(code) > 50:
            raise ValueError("Coupon code must be between 3 and 50 characters")
        return code

    @field_validator("discount_value")
    @classmethod
    def validate_discount_value(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Discount value must be greater than 0")
        return v

    @field_validator("min_order_value")
    @classmethod
    def validate_min_order_value(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Minimum order value cannot be negative")
        return v


class CouponUpdate(BaseModel):
    code: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            code = v.strip().upper()
            if len(code) < 3 or len(code) > 50:
                raise ValueError("Coupon code must be between 3 and 50 characters")
            return code
        return v

    @field_validator("discount_value")
    @classmethod
    def validate_discount_value(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("Discount value must be greater than 0")
        return v


class CouponResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    code: str
    discount_type: DiscountType
    discount_value: Decimal
    min_order_value: Decimal
    max_uses: Optional[int] = None
    uses_count: int
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CouponListResponse(BaseModel):
    items: List[CouponResponse]
    total: int
    page: int
    page_size: int
    pages: int


class CouponValidateRequest(BaseModel):
    code: str
    product_id: uuid.UUID
    quantity: int = 1
    order_value: Decimal


class CouponValidateResponse(BaseModel):
    valid: bool
    discount_amount: Decimal
    message: str
    coupon: Optional[CouponResponse] = None
