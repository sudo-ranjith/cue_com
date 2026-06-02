from typing import Optional
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.coupon import Coupon, DiscountType
from ..models.product import Product
from ..models.user import User
from ..schemas.coupon import (
    CouponCreate, CouponUpdate, CouponResponse,
    CouponListResponse, CouponValidateRequest, CouponValidateResponse,
)
from ..utils.security import get_current_user
from ..utils.pagination import PaginationParams, paginate, build_pagination_response

router = APIRouter(prefix="/coupons", tags=["Coupons"])


@router.post("/validate")
def validate_coupon(
    payload: CouponValidateRequest,
    db: Session = Depends(get_db),
):
    """
    Validate a coupon code against an order value.
    Public endpoint – called during checkout.
    """
    # Find the product to get seller_id
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        return CouponValidateResponse(
            valid=False,
            discount_amount=Decimal("0"),
            message="Product not found",
        )

    coupon = db.query(Coupon).filter(
        Coupon.code == payload.code.upper().strip(),
        Coupon.seller_id == product.seller_id,
    ).first()

    if not coupon:
        return CouponValidateResponse(
            valid=False,
            discount_amount=Decimal("0"),
            message="Invalid coupon code",
        )

    if not coupon.is_active:
        return CouponValidateResponse(
            valid=False,
            discount_amount=Decimal("0"),
            message="Coupon is no longer active",
        )

    if coupon.expires_at and datetime.utcnow() > coupon.expires_at:
        return CouponValidateResponse(
            valid=False,
            discount_amount=Decimal("0"),
            message="Coupon has expired",
        )

    if coupon.max_uses is not None and coupon.uses_count >= coupon.max_uses:
        return CouponValidateResponse(
            valid=False,
            discount_amount=Decimal("0"),
            message="Coupon usage limit reached",
        )

    if payload.order_value < coupon.min_order_value:
        return CouponValidateResponse(
            valid=False,
            discount_amount=Decimal("0"),
            message=f"Minimum order value of ₹{float(coupon.min_order_value):,.2f} required",
        )

    # Calculate discount
    discount = _calculate_discount(coupon, payload.order_value)

    return CouponValidateResponse(
        valid=True,
        discount_amount=discount,
        message="Coupon applied successfully",
        coupon=CouponResponse.model_validate(coupon),
    )


@router.get("", response_model=CouponListResponse)
def list_coupons(
    is_active: Optional[bool] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Coupon).filter(Coupon.seller_id == current_user.id)
    if is_active is not None:
        query = query.filter(Coupon.is_active == is_active)
    query = query.order_by(Coupon.created_at.desc())
    items, total = paginate(query, pagination)
    return build_pagination_response(
        [CouponResponse.model_validate(c) for c in items],
        total,
        pagination,
    )


@router.post("", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
def create_coupon(
    payload: CouponCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check uniqueness within seller (code is globally unique in table)
    existing = db.query(Coupon).filter(Coupon.code == payload.code.upper().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Coupon code already exists",
        )

    coupon = Coupon(
        seller_id=current_user.id,
        code=payload.code.upper().strip(),
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        min_order_value=payload.min_order_value,
        max_uses=payload.max_uses,
        expires_at=payload.expires_at,
        is_active=payload.is_active,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.put("/{coupon_id}", response_model=CouponResponse)
def update_coupon(
    coupon_id: str,
    payload: CouponUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coupon = _get_coupon_or_404(coupon_id, current_user.id, db)

    update_data = payload.model_dump(exclude_unset=True)
    if "code" in update_data:
        update_data["code"] = update_data["code"].upper().strip()
        # Check uniqueness
        existing = db.query(Coupon).filter(
            Coupon.code == update_data["code"],
            Coupon.id != coupon.id,
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Coupon code already exists",
            )

    for field, value in update_data.items():
        setattr(coupon, field, value)

    db.commit()
    db.refresh(coupon)
    return coupon


@router.delete("/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_coupon(
    coupon_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coupon = _get_coupon_or_404(coupon_id, current_user.id, db)
    db.delete(coupon)
    db.commit()


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _get_coupon_or_404(coupon_id: str, seller_id, db: Session) -> Coupon:
    coupon = db.query(Coupon).filter(
        Coupon.id == coupon_id,
        Coupon.seller_id == seller_id,
    ).first()
    if not coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coupon not found",
        )
    return coupon


def _calculate_discount(coupon: Coupon, order_value: Decimal) -> Decimal:
    if coupon.discount_type == DiscountType.percentage:
        discount = order_value * (Decimal(str(coupon.discount_value)) / Decimal("100"))
    else:
        discount = Decimal(str(coupon.discount_value))

    return min(discount, order_value)
