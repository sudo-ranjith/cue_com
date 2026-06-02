from typing import Optional, Literal
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from ..database import get_db
from ..models.order import Order, OrderStatus
from ..models.product import Product, ProductStatus
from ..models.user import User
from ..schemas.analytics import (
    DashboardStats, SalesChartResponse, SalesDataPoint,
    ProductPerformance, ProductPerformanceListResponse,
)
from ..utils.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sid = current_user.id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    paid_statuses = [OrderStatus.paid, OrderStatus.processing, OrderStatus.packed,
                     OrderStatus.shipped, OrderStatus.delivered]

    # Totals
    total_revenue = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        Order.seller_id == sid,
        Order.status.in_(paid_statuses),
    ).scalar() or Decimal("0")

    total_orders = db.query(func.count(Order.id)).filter(Order.seller_id == sid).scalar() or 0

    total_products = db.query(func.count(Product.id)).filter(Product.seller_id == sid).scalar() or 0

    active_products = db.query(func.count(Product.id)).filter(
        Product.seller_id == sid,
        Product.status == ProductStatus.active,
    ).scalar() or 0

    pending_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == sid,
        Order.status == OrderStatus.pending,
    ).scalar() or 0

    paid_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == sid,
        Order.status.in_(paid_statuses),
    ).scalar() or 0

    # Unique customers
    total_customers = db.query(func.count(func.distinct(Order.customer_email))).filter(
        Order.seller_id == sid,
    ).scalar() or 0

    # Today
    revenue_today = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        Order.seller_id == sid,
        Order.status.in_(paid_statuses),
        Order.created_at >= today_start,
    ).scalar() or Decimal("0")

    orders_today = db.query(func.count(Order.id)).filter(
        Order.seller_id == sid,
        Order.created_at >= today_start,
    ).scalar() or 0

    # This month
    revenue_this_month = db.query(func.coalesce(func.sum(Order.total_amount), 0)).filter(
        Order.seller_id == sid,
        Order.status.in_(paid_statuses),
        Order.created_at >= month_start,
    ).scalar() or Decimal("0")

    orders_this_month = db.query(func.count(Order.id)).filter(
        Order.seller_id == sid,
        Order.created_at >= month_start,
    ).scalar() or 0

    # Top product
    top_product_row = (
        db.query(
            Product.name,
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        )
        .outerjoin(Order, and_(Order.product_id == Product.id, Order.status.in_(paid_statuses)))
        .filter(Product.seller_id == sid)
        .group_by(Product.id, Product.name)
        .order_by(func.coalesce(func.sum(Order.total_amount), 0).desc())
        .first()
    )
    top_product_name = top_product_row[0] if top_product_row else None
    top_product_revenue = Decimal(str(top_product_row[1])) if top_product_row else None

    # Conversion: paid / total orders
    conversion_rate = None
    if total_orders > 0:
        conversion_rate = round((paid_orders / total_orders) * 100, 2)

    return DashboardStats(
        total_revenue=Decimal(str(total_revenue)),
        total_orders=total_orders,
        total_products=total_products,
        active_products=active_products,
        pending_orders=pending_orders,
        paid_orders=paid_orders,
        total_customers=total_customers,
        revenue_today=Decimal(str(revenue_today)),
        revenue_this_month=Decimal(str(revenue_this_month)),
        orders_today=orders_today,
        orders_this_month=orders_this_month,
        top_product_name=top_product_name,
        top_product_revenue=top_product_revenue,
        conversion_rate=conversion_rate,
    )


