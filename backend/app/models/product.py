import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer, Float,
    Numeric, ForeignKey, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
import enum
from ..database import Base


class ProductStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    out_of_stock = "out_of_stock"
    archived = "archived"


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(500), nullable=False)
    slug = Column(String(600), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    discount_price = Column(Numeric(10, 2), nullable=True)
    sku = Column(String(100), nullable=True, index=True)
    category = Column(String(200), nullable=True)
    stock_quantity = Column(Integer, default=0, nullable=False)
    reserved_stock = Column(Integer, default=0, nullable=False)
    weight = Column(Float, nullable=True)
    shipping_charge = Column(Numeric(10, 2), default=0, nullable=False)
    status = Column(SAEnum(ProductStatus), default=ProductStatus.draft, nullable=False, index=True)
    images = Column(JSON, default=list, nullable=False)
    video_url = Column(String(500), nullable=True)
    seo_title = Column(String(300), nullable=True)
    seo_description = Column(Text, nullable=True)
    link_token = Column(String(20), unique=True, nullable=False, index=True)
    link_enabled = Column(Boolean, default=True, nullable=False)
    link_views = Column(Integer, default=0, nullable=False)
    link_clicks = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    seller = relationship("User", back_populates="products")
    orders = relationship("Order", back_populates="product", lazy="dynamic")
