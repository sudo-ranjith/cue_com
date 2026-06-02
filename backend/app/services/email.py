import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List
from jinja2 import Environment, BaseLoader
from ..config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Email templates (inline Jinja2)
# ─────────────────────────────────────────────────────────────

ORDER_CONFIRMATION_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Confirmation</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
    <h2 style="color: #333;">Order Confirmed!</h2>
    <p>Dear <strong>{{ customer_name }}</strong>,</p>
    <p>Thank you for your order. Here are your order details:</p>
    <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #f8f8f8;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Order Number</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ order_number }}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ product_name }}</td>
      </tr>
      <tr style="background: #f8f8f8;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Quantity</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ quantity }}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Amount</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">₹{{ total_amount }}</td>
      </tr>
      <tr style="background: #f8f8f8;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ status }}</td>
      </tr>
    </table>
    <h3>Shipping Address</h3>
    <p>
      {{ address_line1 }}<br>
      {% if address_line2 %}{{ address_line2 }}<br>{% endif %}
      {{ city }}, {{ state }} - {{ pincode }}<br>
      {{ country }}
    </p>
    <p style="color: #666; font-size: 12px;">
      You can track your order using order number <strong>{{ order_number }}</strong> and your phone number.
    </p>
    <p>Thank you for shopping with us!</p>
  </div>
</body>
</html>
"""

NEW_ORDER_ALERT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New Order Alert</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
    <h2 style="color: #333;">New Order Received!</h2>
    <p>A new order has been placed on your store.</p>
    <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #f8f8f8;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Order Number</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ order_number }}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Customer</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ customer_name }} ({{ customer_email }})</td>
      </tr>
      <tr style="background: #f8f8f8;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ customer_phone }}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ product_name }}</td>
      </tr>
      <tr style="background: #f8f8f8;">
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Quantity</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">{{ quantity }}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Amount</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">₹{{ total_amount }}</td>
      </tr>
    </table>
    <p>Shipping to: {{ address_line1 }}, {{ city }}, {{ state }} - {{ pincode }}</p>
    <p><a href="{{ dashboard_url }}" style="background: #4CAF50; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Order</a></p>
  </div>
</body>
</html>
"""

PASSWORD_RESET_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Reset</title></head>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
    <h2 style="color: #333;">Password Reset Request</h2>
    <p>Dear {{ full_name }},</p>
    <p>We received a request to reset your password. Click the button below to reset it:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{ reset_url }}" style="background: #2196F3; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-size: 16px;">
        Reset Password
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="color: #666; word-break: break-all;">{{ reset_url }}</p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request a password reset, please ignore this email.</p>
  </div>
</body>
</html>
"""


def _render_template(template_str: str, **kwargs) -> str:
    env = Environment(loader=BaseLoader())
    tmpl = env.from_string(template_str)
    return tmpl.render(**kwargs)


def _send_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None,
) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. Email not sent to %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email

        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if attachment_bytes and attachment_filename:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment_bytes)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{attachment_filename}"',
            )
            msg.attach(part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())

        logger.info("Email sent to %s: %s", to_email, subject)
        return True

    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


def send_order_confirmation(order, product_name: str = "") -> bool:
    """Send order confirmation email to customer."""
    html = _render_template(
        ORDER_CONFIRMATION_TEMPLATE,
        customer_name=order.customer_name,
        order_number=order.order_number,
        product_name=product_name or "Your product",
        quantity=order.quantity,
        total_amount=f"{float(order.total_amount):,.2f}",
        status=order.status.value if hasattr(order.status, "value") else order.status,
        address_line1=order.address_line1,
        address_line2=order.address_line2,
        city=order.city,
        state=order.state,
        pincode=order.pincode,
        country=order.country,
    )
    return _send_email(
        to_email=order.customer_email,
        subject=f"Order Confirmed - {order.order_number}",
        html_body=html,
    )


def send_new_order_alert(order, seller_email: str, product_name: str = "") -> bool:
    """Send new order alert email to seller."""
    dashboard_url = f"{settings.FRONTEND_URL}/dashboard/orders/{str(order.id)}"
    html = _render_template(
        NEW_ORDER_ALERT_TEMPLATE,
        order_number=order.order_number,
        customer_name=order.customer_name,
        customer_email=order.customer_email,
        customer_phone=order.customer_phone,
        product_name=product_name or "Your product",
        quantity=order.quantity,
        total_amount=f"{float(order.total_amount):,.2f}",
        address_line1=order.address_line1,
        city=order.city,
        state=order.state,
        pincode=order.pincode,
        dashboard_url=dashboard_url,
    )
    return _send_email(
        to_email=seller_email,
        subject=f"New Order Received - {order.order_number}",
        html_body=html,
    )


def send_password_reset_email(email: str, full_name: str, reset_token: str) -> bool:
    """Send password reset email."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    html = _render_template(
        PASSWORD_RESET_TEMPLATE,
        full_name=full_name,
        reset_url=reset_url,
    )
    return _send_email(
        to_email=email,
        subject="Password Reset Request",
        html_body=html,
    )


def send_invoice_email(
    order,
    invoice_bytes: bytes,
    product_name: str = "",
) -> bool:
    """Send invoice PDF as email attachment to customer."""
    html = _render_template(
        ORDER_CONFIRMATION_TEMPLATE,
        customer_name=order.customer_name,
        order_number=order.order_number,
        product_name=product_name or "Your product",
        quantity=order.quantity,
        total_amount=f"{float(order.total_amount):,.2f}",
        status=order.status.value if hasattr(order.status, "value") else order.status,
        address_line1=order.address_line1,
        address_line2=order.address_line2,
        city=order.city,
        state=order.state,
        pincode=order.pincode,
        country=order.country,
    )
    return _send_email(
        to_email=order.customer_email,
        subject=f"Invoice for Order {order.order_number}",
        html_body=html,
        attachment_bytes=invoice_bytes,
        attachment_filename=f"invoice_{order.order_number}.pdf",
    )