@router.get("/sales-chart", response_model=SalesChartResponse)
def get_sales_chart(
    period: Literal["daily", "monthly"] = Query("daily", description="'daily' (last 30 days) or 'monthly' (last 12 months)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sid = current_user.id
    now = datetime.utcnow()
    paid_statuses = [OrderStatus.paid, OrderStatus.processing, OrderStatus.packed,
                     OrderStatus.shipped, OrderStatus.delivered]

    data_points = []

    if period == "daily":
        # Last 30 days
        start = now - timedelta(days=29)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)

        # Build date range
        date_range = [(start + timedelta(days=i)).date() for i in range(30)]

        # Query aggregated data
        rows = (
            db.query(
                func.date(Order.created_at).label("day"),
                func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
                func.count(Order.id).label("orders"),
            )
            .filter(
                Order.seller_id == sid,
                Order.status.in_(paid_statuses),
                Order.created_at >= start,
            )
            .group_by(func.date(Order.created_at))
            .all()
        )
        row_map = {str(r.day): (Decimal(str(r.revenue)), r.orders) for r in rows}

        for d in date_range:
            key = str(d)
            revenue, orders = row_map.get(key, (Decimal("0"), 0))
            data_points.append(SalesDataPoint(date=key, revenue=revenue, orders=orders))

    else:
        # Last 12 months
        start = (now.replace(day=1) - timedelta(days=365)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        rows = (
            db.query(
                func.to_char(Order.created_at, "YYYY-MM").label("month"),
                func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
                func.count(Order.id).label("orders"),
            )
            .filter(
                Order.seller_id == sid,
                Order.status.in_(paid_statuses),
                Order.created_at >= start,
            )
            .group_by(func.to_char(Order.created_at, "YYYY-MM"))
            .order_by(func.to_char(Order.created_at, "YYYY-MM"))
            .all()
        )

        # Build 12-month range
        months = []
        cur = start.replace(day=1)
        for _ in range(13):
            months.append(cur.strftime("%Y-%m"))
            if cur.month == 12:
                cur = cur.replace(year=cur.year + 1, month=1)
            else:
                cur = cur.replace(month=cur.month + 1)
        months = list(dict.fromkeys(months))[-12:]  # Unique, last 12

        row_map = {r.month: (Decimal(str(r.revenue)), r.orders) for r in rows}
        for m in months:
            revenue, orders = row_map.get(m, (Decimal("0"), 0))
            data_points.append(SalesDataPoint(date=m, revenue=revenue, orders=orders))

    total_revenue = sum(dp.revenue for dp in data_points)
    total_orders = sum(dp.orders for dp in data_points)

    return SalesChartResponse(
        data=data_points,
        period=period,
        total_revenue=total_revenue,
        total_orders=total_orders,
    )


@router.get("/products", response_model=ProductPerformanceListResponse)
def get_product_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sid = current_user.id
    paid_statuses = [OrderStatus.paid, OrderStatus.processing, OrderStatus.packed,
                     OrderStatus.shipped, OrderStatus.delivered]

    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.slug,
            Product.status,
            Product.link_views,
            Product.link_clicks,
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
            func.coalesce(func.count(Order.id), 0).label("order_count"),
            func.coalesce(func.sum(Order.quantity), 0).label("units_sold"),
        )
        .outerjoin(Order, and_(Order.product_id == Product.id, Order.status.in_(paid_statuses)))
        .filter(Product.seller_id == sid)
        .group_by(Product.id, Product.name, Product.slug, Product.status,
                  Product.link_views, Product.link_clicks)
        .order_by(func.coalesce(func.sum(Order.total_amount), 0).desc())
        .all()
    )

    items = []
    for row in rows:
        views = row.link_views or 0
        clicks = row.link_clicks or 0
        order_count = int(row.order_count)
        conversion = round((order_count / views * 100), 2) if views > 0 else 0.0

        items.append(ProductPerformance(
            product_id=str(row.id),
            product_name=row.name,
            slug=row.slug,
            total_orders=order_count,
            total_revenue=Decimal(str(row.revenue)),
            total_units_sold=int(row.units_sold),
            link_views=views,
            link_clicks=clicks,
            conversion_rate=conversion,
            status=row.status.value if hasattr(row.status, "value") else str(row.status),
        ))

    return ProductPerformanceListResponse(items=items, total=len(items))
