import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models.product import Product, ProductStatus
from ..models.user import User
from ..schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductListResponse, ProductStatusUpdate,
)
from ..utils.security import get_current_user
from ..utils.helpers import generate_link_token, generate_unique_slug, slugify
from ..utils.pagination import PaginationParams, paginate, build_pagination_response

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ProductListResponse)
def list_products(
    search: Optional[str] = Query(None, description="Search by name or SKU"),
    status_filter: Optional[ProductStatus] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.seller_id == current_user.id)

    if search:
        query = query.filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
                Product.category.ilike(f"%{search}%"),
            )
        )
    if status_filter:
        query = query.filter(Product.status == status_filter)
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))

    query = query.order_by(Product.created_at.desc())
    items, total = paginate(query, pagination)

    return build_pagination_response(
        [ProductResponse.model_validate(p) for p in items],
        total,
        pagination,
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slug = generate_unique_slug(payload.name, db, Product)
    link_token = _generate_unique_link_token(db)

    product = Product(
        seller_id=current_user.id,
        slug=slug,
        link_token=link_token,
        **payload.model_dump(),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(product_id, current_user.id, db)
    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(product_id, current_user.id, db)

    update_data = payload.model_dump(exclude_unset=True)

    # If name is being updated, regenerate slug
    if "name" in update_data:
        new_slug = generate_unique_slug(update_data["name"], db, Product)
        # But skip current product's own slug
        base = slugify(update_data["name"])
        if product.slug.startswith(base):
            pass  # Keep existing slug if same base
        else:
            product.slug = new_slug

    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(product_id, current_user.id, db)
    db.delete(product)
    db.commit()


@router.post("/{product_id}/duplicate", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def duplicate_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    original = _get_product_or_404(product_id, current_user.id, db)

    new_name = f"{original.name} (Copy)"
    slug = generate_unique_slug(new_name, db, Product)
    link_token = _generate_unique_link_token(db)

    duplicate = Product(
        seller_id=current_user.id,
        name=new_name,
        slug=slug,
        description=original.description,
        price=original.price,
        discount_price=original.discount_price,
        sku=f"{original.sku}-copy" if original.sku else None,
        category=original.category,
        stock_quantity=original.stock_quantity,
        weight=original.weight,
        shipping_charge=original.shipping_charge,
        status=ProductStatus.draft,
        images=list(original.images) if original.images else [],
        video_url=original.video_url,
        seo_title=original.seo_title,
        seo_description=original.seo_description,
        link_token=link_token,
        link_enabled=True,
    )
    db.add(duplicate)
    db.commit()
    db.refresh(duplicate)
    return duplicate


@router.post("/{product_id}/archive", response_model=ProductResponse)
def archive_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(product_id, current_user.id, db)
    product.status = ProductStatus.archived
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/qr-code")
def get_qr_code(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and return a QR code PNG for the product's public link."""
    product = _get_product_or_404(product_id, current_user.id, db)

    try:
        import qrcode
        from ..config import settings
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="QR code library not available",
        )

    public_url = f"{settings.FRONTEND_URL}/p/{product.link_token}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(public_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="qr_{product.link_token}.png"'
        },
    )


@router.post("/{product_id}/regenerate-link", response_model=ProductResponse)
def regenerate_link(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(product_id, current_user.id, db)
    product.link_token = _generate_unique_link_token(db)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}/toggle-link", response_model=ProductResponse)
def toggle_link(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = _get_product_or_404(product_id, current_user.id, db)
    product.link_enabled = not product.link_enabled
    db.commit()
    db.refresh(product)
    return product


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _get_product_or_404(product_id: str, seller_id, db: Session) -> Product:
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.seller_id == seller_id,
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product


def _generate_unique_link_token(db: Session) -> str:
    for _ in range(10):
        token = generate_link_token(8)
        if not db.query(Product).filter(Product.link_token == token).first():
            return token
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate unique link token",
    )
