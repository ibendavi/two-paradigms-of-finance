"""
Score textbooks on the EPS-vs-NPV spectrum by scanning OCR'd PDF text.

Method: relative keyword counts from full text.
  score = (npv_hits - eps_hits) / (npv_hits + eps_hits)
  Range: -1 (pure EPS/practitioner) to +1 (pure NPV/academic)
  Score = 0 if no keywords found.

No artificial time scaling. No stream weighting. Let the text speak.

Output: scores.csv with columns: filename, path, author, title, year,
        npv_hits, eps_hits, score, top_npv_terms, top_eps_terms
"""

import os
import re
import sys
import csv
import time
import math
from pathlib import Path
from collections import Counter

# Try to import PDF text extraction
try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    from pdfminer.high_level import extract_text as pdfminer_extract
    HAS_PDFMINER = True
except ImportError:
    HAS_PDFMINER = False

# ---------------------------------------------------------------------------
# Keyword lists — confirmed with user
# ---------------------------------------------------------------------------

# Each entry is (display_label, pattern, word_boundary)
# word_boundary=True means we match \bPATTERN\b to avoid false positives

NPV_KEYWORDS = [
    # Capital structure & payout (MM core)
    ("modigliani and miller", r"modigliani.{1,5}miller", False),
    ("miller-modigliani", r"miller.{1,5}modigliani", False),
    ("irrelevance proposition", r"irrelevance proposition", False),
    ("proposition i", r"proposition\s+i\b", False),
    ("proposition ii", r"proposition\s+ii\b", False),
    ("homemade leverage", r"homemade leverage", False),
    ("perfect capital markets", r"perfect capital market", False),
    ("tax shield", r"tax shield", False),
    ("interest tax shield", r"interest tax shield", False),

    # Value criterion & capital budgeting
    ("present value", r"present value", False),
    ("net present value", r"net present value", False),
    ("npv", r"\bnpv\b", True),
    ("discounted cash flow", r"discounted cash flow", False),
    ("dcf", r"\bdcf\b", True),
    ("incremental cash flow", r"incremental cash flow", False),
    ("opportunity cost", r"opportunity cost", False),
    ("sunk cost", r"sunk cost", False),
    ("weighted average cost of capital", r"weighted average cost of capital", False),
    ("wacc", r"\bwacc\b", True),
    ("risk-adjusted discount rate", r"risk.adjusted discount rate", False),
    ("free cash flow", r"free cash flow", False),
    ("fcf", r"\bfcf\b", True),
    ("terminal value", r"terminal value", False),
    ("perpetuity growth", r"perpetuity growth", False),
    ("gordon growth model", r"gordon.{0,10}(growth|model)", False),
    ("gordon model", r"gordon.{0,5}model", False),

    # Risk & expected return
    ("capm", r"\bcapm\b", True),
    ("capital asset pricing", r"capital asset pricing", False),
    # "beta" as standalone REMOVED — matches Greek letter in any math context (335 false positives)
    ("beta coefficient", r"beta coefficient", False),
    ("stock beta", r"stock.s? beta", False),
    ("portfolio beta", r"portfolio beta", False),
    ("equity beta", r"equity beta", False),
    ("asset beta", r"asset beta", False),
    ("unlevered beta", r"unlevered beta", False),
    ("levered beta", r"levered beta", False),
    ("systematic risk", r"systematic risk", False),
    ("security market line", r"security market line", False),
    ("sml", r"\bsml\b", True),
    ("capital market line", r"capital market line", False),
    # "cml" standalone REMOVED — matches abbreviations in accounting/other contexts
    ("efficient frontier", r"efficient frontier", False),
    ("mean-variance", r"mean.variance", False),
    ("markowitz", r"markowitz", False),
    ("portfolio theory", r"portfolio theory", False),
    ("factor model", r"factor model", False),
    ("fama-french", r"fama.french", False),
    # "factors" REMOVED — matches "factors of production" in pre-1950 books (1,146 false positives)
    ("risk premium", r"risk premium", False),
    ("expected return", r"expected return", False),

    # Markets & information
    ("efficient market", r"efficient market", False),
    ("emh", r"\bemh\b", True),
    ("random walk", r"random walk", False),
    ("event study", r"event stud", False),

    # No-arbitrage & derivatives
    ("no-arbitrage", r"no.arbitrage", False),
    ("arbitrage pricing", r"arbitrage pricing", False),
    ("option pricing", r"option pricing", False),
    ("black-scholes", r"black.scholes", False),
    # "merton" standalone REMOVED — matches place names (87 false positives)
    ("merton model", r"merton.{0,5}model", False),
    ("robert merton", r"robert.{0,5}merton", False),
    ("put-call parity", r"put.call parity", False),
    ("contingent claim", r"contingent claim", False),
    ("state-contingent", r"state.contingent", False),

    # Historical / pre-1900 discounting vocabulary
    ("present worth", r"present worth", False),
    ("discounted value", r"discounted value", False),
    ("time value of money", r"time value of money", False),

    # Agency & information frictions
    ("agency cost", r"agency cost", False),
    ("jensen-meckling", r"jensen.meckling", False),
    ("information asymmetry", r"information asymmetr", False),
    # "signaling" REMOVED — matches railroad/military signals (122 false positives)
    ("signaling model", r"signal(?:ing|ling) model", False),
    ("signaling theory", r"signal(?:ing|ling) theory", False),
    ("signaling equilibrium", r"signal(?:ing|ling) equilibri", False),
    ("pecking order", r"pecking order", False),
    ("trade-off theory", r"trade.off theory", False),
    ("tradeoff theory", r"tradeoff theory", False),
]

