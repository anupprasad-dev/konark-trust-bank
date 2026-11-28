"""Receipt PDF for one transaction (ReportLab). Amounts are written as "Rs." because the built-in fonts have no rupee sign."""
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .bankinfo import BANK_BRANCH, BANK_IFSC, BANK_NAME
from .statement import BRAND, LIGHT, WheelLogo

GREEN = colors.HexColor("#047857")
RED = colors.HexColor("#b91c1c")
SLATE = colors.HexColor("#475569")


def _money(value):
    return f"{value:,.2f}"


def build_receipt_pdf(txn, account):
    """PDF bytes for `txn`, seen from `account` (the customer's own account)."""
    debit = txn.from_account_id == account.id
    cancelled = txn.status == txn.Status.CANCELLED
    from_name, from_no = txn.from_party()
    to_name, to_no = txn.to_party()

    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], textColor=BRAND, fontSize=20, alignment=0, spaceAfter=0)
    muted = ParagraphStyle("m", parent=styles["Normal"], fontSize=8.5, textColor=SLATE)
    right = ParagraphStyle("r", parent=muted, alignment=2, fontSize=9)
    cell = ParagraphStyle("c", parent=styles["Normal"], fontSize=10, leading=13)
    label = ParagraphStyle("l", parent=cell, fontSize=9, textColor=SLATE)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Receipt {txn.txn_ref}", author=BANK_NAME,
    )

    head = Table(
        [[
            WheelLogo(),
            [Paragraph(BANK_NAME, title), Paragraph(f"{BANK_BRANCH}  |  IFSC {BANK_IFSC}", muted)],
            [Paragraph("<b>TRANSACTION RECEIPT</b>", right),
             Paragraph(f"Generated {timezone.localtime():%d %b %Y, %H:%M}", right)],
        ]],
        colWidths=[19 * mm, 85 * mm, 66 * mm],
    )
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, BRAND),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
    ]))

    if cancelled:
        status_text, status_color = "CANCELLED", RED
    else:
        status_text, status_color = "SUCCESSFUL", GREEN
    sign = "-" if debit else "+"
    amount_style = ParagraphStyle("a", parent=cell, fontSize=24, leading=28, alignment=1, textColor=status_color, fontName="Helvetica-Bold")
    status_style = ParagraphStyle("s", parent=cell, fontSize=10, alignment=1, textColor=status_color, fontName="Helvetica-Bold")
    sub_style = ParagraphStyle("u", parent=muted, alignment=1)
    banner = Table(
        [[Paragraph(status_text, status_style)],
         [Paragraph(f"{sign} Rs. {_money(txn.amount)}", amount_style)],
         [Paragraph(f"{'Money sent' if debit else 'Money received'} &middot; {escape(txn.get_txn_type_display())}", sub_style)]],
        colWidths=[170 * mm],
    )
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#b6ceff")),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
    ]))

    def party(name, number):
        text = f"<b>{escape(name)}</b>"
        return Paragraph(text + (f"<br/>A/c {escape(number)}" if number else ""), cell)

    rows = [
        ("Reference number", Paragraph(escape(txn.txn_ref), cell)),
        ("Date and time", Paragraph(timezone.localtime(txn.created_at).strftime("%d %b %Y, %I:%M %p"), cell)),
        ("From", party(from_name, from_no)),
        ("To", party(to_name, to_no)),
        ("Remark", Paragraph(escape(txn.remark) or "-", cell)),
        ("Status", Paragraph(status_text.title(), cell)),
    ]
    if cancelled and txn.cancel_reason:
        rows.append(("Cancel reason", Paragraph(escape(txn.cancel_reason), cell)))
    details = Table([[Paragraph(k, label), v] for k, v in rows], colWidths=[45 * mm, 125 * mm])
    details.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
    ]))

    foot = ParagraphStyle("f", parent=muted, alignment=1, fontSize=8)
    doc.build([
        head, Spacer(1, 8 * mm), banner, Spacer(1, 7 * mm), details, Spacer(1, 12 * mm),
        Paragraph("This is a computer-generated receipt and does not need a signature.", foot),
        Paragraph(f"{BANK_NAME} &middot; {BANK_BRANCH}", foot),
    ])
    return buffer.getvalue()
