import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.order import Order, OrderStatus
from ..models.payment import Payment, PaymentStatus
from ..models.product import Product
from ..models.user import User
from ..schemas.payment import (
    PaymentCreateOrderRequest, PaymentCreateOrderResponse,
    PaymentVerifyRequest, PaymentResponse, PaymentListResponse,
)
from ..utils.security import get_current_user
from ..utils.helpers import amount_to_paise
from ..utils.pagination import PaginationParams, paginate, build_pagination_response
from ..services import razorpay as rzp_service
from ..services.email import send_order_confirmation, send_new_order_alert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/create-order", response_model=PaymentCreateOrderResponse)
def create_razorpay_order(
    payload: PaymentCreateOrderRequest,
    db: Session = Depends(get_db),
):
    """
    Create a Razorpay payment order for a given app order.
    Called from the checkout page (public endpoint).
    """
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.status != OrderStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is already in '{order.status.value}' status",
        )

    # Get seller's Razorpay keys (fall back to global)
    seller = db.query(User).filter(User.id == order.seller_id).first()
    key_id = (seller.razorpay_key_id or None) if seller else None
    key_secret = (seller.razorpay_key_secret or None) if seller else None

    amount_paise = amount_to_paise(order.total_amount)

    try:
        rz_order = rzp_service.create_order(
            amount=amount_paise,
            currency="INR",
            receipt=order.order_number,
            notes={"order_number": order.order_number, "customer_name": order.customer_name},
            key_id=key_id,
            key_secret=key_secret,
        )
    except Exception as exc:
        logger.error("Razorpay order creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment gateway error. Please try again.",
        )

    # Save payment record
    payment = Payment(
        order_id=order.id,
        razorpay_order_id=rz_order["id"],
        amount=order.total_amount,
        currency="INR",
        status=PaymentStatus.created,
    )
    db.add(payment)
    db.commit()

    from ..config import settings
    return PaymentCreateOrderResponse(
        razorpay_order_id=rz_order["id"],
        amount=amount_paise,
        currency="INR",
        key_id=key_id or settings.RAZORPAY_KEY_ID,
        order_number=order.order_number,
    )


@router.post("/verify")
def verify_payment(
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
):
    """
    Verify Razorpay payment signature and mark payment as paid.
    Called from checkout page after successful payment.
    """
    payment = db.query(Payment).filter(
        Payment.razorpay_order_id == payload.razorpay_order_id
    ).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")

    order = db.query(Order).filter(Order.id == payment.order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Get seller keys
    seller = db.query(User).filter(User.id == order.seller_id).first()
    key_secret = (seller.razorpay_key_secret or None) if seller else None

    is_valid = rzp_service.verify_signature(
        razorpay_order_id=payload.razorpay_order_id,
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_signature=payload.razorpay_signature,
        key_secret=key_secret,
    )

    if not is_valid:
        payment.status = PaymentStatus.failed
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature",
        )

    # Update payment
    payment.razorpay_payment_id = payload.razorpay_payment_id
    payment.razorpay_signature = payload.razorpay_signature
    payment.status = PaymentStatus.paid

    # Update order
    order.status = OrderStatus.paid

    # Deduct stock
    product = db.query(Product).filter(Product.id == order.product_id).first()
    if product:
        product.stock_quantity = max(0, product.stock_quantity - order.quantity)
        product.reserved_stock = max(0, product.reserved_stock - order.quantity)
        product.link_clicks += 1

    db.commit()

    # Send emails
    product_name = product.name if product else ""
    try:
        send_order_confirmation(order, product_name)
    except Exception as exc:
        logger.warning("Failed to send order confirmation: %s", exc)
    try:
        if seller:
            send_new_order_alert(order, seller.email, product_name)
    except Exception as exc:
        logger.warning("Failed to send order alert: %s", exc)

    return {"message": "Payment verified successfully", "order_number": order.order_number}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handle Razorpay webhook events.
    Signature verification uses the raw request body.
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    from ..config import settings
    if not rzp_service.verify_webhook_signature(body, signature):
        logger.warning("Invalid webhook signature received")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    try:
        event_data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    event = event_data.get("event", "")
    logger.info("Razorpay webhook received: %s", event)

    if event == "payment.captured":
        _handle_payment_captured(event_data, db)
    elif event == "payment.failed":
        _handle_payment_failed(event_data, db)
    elif event == "refund.created":
        _handle_refund_created(event_data, db)

    return {"status": "ok"}


@router.get("", response_model=PaymentListResponse)
def list_payments(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all payments for the current seller's orders."""
    query = (
        db.query(Payment)
        .join(Order, Payment.order_id == Order.id)
        .filter(Order.seller_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    items, total = paginate(query, pagination)
    return build_pagination_response(
        [PaymentResponse.model_validate(p) for p in items],
        total,
        pagination,
    )


# ──────────────────────────────────────────────────────────────
# Webhook helpers
# ──────────────────────────────────────────────────────────────

def _handle_payment_captured(event_data: dict, db: Session) -> None:
    """Handle payment.captured webhook event."""
    try:
        payment_entity = event_data["payload"]["payment"]["entity"]
        rz_payment_id = payment_entity["id"]
        rz_order_id = payment_entity["order_id"]
        payment_method = payment_entity.get("method", "")

        payment = db.query(Payment).filter(
            Payment.razorpay_order_id == rz_order_id
        ).first()
        if not payment:
            logger.warning("Webhook: payment not found for order_id=%s", rz_order_id)
            return

        if payment.status == PaymentStatus.paid:
            return  # Already processed

        payment.razorpay_payment_id = rz_payment_id
        payment.status = PaymentStatus.paid
        payment.payment_method = payment_method

        order = db.query(Order).filter(Order.id == payment.order_id).first()
        if order and order.status == OrderStatus.pending:
            order.status = OrderStatus.paid

            product = db.query(Product).filter(Product.id == order.product_id).first()
            if product:
                product.stock_quantity = max(0, product.stock_quantity - order.quantity)
                product.reserved_stock = max(0, product.reserved_stock - order.quantity)

        db.commit()
    except (KeyError, AttributeError) as exc:
        logger.error("Error processing payment.captured webhook: %s", exc)


def _handle_payment_failed(event_data: dict, db: Session) -> None:
    """Handle payment.failed webhook event."""
    try:
        payment_entity = event_data["payload"]["payment"]["entity"]
        rz_order_id = payment_entity["order_id"]

        payment = db.query(Payment).filter(
            Payment.razorpay_order_id == rz_order_id
        ).first()
        if payment and payment.status == PaymentStatus.created:
            payment.status = PaymentStatus.failed
            db.commit()
    except (KeyError, AttributeError) as exc:
        logger.error("Error processing payment.failed webhook: %s", exc)


def _handle_refund_created(event_data: dict, db: Session) -> None:
    """Handle refund.created webhook event."""
    try:
        payment_entity = event_data["payload"]["payment"]["entity"]
        rz_payment_id = payment_entity["id"]

        payment = db.query(Payment).filter(
            Payment.razorpay_payment_id == rz_payment_id
        ).first()
        if payment:
            payment.status = PaymentStatus.refunded
            order = db.query(Order).filter(Order.id == payment.order_id).first()
            if order:
                order.status = OrderStatus.refunded
            db.commit()
    except (KeyError, AttributeError) as exc:
        logger.error("Error processing refund.created webhook: %s", exc)
