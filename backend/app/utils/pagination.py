import math
from typing import TypeVar, Generic, List, Optional
from pydantic import BaseModel
from fastapi import Query

T = TypeVar("T")


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def paginate(query, pagination: PaginationParams):
    """Apply pagination to a SQLAlchemy query and return (items, total)."""
    total = query.count()
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    return items, total


def build_pagination_response(items: list, total: int, pagination: PaginationParams) -> dict:
    pages = math.ceil(total / pagination.page_size) if pagination.page_size > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
        "pages": pages,
    }
