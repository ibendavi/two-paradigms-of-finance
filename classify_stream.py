"""
Classify textbooks as Academic or Practitioner from content style + audience keywords.
Scans first 10 pages only — introductions/prefaces reveal the target audience.

Two signal categories:
  1. Writing style (formal theory vs. how-to language)
  2. Target audience (who the book says it's written for)

Output: stream_scores.csv with columns: filename, acad_hits, prac_hits, stream_score
  stream_score = (acad_hits - prac_hits) / (acad_hits + prac_hits)
  Range: -1 (pure practitioner) to +1 (pure academic)
"""

import os
import re
import sys
import csv
import time
from pathlib import Path
from collections import Counter

try:
    import fitz
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

# ---------------------------------------------------------------------------
# Academic style keywords — things that appear in textbooks/theory, not in
# practitioner guides
# ---------------------------------------------------------------------------
ACADEMIC_STYLE = [
    # Formal theory
    ("theorem", r"\btheorem\b"),
    ("proposition", r"\bproposition\b"),
    ("lemma", r"\blemma\b"),
    ("proof", r"\bproof\b"),
    ("corollary", r"\bcorollary\b"),
    ("equilibrium", r"\bequilibrium\b"),
    ("optimal", r"\boptimal\b"),
    ("maximize utility", r"maximi[sz]e.{0,10}utility"),
    ("social welfare", r"social welfare"),

    # Econometrics / statistics
    ("regression", r"\bregression\b"),
    ("coefficient", r"\bcoefficient\b"),
    ("standard error", r"standard error"),
    ("t-statistic", r"t.statistic"),
    ("p-value", r"p.value"),
    ("OLS", r"\bols\b"),
    ("panel data", r"panel data"),
    ("instrumental variable", r"instrumental variable"),
    ("fixed effects", r"fixed effects"),
    ("heteroskedast", r"heterosk?edast"),
    ("endogen", r"\bendogen"),
    ("R-squared", r"r.squared"),

    # Academic citation patterns
    ("et al.", r"\bet al\b"),
    ("Journal of Finance", r"journal of finance"),
    ("Journal of Financial Economics", r"journal of financial economics"),
    ("Review of Financial Studies", r"review of financial studies"),
    ("American Economic Review", r"american economic review"),
    ("Quarterly Journal", r"quarterly journal"),
    ("working paper", r"working paper"),
    ("forthcoming", r"\bforthcoming\b"),

    # Academic framing
    ("literature review", r"literature review"),
    ("empirical evidence", r"empirical evidence"),
    ("the model", r"\bthe model\b"),
    ("we show that", r"we show that"),
    ("we find that", r"we find that"),
    ("we derive", r"we derive"),
    ("we assume", r"we assume"),
    ("testable implication", r"testable implication"),
    ("null hypothesis", r"null hypothesis"),

    # Target audience: course/textbook signals (found in introductions/prefaces)
    ("textbook", r"\btextbook\b"),
    ("course", r"\bcourses?\b"),
    ("end-of-chapter", r"end.of.chapter"),
    ("problem sets", r"problem sets?\b"),
    ("exercises", r"chapter.{0,10}exercises?\b"),
    ("instructor", r"\binstructor"),
    ("solutions manual", r"solutions manual"),
    ("syllabus", r"\bsyllabus\b"),
    ("curriculum", r"\bcurriculum\b"),
    ("prerequisite", r"\bprerequisites?\b"),
    ("undergraduate", r"\bundergraduate\b"),
    ("graduate students", r"graduate.{0,10}student"),
    ("MBA students", r"\bmba\b"),
    ("classroom", r"\bclassroom\b"),
    ("semester", r"\bsemester\b"),
    ("university press", r"university press"),
    ("suggested readings", r"suggested readings?"),
    ("further reading", r"further reading"),
    ("review questions", r"review questions"),
    ("study questions", r"study questions"),
    ("learning objectives", r"learning objectives?"),
    ("designed for students", r"designed for.{0,20}student"),
]

