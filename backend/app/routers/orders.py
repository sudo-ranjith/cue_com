import csv
import io
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..database import get_db
from ..models.order import Order, OrderStatus
from ..models.product import Product
from ..models.user import User
from ..schemas.order import OrderResponse, OrderListResponse, OrderStatusUpdate
from ..utils.security import get_current_user
from ..utils.pagination import PaginationParams, paginate, build_pagination_response
from ..services.invoice import generate_invoice

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/export")
def export_orders_csv(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    order_status: Optional[OrderStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export all orders as a CSV file."""
    query = db.query(Order).filter(Order.seller_id == current_user.id)

    if order_status:
        query = query.filter(Order.status == order_status)
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Order.created_at >= sd)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
            # Include entire end day
            from datetime import timedelta
            query = query.filter(Order.created_at < ed + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    orders = query.order_by(Order.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Order Number", "Date", "Customer Name", "Customer Email", "Customer Phone",
        "Product", "Quantity", "Unit Price", "Shipping Charge",
        "Coupon Code", "Coupon Discount", "Total Amount",
        "Status", "Tracking ID", "City", "State", "Pincode", "Country",
    ])
    for order in orders:
        product_name = order.product.name if order.product else ""
        writer.writerow([
            order.order_number,
            order.created_at.strftime("%Y-%m-%d %H:%M:%S") if order.created_at else "",
            order.customer_name,
            order.customer_email,
            order.customer_phone,
            product_name,
            order.quantity,
            float(order.unit_price),
            float(order.shipping_charge),
            order.coupon_code or "",
            float(order.coupon_discount),
            float(order.total_amount),
            order.status.value,
            order.tracking_id or "",
            order.city,
            order.state,
            order.pincode,
            order.country,
        ])

    output.seek(0)
    filename = f"orders_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("", response_model=OrderListResponse)
def list_orders(
    search: Optional[str] = Query(None, description="Search by order number, customer name, or email"),
    order_status: Optional[OrderStatus] = Query(None, alias="status"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Order).filter(Order.seller_id == current_user.id)

    if search:
        query = query.filter(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.customer_name.ilike(f"%{search}%"),
                Order.customer_email.ilike(f"%{search}%"),
                Order.customer_phone.ilike(f"%{search}%"),
            )
        )
    if order_status:
        query = query.filter(Order.status == order_status)
    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Order.created_at >= sd)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format")
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
            from datetime import timedelta
            query = query.filter(Order.created_at < ed + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    query = query.order_by(Order.created_at.desc())
    items, total = paginate(query, pagination)
    return build_pagination_response(
        [OrderResponse.model_validate(o) for o in items],
        total,
        pagination,
    )


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = _get_order_or_404(order_id, current_user.id, db)
    return order


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = _get_order_or_404(order_id, current_user.id, db)

    order.status = payload.status
    if payload.tracking_id is not None:
        order.tracking_id = payload.tracking_id
    if payload.notes is not None:
        order.notes = payload.notes

    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}/invoice")
def download_invoice(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and return invoice PDF for an order."""
    order = _get_order_or_404(order_id, current_user.id, db)

    try:
        pdf_bytes = generate_invoice(order, seller=current_user)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invoice: {str(exc)}",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="invoice_{order.order_number}.pdf"'
        },
    )


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _get_order_or_404(order_id: str, seller_id, db: Session) -> Order:
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.seller_id == seller_id,
    ).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order
