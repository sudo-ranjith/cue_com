import io
from datetime import datetime
from decimal import Decimal
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def generate_invoice(order, seller=None) -> bytes:
    """
    Generate a PDF invoice for an order using ReportLab.

    Args:
        order: Order ORM object
        seller: User ORM object (seller/company details)

    Returns:
        PDF bytes
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        )
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
    except ImportError as exc:
        logger.error("ReportLab not installed: %s", exc)
        raise RuntimeError("ReportLab is required for invoice generation") from exc

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ─── Heading styles ───────────────────────────────────────
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#666666"),
    )
    right_style = ParagraphStyle(
        "RightAlign",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=10,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#888888"),
    )
    value_style = ParagraphStyle(
        "Value",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#333333"),
    )
    bold_style = ParagraphStyle(
        "Bold",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica-Bold",
    )
    total_style = ParagraphStyle(
        "Total",
        parent=styles["Normal"],
        fontSize=12,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1a1a2e"),
        alignment=TA_RIGHT,
    )

    # ─── Header: Company + Invoice label ──────────────────────
    company_name = "Your Company"
    company_address = ""
    company_gst = ""
    seller_email = ""

    if seller:
        company_name = seller.company_name or seller.full_name or "Your Company"
        company_address = seller.address or ""
        company_gst = seller.gst_number or ""
        seller_email = seller.email or ""

    header_data = [
        [
            Paragraph(company_name, title_style),
            Paragraph("INVOICE", title_style),
        ]
    ]
    if company_address:
        header_data.append([
            Paragraph(company_address, subtitle_style),
            Paragraph(f"Invoice #: {order.order_number}", right_style),
        ])
    else:
        header_data.append([
            Paragraph("", subtitle_style),
            Paragraph(f"Invoice #: {order.order_number}", right_style),
        ])
    if company_gst:
        header_data.append([
            Paragraph(f"GST: {company_gst}", subtitle_style),
            Paragraph(
                f"Date: {order.created_at.strftime('%d %B %Y') if order.created_at else datetime.utcnow().strftime('%d %B %Y')}",
                right_style,
            ),
        ])
    else:
        header_data.append([
            Paragraph("", subtitle_style),
            Paragraph(
                f"Date: {order.created_at.strftime('%d %B %Y') if order.created_at else datetime.utcnow().strftime('%d %B %Y')}",
                right_style,
            ),
        ])

    header_table = Table(header_data, colWidths=["60%", "40%"])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1a1a2e"), spaceAfter=12))

    # ─── Bill To / Ship To ─────────────────────────────────────
    address_parts = [order.address_line1]
    if order.address_line2:
        address_parts.append(order.address_line2)
    address_parts.append(f"{order.city}, {order.state} - {order.pincode}")
    address_parts.append(order.country)
    address_str = "<br/>".join(address_parts)

    bill_data = [
        [Paragraph("BILL TO", label_style), Paragraph("ORDER DETAILS", label_style)],
        [Paragraph(f"<b>{order.customer_name}</b>", value_style), Paragraph(f"Order #: <b>{order.order_number}</b>", value_style)],
        [Paragraph(order.customer_email, value_style), Paragraph(f"Status: <b>{order.status.value if hasattr(order.status, 'value') else order.status}</b>", value_style)],
        [Paragraph(order.customer_phone, value_style), Paragraph(f"Payment: Razorpay", value_style)],
        [Paragraph(address_str, value_style), Paragraph("", value_style)],
    ]

    bill_table = Table(bill_data, colWidths=["55%", "45%"])
    bill_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 12))

    # ─── Line items ───────────────────────────────────────────
    effective_price = order.discount_price if order.discount_price else order.unit_price
    line_total = Decimal(str(effective_price)) * order.quantity

    items_header = ["#", "Description", "Unit Price", "Qty", "Amount"]
    items_data = [items_header]

    product_name = "Product"
    if hasattr(order, "product") and order.product:
        product_name = order.product.name

    items_data.append([
        "1",
        product_name,
        f"₹{float(effective_price):,.2f}",
        str(order.quantity),
        f"₹{float(line_total):,.2f}",
    ])

    items_table = Table(
        items_data,
        colWidths=["8%", "42%", "18%", "12%", "20%"],
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f8f8")]),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 8))

    # ─── Totals ───────────────────────────────────────────────
    subtotal = line_total
    shipping = Decimal(str(order.shipping_charge)) if order.shipping_charge else Decimal("0")
    coupon_discount = Decimal(str(order.coupon_discount)) if order.coupon_discount else Decimal("0")
    total = Decimal(str(order.total_amount))

    totals_data = []
    totals_data.append(["", "Subtotal:", f"₹{float(subtotal):,.2f}"])
    if shipping > 0:
        totals_data.append(["", "Shipping:", f"₹{float(shipping):,.2f}"])
    if coupon_discount > 0:
        totals_data.append(["", f"Coupon ({order.coupon_code or ''}):", f"-₹{float(coupon_discount):,.2f}"])
    totals_data.append(["", "TOTAL:", f"₹{float(total):,.2f}"])

    totals_table = Table(totals_data, colWidths=["60%", "22%", "18%"])
    total_row_idx = len(totals_data) - 1
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (2, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTNAME", (1, total_row_idx), (2, total_row_idx), "Helvetica-Bold"),
        ("FONTSIZE", (1, total_row_idx), (2, total_row_idx), 11),
        ("LINEABOVE", (1, total_row_idx), (2, total_row_idx), 1, colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (1, total_row_idx), (2, total_row_idx), colors.HexColor("#1a1a2e")),
    ]))
    story.append(totals_table)
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dddddd"), spaceAfter=8, spaceBefore=8))

    # ─── Footer ───────────────────────────────────────────────
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#999999"),
        alignment=TA_CENTER,
    )
    story.append(Paragraph("Thank you for your purchase!", footer_style))
    if seller_email:
        story.append(Paragraph(f"For any queries, contact: {seller_email}", footer_style))
    story.append(Paragraph(
        f"This is a computer-generated invoice. No signature required.",
        footer_style,
    ))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
