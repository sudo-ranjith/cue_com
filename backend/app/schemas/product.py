from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import uuid
from ..models.product import ProductStatus


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    discount_price: Optional[Decimal] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: int = 0
    weight: Optional[float] = None
    shipping_charge: Decimal = Decimal("0")
    status: ProductStatus = ProductStatus.draft
    images: List[str] = []
    video_url: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price cannot be negative")
        return v

    @field_validator("discount_price")
    @classmethod
    def validate_discount_price(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("Discount price cannot be negative")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    discount_price: Optional[Decimal] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: Optional[int] = None
    weight: Optional[float] = None
    shipping_charge: Optional[Decimal] = None
    status: Optional[ProductStatus] = None
    images: Optional[List[str]] = None
    video_url: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    link_enabled: Optional[bool] = None


class ProductStatusUpdate(BaseModel):
    status: ProductStatus


class ProductResponse(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    discount_price: Optional[Decimal] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: int
    reserved_stock: int
    weight: Optional[float] = None
    shipping_charge: Decimal
    status: ProductStatus
    images: List[str]
    video_url: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    link_token: str
    link_enabled: bool
    link_views: int
    link_clicks: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
    pages: int
