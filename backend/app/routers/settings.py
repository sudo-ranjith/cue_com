from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..schemas.auth import UserResponse, UserUpdateRequest
from ..utils.security import get_current_user, get_password_hash, verify_password
from fastapi import HTTPException, status

router = APIRouter(prefix="/settings", tags=["Settings"])


class CompanySettingsRequest(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    gst_number: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None


class CompanySettingsResponse(BaseModel):
    id: str
    email: str
    full_name: str
    company_name: Optional[str] = None
    gst_number: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    has_razorpay_secret: bool = False

    model_config = {"from_attributes": True}


@router.get("", response_model=CompanySettingsResponse)
def get_settings(current_user: User = Depends(get_current_user)):
    return CompanySettingsResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        company_name=current_user.company_name,
        gst_number=current_user.gst_number,
        phone=current_user.phone,
        address=current_user.address,
        logo_url=current_user.logo_url,
        razorpay_key_id=current_user.razorpay_key_id,
        has_razorpay_secret=bool(current_user.razorpay_key_secret),
    )


@router.put("", response_model=CompanySettingsResponse)
def update_settings(
    payload: CompanySettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_fields = [
        "full_name", "company_name", "gst_number", "phone",
        "address", "logo_url", "razorpay_key_id", "razorpay_key_secret",
    ]
    for field in update_fields:
        value = getattr(payload, field, None)
        if value is not None:
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return CompanySettingsResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        company_name=current_user.company_name,
        gst_number=current_user.gst_number,
        phone=current_user.phone,
        address=current_user.address,
        logo_url=current_user.logo_url,
        razorpay_key_id=current_user.razorpay_key_id,
        has_razorpay_secret=bool(current_user.razorpay_key_secret),
    )
