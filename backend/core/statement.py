"""Account statement PDF (built with ReportLab).

Note: ReportLab's built-in fonts have no rupee sign, so amounts are written as "Rs.".
"""
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.db.models import Q
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Transaction

BRAND = colors.HexColor("#1f4fa3")
LIGHT = colors.HexColor("#eef4ff")
MAX_ROWS = 3000


class StatementTooLarge(Exception):
    pass


def money(value):
    return f"{Decimal(value):,.2f}"


def collect_statement(account, date_from=None, date_to=None):
    """Return opening/closing balance, totals and the rows inside the date range.

    Every change to a balance is a Transaction, so the running balance is rebuilt
    from zero by walking the ledger in order.
    """
    txns = (
        Transaction.objects.filter(Q(from_account=account) | Q(to_account=account))
        .select_related("from_account__user", "to_account__user")
        .order_by("created_at", "id")
    )

    balance = Decimal("0")
    opening = Decimal("0")
    closing = Decimal("0")
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    rows = []

    for txn in txns:
        is_debit = txn.from_account_id == account.id
        balance += -txn.amount if is_debit else txn.amount
        local = timezone.localtime(txn.created_at)
        day = local.date()

        if date_from and day < date_from:
            opening = balance
            closing = balance
            continue
        if date_to and day > date_to:
            break

        other_name, other_number = txn.to_party() if is_debit else txn.from_party()
        rows.append({
            "when": local,
            "ref": txn.txn_ref,
            "name": other_name,
            "number": other_number,
            "remark": txn.remark,
            "debit": txn.amount if is_debit else None,
            "credit": None if is_debit else txn.amount,
            "balance": balance,
        })
        closing = balance
        if is_debit:
            total_debit += txn.amount
        else:
            total_credit += txn.amount
        if len(rows) > MAX_ROWS:
            raise StatementTooLarge()

    return {
        "opening": opening,
        "closing": closing,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "rows": rows,
    }


def _page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(
        15 * mm, 9 * mm,
        "Konark Trust Bank is a demo project, not a real bank. Computer-generated statement.",
    )
    canvas.drawRightString(A4[0] - 15 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_statement_pdf(account, date_from=None, date_to=None):
    data = collect_statement(account, date_from, date_to)

    styles = getSampleStyleSheet()
    title = ParagraphStyle("t", parent=styles["Title"], textColor=BRAND, fontSize=20, alignment=0, spaceAfter=0)
    sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=11, textColor=colors.HexColor("#334155"))
    cell = ParagraphStyle("c", parent=styles["Normal"], fontSize=7.5, leading=9.5)
    muted = ParagraphStyle("m", parent=cell, textColor=colors.HexColor("#64748b"))

    if date_from or date_to:
        period = f"{date_from.strftime('%d %b %Y') if date_from else 'Start'} to " \
                 f"{date_to.strftime('%d %b %Y') if date_to else 'Today'}"
    else:
        period = "All transactions"

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=14 * mm, bottomMargin=16 * mm,
        title=f"Account statement {account.account_number}", author="Konark Trust Bank",
    )

    story = [
        Paragraph("Konark Trust Bank", title),
        Paragraph("Account Statement", sub),
        Spacer(1, 6 * mm),
    ]

    holder = account.user
    info = Table(
        [
            ["Account holder", holder.display_name, "Account number", account.account_number],
            ["Username", holder.username, "Statement period", period],
            ["Generated on", timezone.localtime().strftime("%d %b %Y, %H:%M"), "", ""],
        ],
        colWidths=[30 * mm, 55 * mm, 32 * mm, 63 * mm],
    )
    info.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#475569")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story += [info, Spacer(1, 5 * mm)]

    summary = Table(
        [
            ["Opening balance", "Total debits", "Total credits", "Closing balance"],
            [f"Rs. {money(data['opening'])}", f"Rs. {money(data['total_debit'])}",
             f"Rs. {money(data['total_credit'])}", f"Rs. {money(data['closing'])}"],
        ],
        colWidths=[45 * mm] * 4,
    )
    summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("FONTSIZE", (0, 0), (-1, 0), 7.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#475569")),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, 1), 10),
        ("TEXTCOLOR", (0, 1), (-1, 1), BRAND),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#b6ceff")),
    ]))
    story += [summary, Spacer(1, 6 * mm)]

    header = ["Date", "Reference", "Details", "Debit (Rs.)", "Credit (Rs.)", "Balance (Rs.)"]
    table_rows = [header]
    for row in data["rows"]:
        details = f"<b>{escape(row['name'])}</b>"
        if row["number"]:
            details += f"<br/>A/c {escape(row['number'])}"
        if row["remark"]:
            details += f"<br/>{escape(row['remark'])}"
        table_rows.append([
            Paragraph(row["when"].strftime("%d %b %Y<br/>%H:%M"), cell),
            Paragraph(escape(row["ref"]), muted),
            Paragraph(details, cell),
            money(row["debit"]) if row["debit"] is not None else "",
            money(row["credit"]) if row["credit"] is not None else "",
            money(row["balance"]),
        ])

    if not data["rows"]:
        story.append(Paragraph("No transactions in this period.", sub))
    else:
        table = Table(
            table_rows, repeatRows=1,
            colWidths=[24 * mm, 33 * mm, 55 * mm, 22 * mm, 22 * mm, 24 * mm],
        )
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("FONTSIZE", (3, 1), (-1, -1), 8),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)

    doc.build(story, onFirstPage=_page_footer, onLaterPages=_page_footer)
    return buffer.getvalue()
