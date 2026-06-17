#!/usr/bin/env python3
"""Generate HAFF PicklePulse System Overview PDF from markdown source."""

from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
MD_PATH = ROOT / "docs" / "HAFF_PicklePulse_System_Overview.md"
PDF_PATH = ROOT / "docs" / "HAFF_PicklePulse_System_Overview.pdf"

# Brand colors (HAFF forest green palette)
FOREST = (32, 61, 52)
BRASS = (181, 148, 88)
INK = (28, 28, 28)
MUTED = (90, 90, 90)
RULE = (210, 210, 210)


def sanitize(text: str) -> str:
    box_map = str.maketrans({
        "┌": "+", "┐": "+", "└": "+", "┘": "+", "├": "+", "┤": "+",
        "┬": "+", "┴": "+", "┼": "+", "│": "|", "─": "-", "▼": "v",
    })
    return (
        text.translate(box_map)
        .replace("₱", "PHP ")
        .replace("★", "*")
        .replace("→", "->")
        .replace("←", "<-")
        .replace("—", "-")
        .replace("–", "-")
        .replace("…", "...")
        .replace("’", "'")
        .replace("“", '"')
        .replace("”", '"')
    )


class SystemOverviewPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4", unit="mm")
        self.set_auto_page_break(auto=True, margin=18)
        self._in_table = False
        self._table_col_widths: list[float] = []

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "HAFF PicklePulse - System Overview", align="R")
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")

    def cover_page(self) -> None:
        self.add_page()
        self.set_fill_color(*FOREST)
        self.rect(0, 0, 210, 70, style="F")
        self.set_y(22)
        self.set_font("Helvetica", "B", 26)
        self.set_text_color(255, 255, 255)
        self.cell(0, 12, "HAFF PicklePulse", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 14)
        self.cell(0, 10, "System Overview & Architecture", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(18)
        self.set_text_color(*INK)
        self.set_font("Helvetica", "", 11)
        lines = [
            "HAFF Leisure Club — Court rotation, queue, and live TV display",
            "Document version: June 2026",
            "",
            "Purpose: technical baseline for hosting, scaling, and cost planning.",
            "",
            "Contents: architecture, data model, sync, APIs, deployment,",
            "infrastructure profile, limitations, and recent fixes.",
        ]
        for line in lines:
            self.cell(0, 7, sanitize(line), new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.set_draw_color(*BRASS)
        self.set_line_width(0.8)
        self.line(20, self.get_y(), 190, self.get_y())

    def section_title(self, text: str, level: int) -> None:
        if level == 2:
            self.ln(4)
            self.set_font("Helvetica", "B", 14)
            self.set_text_color(*FOREST)
        else:
            self.ln(2)
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(*INK)
        # Strip markdown numbering for cleaner titles
        clean = sanitize(re.sub(r"^\d+\.\s*", "", text))
        self.multi_cell(0, 7, clean)
        self.set_draw_color(*RULE)
        if level == 2:
            self.line(15, self.get_y(), 195, self.get_y())
            self.ln(2)

    def body_text(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(0, 5.5, sanitize(text))
        self.ln(1)

    def bullet(self, text: str) -> None:
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*INK)
        x = self.get_x()
        self.cell(5, 5.5, chr(149))
        self.multi_cell(0, 5.5, sanitize(text))
        self.set_x(x)

    def render_table(self, rows: list[list[str]]) -> None:
        if not rows:
            return
        col_count = max(len(r) for r in rows)
        usable = 180
        widths = [usable / col_count] * col_count
        line_h = 6

        for i, row in enumerate(rows):
            padded = row + [""] * (col_count - len(row))
            if i == 0:
                self.set_font("Helvetica", "B", 9)
                self.set_fill_color(240, 245, 243)
            else:
                self.set_font("Helvetica", "", 9)
                self.set_fill_color(255, 255, 255)

            row_heights = []
            for w, cell in zip(widths, padded):
                cell = sanitize(cell)
                lines = self.multi_cell(w, line_h, cell, dry_run=True, split_only=True)
                row_heights.append(max(1, len(lines)) * line_h)
            max_h = max(row_heights)

            if self.get_y() + max_h > 280:
                self.add_page()

            x0, y0 = self.get_x(), self.get_y()
            for j, (w, cell) in enumerate(zip(widths, padded)):
                cell = sanitize(cell)
                self.set_xy(x0 + sum(widths[:j]), y0)
                self.multi_cell(w, line_h, cell, border=1, fill=(i == 0))
            self.set_xy(x0, y0 + max_h)
            self.set_x(self.l_margin)

        self.ln(2)

    def code_block(self, lines: list[str]) -> None:
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 8)
        self.set_fill_color(248, 248, 248)
        self.set_text_color(40, 40, 40)
        block = sanitize("\n".join(lines))
        if self.get_y() > 250:
            self.add_page()
        self.multi_cell(0, 4.2, block, fill=True)
        self.ln(2)


def parse_markdown(md: str) -> None:
    pdf = SystemOverviewPDF()
    pdf.cover_page()
    pdf.add_page()

    lines = md.splitlines()
    i = 0
    in_code = False
    code_buf: list[str] = []
    table_buf: list[list[str]] = []

    def flush_table() -> None:
        nonlocal table_buf
        if table_buf:
            pdf.render_table(table_buf)
            table_buf = []

    while i < len(lines):
        line = lines[i].rstrip()

        if line.startswith("```"):
            if in_code:
                pdf.code_block(code_buf)
                code_buf = []
                in_code = False
            else:
                flush_table()
                in_code = True
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if line.startswith("|") and "|" in line[1:]:
            if re.match(r"^\|[-:\s|]+\|$", line):
                i += 1
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            table_buf.append(cells)
            i += 1
            continue
        else:
            flush_table()

        if line.startswith("# "):
            i += 1
            continue
        if line.startswith("## "):
            pdf.section_title(line[3:], 2)
            i += 1
            continue
        if line.startswith("### "):
            pdf.section_title(line[4:], 3)
            i += 1
            continue

        if line.startswith("- "):
            pdf.bullet(line[2:])
            i += 1
            continue

        if line.strip() == "---":
            i += 1
            continue

        if line.strip() == "":
            i += 1
            continue

        if line.startswith("*") and line.endswith("*") and not line.startswith("**"):
            i += 1
            continue

        if line.startswith("**") and line.endswith("**"):
            pdf.body_text(line.strip("*"))
            i += 1
            continue

        pdf.body_text(line)
        i += 1

    flush_table()
    pdf.output(str(PDF_PATH))


def main() -> None:
    md = MD_PATH.read_text(encoding="utf-8")
    parse_markdown(md)
    print(f"Wrote {PDF_PATH}")


if __name__ == "__main__":
    main()