# ---------------------------------------------------------------------------
# Practitioner style keywords — things that appear in how-to guides,
# Wall Street manuals, CFO handbooks
# ---------------------------------------------------------------------------
PRACTITIONER_STYLE = [
    # Practical advice / how-to
    ("how to", r"how to"),
    ("step by step", r"step.by.step"),
    ("rule of thumb", r"rule of thumb"),
    ("in practice", r"in practice"),
    ("practical", r"\bpractical\b"),
    ("tip", r"\btips?\b"),
    ("guide", r"\bguide\b"),
    ("handbook", r"\bhandbook\b"),
    ("checklist", r"\bchecklist\b"),
    ("best practice", r"best practice"),
    ("real-world", r"real.world"),
    ("case study", r"case stud"),

    # Industry / market language
    ("Wall Street", r"wall street"),
    ("Main Street", r"main street"),
    ("broker", r"\bbroker\b"),
    ("trader", r"\btrader\b"),
    ("portfolio manager", r"portfolio manager"),
    ("fund manager", r"fund manager"),
    ("money manager", r"money manager"),
    ("investment banker", r"investment banker"),
    ("pitch book", r"pitch book"),
    ("due diligence", r"due diligence"),
    ("term sheet", r"term sheet"),

    # Personal / retail
    ("your portfolio", r"your portfolio"),
    ("your money", r"your money"),
    ("your investment", r"your investment"),
    ("retirement", r"\bretirement\b"),
    ("financial planning", r"financial planning"),
    ("wealth management", r"wealth management"),
    ("financial advisor", r"financial advisor"),
    ("personal finance", r"personal finance"),
    ("nest egg", r"nest egg"),
    ("bottom line", r"bottom line"),

    # Business operations
    ("CFO", r"\bcfo\b"),
    ("CEO", r"\bceo\b"),
    ("board of directors", r"board of directors"),
    ("compliance", r"\bcompliance\b"),

    # Target audience: practitioner signals (found in introductions/prefaces)
    ("written for practitioners", r"written for.{0,20}practitioner"),
    ("written for executives", r"written for.{0,20}executive"),
    ("written for managers", r"written for.{0,20}manager"),
    ("written for investors", r"written for.{0,20}investor"),
    ("a guide for", r"a guide for"),
    ("for the practicing", r"for the practicing"),
    ("you will learn", r"you will learn"),
    ("the reader will", r"the reader will"),
    ("readers will", r"readers will"),
    ("client", r"\bclients?\b"),
    ("plain English", r"plain english"),
    ("no-nonsense", r"no.nonsense"),
    ("straightforward", r"\bstraightforward\b"),
    ("bottom-line", r"bottom.line"),
    ("actionable", r"\bactionable\b"),
    ("proven strategies", r"proven.{0,10}strateg"),
    ("secrets of", r"secrets of"),
    ("insider", r"\binsider\b"),
]


def extract_text_first_pages(pdf_path, max_pages=10):
    """Extract text from first N pages of a PDF."""
    if not HAS_FITZ:
        return ""
    try:
        doc = fitz.open(pdf_path)
        pages = min(doc.page_count, max_pages)
        text = ""
        for i in range(pages):
            text += doc[i].get_text() + "\n"
        doc.close()
        return text
    except Exception:
        return ""


def count_style_keywords(text, keyword_list):
    text_lower = text.lower()
    text_norm = re.sub(r'[-\u2013\u2014/]', ' ', text_lower)
    total = 0
    per_term = Counter()
    for label, pattern in keyword_list:
        hits = len(re.findall(pattern, text_norm, re.IGNORECASE))
        if hits > 0:
            per_term[label] = hits
            total += hits
    return total, per_term


def main():
    sys.stdout.reconfigure(line_buffering=True)

    lit_root = os.path.dirname(os.path.abspath(__file__))
    lit_root = os.path.dirname(lit_root)
    textbooks_dir = os.path.join(lit_root, "Textbooks")
    output_csv = os.path.join(lit_root, "website", "stream_scores.csv")

    if not HAS_FITZ:
        print("ERROR: Need PyMuPDF (fitz). Install: pip install PyMuPDF")
        sys.exit(1)

    pdfs = []
    for root, dirs, files in os.walk(textbooks_dir):
        if "bin" in root.lower().split(os.sep):
            continue
        for f in files:
            if f.lower().endswith(".pdf"):
                full = os.path.join(root, f)
                rel = os.path.relpath(full, lit_root)
                pdfs.append((full, rel, f))

    print(f"Found {len(pdfs)} PDFs to classify")
    print(f"Scanning first 10 pages of each")
    print()

    results = []
    start_time = time.time()

    for i, (full_path, rel_path, filename) in enumerate(pdfs):
        text = extract_text_first_pages(full_path, max_pages=10)

        acad_hits, acad_terms = count_style_keywords(text, ACADEMIC_STYLE)
        prac_hits, prac_terms = count_style_keywords(text, PRACTITIONER_STYLE)

        denom = acad_hits + prac_hits
        stream_score = (acad_hits - prac_hits) / denom if denom > 0 else 0.0

        top_acad = ", ".join(f"{k}({v})" for k, v in acad_terms.most_common(5))
        top_prac = ", ".join(f"{k}({v})" for k, v in prac_terms.most_common(5))

        results.append({
            "filename": filename,
            "path": rel_path.replace("\\", "/"),
            "acad_hits": acad_hits,
            "prac_hits": prac_hits,
            "stream_score": round(stream_score, 4),
            "top_acad_terms": top_acad,
            "top_prac_terms": top_prac,
        })

        if (i + 1) % 50 == 0 or (i + 1) == len(pdfs):
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(pdfs) - i - 1) / rate if rate > 0 else 0
            print(f"  [{i+1}/{len(pdfs)}] {rate:.1f} PDFs/sec, ~{remaining:.0f}s remaining")

    with open(output_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "filename", "path", "acad_hits", "prac_hits", "stream_score",
            "top_acad_terms", "top_prac_terms",
        ])
        w.writeheader()
        w.writerows(results)

    print(f"\nDone. Wrote {len(results)} entries to {output_csv}")

    # Quick stats
    scored = [r for r in results if r["acad_hits"] + r["prac_hits"] > 0]
    acad = [r for r in scored if r["stream_score"] > 0.1]
    prac = [r for r in scored if r["stream_score"] < -0.1]
    print(f"  Academic-leaning (>0.1): {len(acad)}")
    print(f"  Practitioner-leaning (<-0.1): {len(prac)}")
    print(f"  Neutral/mixed: {len(scored) - len(acad) - len(prac)}")


if __name__ == "__main__":
    main()
