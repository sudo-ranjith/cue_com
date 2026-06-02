from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal


class DashboardStats(BaseModel):
    total_revenue: Decimal
    total_orders: int
    total_products: int
    active_products: int
    pending_orders: int
    paid_orders: int
    total_customers: int
    revenue_today: Decimal
    revenue_this_month: Decimal
    orders_today: int
    orders_this_month: int
    top_product_name: Optional[str] = None
    top_product_revenue: Optional[Decimal] = None
    conversion_rate: Optional[float] = None


class SalesDataPoint(BaseModel):
    date: str
    revenue: Decimal
    orders: int


class SalesChartResponse(BaseModel):
    data: List[SalesDataPoint]
    period: str
    total_revenue: Decimal
    total_orders: int


class ProductPerformance(BaseModel):
    product_id: str
    product_name: str
    slug: str
    total_orders: int
    total_revenue: Decimal
    total_units_sold: int
    link_views: int
    link_clicks: int
    conversion_rate: float
    status: str


class ProductPerformanceListResponse(BaseModel):
    items: List[ProductPerformance]
    total: int
