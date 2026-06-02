from decimal import Decimal
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.coupon import Coupon, DiscountType
from ..models.order import Order, OrderStatus
from ..models.product import Product, ProductStatus
from ..models.user import User
from ..schemas.order import OrderResponse
from ..utils.helpers import generate_order_number

router = APIRouter(prefix="/public", tags=["Public"])


# ──────────────────────────────────────────────────────────────
# Inline response schemas for public product view
# ──────────────────────────────────────────────────────────────

class PublicProductResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    discount_price: Optional[Decimal] = None
    category: Optional[str] = None
    stock_quantity: int
    weight: Optional[float] = None
    shipping_charge: Decimal
    images: list
    video_url: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    link_token: str
    seller_name: Optional[str] = None
    seller_logo: Optional[str] = None
    razorpay_key_id: Optional[str] = None

    model_config = {"from_attributes": True}


class PublicOrderCreate(BaseModel):
    product_id: str
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


class OrderTrackResponse(BaseModel):
    order_number: str
    customer_name: str
    product_name: Optional[str] = None
    quantity: int
    total_amount: Decimal
    status: str
    tracking_id: Optional[str] = None
    city: str
    state: str
    pincode: str
    created_at: datetime


# ──────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────

@router.get("/products/{token}", response_model=PublicProductResponse)
def get_public_product(token: str, db: Session = Depends(get_db)):
    """
    Fetch a product by its link token.
    Increments the view count on every call.
    """
    product = db.query(Product).filter(
        Product.link_token == token,
        Product.link_enabled == True,
        Product.status == ProductStatus.active,
    ).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or link is disabled",
        )

    # Increment view counter
    product.link_views += 1
    db.commit()
    db.refresh(product)

    seller = db.query(User).filter(User.id == product.seller_id).first()

    return PublicProductResponse(
        id=str(product.id),
        name=product.name,
        slug=product.slug,
        description=product.description,
        price=product.price,
        discount_price=product.discount_price,
        category=product.category,
        stock_quantity=max(0, product.stock_quantity - product.reserved_stock),
        weight=product.weight,
        shipping_charge=product.shipping_charge,
        images=product.images or [],
        video_url=product.video_url,
        seo_title=product.seo_title,
        seo_description=product.seo_description,
        link_token=product.link_token,
        seller_name=seller.company_name or seller.full_name if seller else None,
        seller_logo=seller.logo_url if seller else None,
        razorpay_key_id=seller.razorpay_key_id if seller else None,
    )


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_public_order(
    payload: PublicOrderCreate,
    db: Session = Depends(get_db),
):
    """
    Create an order from the public checkout page.
    Validates stock, applies coupon, calculates totals.
    """
    product = db.query(Product).filter(
        Product.id == payload.product_id,
        Product.status == ProductStatus.active,
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found or not available",
        )

    # Check stock
    available = product.stock_quantity - product.reserved_stock
    if available < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {available}",
        )

    # Determine unit price
    unit_price = product.discount_price if product.discount_price else product.price
    line_total = unit_price * payload.quantity
    shipping = product.shipping_charge or Decimal("0")

    # Apply coupon if provided
    coupon_discount = Decimal("0")
    coupon_code_applied = None
    if payload.coupon_code:
        coupon = db.query(Coupon).filter(
            Coupon.code == payload.coupon_code.upper().strip(),
            Coupon.seller_id == product.seller_id,
            Coupon.is_active == True,
        ).first()

        if coupon:
            if coupon.expires_at and datetime.utcnow() > coupon.expires_at:
                raise HTTPException(status_code=400, detail="Coupon has expired")
            if coupon.max_uses is not None and coupon.uses_count >= coupon.max_uses:
                raise HTTPException(status_code=400, detail="Coupon usage limit reached")

            order_value = line_total + shipping
            if order_value >= coupon.min_order_value:
                if coupon.discount_type == DiscountType.percentage:
                    coupon_discount = order_value * (Decimal(str(coupon.discount_value)) / Decimal("100"))
                else:
                    coupon_discount = min(Decimal(str(coupon.discount_value)), order_value)
                coupon_code_applied = coupon.code
                coupon.uses_count += 1
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Minimum order value of ₹{float(coupon.min_order_value):,.2f} required for this coupon",
                )
        else:
            raise HTTPException(status_code=400, detail="Invalid coupon code")

    total_amount = line_total + shipping - coupon_discount

    # Reserve stock
    product.reserved_stock += payload.quantity

    # Generate unique order number
    order_number = _generate_unique_order_number(db)

    order = Order(
        order_number=order_number,
        product_id=product.id,
        seller_id=product.seller_id,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        address_line1=payload.address_line1,
        address_line2=payload.address_line2,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        country=payload.country,
        quantity=payload.quantity,
        unit_price=product.price,
        discount_price=product.discount_price,
        shipping_charge=shipping,
        coupon_code=coupon_code_applied,
        coupon_discount=coupon_discount,
        total_amount=total_amount,
        status=OrderStatus.pending,
        notes=payload.notes,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/track", response_model=OrderTrackResponse)
def track_order(
    order_number: str = Query(..., description="Order number"),
    phone: str = Query(..., description="Customer phone number"),
    db: Session = Depends(get_db),
):
    """
    Track an order by order number and customer phone.
    Public endpoint for customers.
    """
    order = db.query(Order).filter(
        Order.order_number == order_number.upper().strip(),
        Order.customer_phone == phone.strip(),
    ).first()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found. Please check the order number and phone number.",
        )

    product_name = order.product.name if order.product else None

    return OrderTrackResponse(
        order_number=order.order_number,
        customer_name=order.customer_name,
        product_name=product_name,
        quantity=order.quantity,
        total_amount=order.total_amount,
        status=order.status.value,
        tracking_id=order.tracking_id,
        city=order.city,
        state=order.state,
        pincode=order.pincode,
        created_at=order.created_at,
    )


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _generate_unique_order_number(db: Session) -> str:
    for _ in range(10):
        number = generate_order_number()
        if not db.query(Order).filter(Order.order_number == number).first():
            return number
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate unique order number",
    )