EPS_KEYWORDS = [
    # Objective in accounting terms
    ("earnings per share", r"earnings per share", False),
    ("eps", r"\beps\b", True),
    ("street eps", r"street eps", False),
    ("per share", r"per share", False),
    ("maximize net income", r"maximi[sz]e net income", False),
    ("return on equity", r"return on equity", False),
    ("roe", r"\broe\b", True),
    ("return on capital", r"return on capital", False),
    ("accretive/accretion", r"accreti", False),
    ("dilutive/dilution", r"diluti", False),
    ("earnings yield", r"earnings yield", False),

    # Capital structure without MM
    ("traditional theory", r"traditional theory", False),
    ("optimal capital structure", r"optimal capital structure", False),
    ("minimum cost of capital", r"minimum cost of capital", False),
    ("net income approach", r"net income approach", False),
    ("net operating income approach", r"net operating income approach", False),
    ("trading on the equity", r"trading on the equity", False),
    ("ebit-eps", r"ebit.eps", False),
    ("eps indifference", r"eps indifference", False),
    ("indifference point", r"indifference point", False),

    # Valuation via multiples
    ("price-to-earnings", r"price.to.earnings", False),
    ("price-earnings", r"price.earnings", False),
    ("p/e ratio", r"p/?e ratio", False),
    ("pe ratio", r"\bpe ratio\b", True),
    ("earning power", r"earning power", False),
    ("capitalization of earnings", r"capitali[sz]ation of earnings", False),
    ("capitalization rate", r"capitali[sz]ation rate", False),
    ("cap rate", r"\bcap rate\b", True),
    ("comparables", r"comparables", False),
    ("comps", r"\bcomps\b", True),
    ("relative valuation", r"relative valuation", False),
    ("valuation multiple", r"valuation multiple", False),
    ("trading multiple", r"trading multiple", False),
    ("ebitda", r"\bebitda\b", True),
    ("book value", r"book value", False),
    ("price to book", r"price.to.book", False),

    # Investment rules (not value-based)
    ("payback period", r"payback period", False),
    ("accounting rate of return", r"accounting rate of return", False),
    ("average rate of return", r"average rate of return", False),

    # Risk via accounting safety
    ("margin of safety", r"margin of safety", False),
    ("coverage ratio", r"coverage ratio", False),
    ("times interest earned", r"times interest earned", False),
    ("debt capacity", r"debt capacity", False),

    # Historical / pre-1900 earnings-capitalization vocabulary
    ("intrinsic value", r"intrinsic value", False),
    ("dividend yield", r"dividend yield", False),
    ("par value", r"par value", False),
    ("earning capacity", r"earning capacity", False),
    ("rate of return", r"\brate of return\b", False),

    # Practitioner language
    ("consensus estimate", r"consensus estimate", False),
    ("analyst estimate", r"analyst estimate", False),
    ("non-gaap", r"non.gaap", False),
    ("adjusted earnings", r"adjusted earnings", False),
    ("run-rate", r"run.rate", False),
]


def extract_text_from_pdf(pdf_path, max_pages=None):
    """Extract text from PDF. Try PyMuPDF first, fall back to pdfminer."""
    text = ""
    if HAS_FITZ:
        try:
            doc = fitz.open(pdf_path)
            pages = doc.page_count
            if max_pages:
                pages = min(pages, max_pages)
            for i in range(pages):
                page = doc[i]
                text += page.get_text() + "\n"
            doc.close()
            return text
        except Exception:
            pass
    if HAS_PDFMINER:
        try:
            text = pdfminer_extract(pdf_path, maxpages=max_pages or 0)
            return text
        except Exception:
            pass
    return ""


def count_keywords(text, keyword_list):
    """Count total hits for a keyword list. Returns (total_hits, per_term_counts)."""
    text_lower = text.lower()
    # Normalize: replace hyphens/dashes/slashes with spaces (keep originals too)
    text_norm = re.sub(r'[-\u2013\u2014/]', ' ', text_lower)
    # Search in both original lowercase and normalized text
    combined = text_lower + " " + text_norm

    total = 0
    per_term = Counter()
    for label, pattern, _wb in keyword_list:
        hits = len(re.findall(pattern, combined, re.IGNORECASE))
        # De-duplicate: since we search combined (2x text), divide by rough factor
        # Actually, let's just search text_norm which has both forms
        hits = len(re.findall(pattern, text_norm, re.IGNORECASE))
        if hits > 0:
            per_term[label] = hits
            total += hits
    return total, per_term


def score_pdf(pdf_path, max_pages=None):
    """Score a single PDF. Returns (npv_hits, eps_hits, score, top_npv, top_eps)."""
    text = extract_text_from_pdf(pdf_path, max_pages=max_pages)
    if not text or len(text) < 100:
        return 0, 0, 0.0, "", ""

    npv_total, npv_terms = count_keywords(text, NPV_KEYWORDS)
    eps_total, eps_terms = count_keywords(text, EPS_KEYWORDS)

    denom = npv_total + eps_total
    if denom == 0:
        score = 0.0
    else:
        score = (npv_total - eps_total) / denom

    top_npv = ", ".join(f"{k}({v})" for k, v in npv_terms.most_common(5))
    top_eps = ", ".join(f"{k}({v})" for k, v in eps_terms.most_common(5))

    return npv_total, eps_total, round(score, 4), top_npv, top_eps


def parse_filename(filename):
    """Extract author, title, year from standard filename format."""
    name = Path(filename).stem
    # Pattern: Author - Title (Type Year)
    m = re.match(r'^(.+?)\s*-\s*(.+?)(?:\s*\((?:Book|Article|Report|Pamphlet)\s+(\d{4})\))?$', name)
    if m:
        author = m.group(1).strip()
        title = m.group(2).strip()
        year = int(m.group(3)) if m.group(3) else 0
    else:
        author = ""
        title = name
        year_m = re.search(r'(\d{4})', name)
        year = int(year_m.group(1)) if year_m else 0
    return author, title, year


def main():
    sys.stdout.reconfigure(line_buffering=True)

    lit_root = os.path.dirname(os.path.abspath(__file__))
    lit_root = os.path.dirname(lit_root)  # Up from website/ to EPS Literature/
    textbooks_dir = os.path.join(lit_root, "Textbooks")
    output_csv = os.path.join(lit_root, "website", "scores.csv")

    if not HAS_FITZ and not HAS_PDFMINER:
        print("ERROR: Need PyMuPDF (fitz) or pdfminer. Install: pip install PyMuPDF")
        sys.exit(1)

    # Collect all PDFs
    pdfs = []
    for root, dirs, files in os.walk(textbooks_dir):
        # Skip bin directories
        if "bin" in root.lower().split(os.sep):
            continue
        for f in files:
            if f.lower().endswith(".pdf"):
                full = os.path.join(root, f)
                rel = os.path.relpath(full, lit_root)
                pdfs.append((full, rel, f))

    # Also scan Historical Railways
    railways_dir = os.path.join(lit_root, "Historical Railways")
    if os.path.isdir(railways_dir):
        for root, dirs, files in os.walk(railways_dir):
            for f in files:
                if f.lower().endswith(".pdf"):
                    full = os.path.join(root, f)
                    rel = os.path.relpath(full, lit_root)
                    pdfs.append((full, rel, f))

    print(f"Found {len(pdfs)} PDFs to score")
    print(f"Using: {'PyMuPDF' if HAS_FITZ else 'pdfminer'}")
    print()

    results = []
    start_time = time.time()

    for i, (full_path, rel_path, filename) in enumerate(pdfs):
        author, title, year = parse_filename(filename)

        try:
            npv_hits, eps_hits, score, top_npv, top_eps = score_pdf(full_path)
        except Exception as e:
            print(f"  ERROR [{i+1}] {filename}: {e}")
            npv_hits, eps_hits, score, top_npv, top_eps = 0, 0, 0.0, "", ""

        results.append({
            "filename": filename,
            "path": rel_path.replace("\\", "/"),
            "author": author,
            "title": title,
            "year": year,
            "npv_hits": npv_hits,
            "eps_hits": eps_hits,
            "score": score,
            "top_npv_terms": top_npv,
            "top_eps_terms": top_eps,
        })

        if (i + 1) % 25 == 0 or (i + 1) == len(pdfs):
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            remaining = (len(pdfs) - i - 1) / rate if rate > 0 else 0
            print(f"  [{i+1}/{len(pdfs)}] {rate:.1f} PDFs/sec, ~{remaining:.0f}s remaining — {filename[:60]}")

    # Write CSV
    fieldnames = ["filename", "path", "author", "title", "year",
                   "npv_hits", "eps_hits", "score", "top_npv_terms", "top_eps_terms"]
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    # Summary stats
    scored = [r for r in results if r["npv_hits"] + r["eps_hits"] > 0]
    scores = [r["score"] for r in scored]
    print(f"\nDone! {len(results)} PDFs processed, {len(scored)} had keyword hits.")
    print(f"Output: {output_csv}")

    if scores:
        strong_eps = sum(1 for s in scores if s < -0.3)
        mild_eps = sum(1 for s in scores if -0.3 <= s < -0.1)
        center = sum(1 for s in scores if -0.1 <= s <= 0.1)
        mild_npv = sum(1 for s in scores if 0.1 < s <= 0.3)
        strong_npv = sum(1 for s in scores if s > 0.3)
        print(f"\nScore distribution (of {len(scored)} with hits):")
        print(f"  Strong EPS  (<-0.3): {strong_eps}")
        print(f"  Mild EPS (-0.3,-0.1): {mild_eps}")
        print(f"  Center   (-0.1, 0.1): {center}")
        print(f"  Mild NPV  (0.1, 0.3): {mild_npv}")
        print(f"  Strong NPV    (>0.3): {strong_npv}")


if __name__ == "__main__":
    main()
