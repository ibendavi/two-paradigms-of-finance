#!/usr/bin/env python3
"""
Build script for The Two Paradigms of Finance website.

Usage:
    python build.py          # build entire site
    python build.py --serve  # build and start local server
"""
import glob
import json
import os
import re
import shutil
import sys
from pathlib import Path

import openpyxl
import yaml
from jinja2 import Environment, FileSystemLoader
from markdown_it import MarkdownIt

import config

# ---------------------------------------------------------------------------
# Markdown renderer
# ---------------------------------------------------------------------------
md = MarkdownIt("commonmark", {"html": True, "typographer": True})
md.enable("table")
md.enable("strikethrough")


# ---------------------------------------------------------------------------
# Research-note parser
# ---------------------------------------------------------------------------
def parse_research_note(path: str) -> dict | None:
    """Parse a structured research note into a dict.

    Expected sections: Key Finding, Source, Details, Significance, Connections.
    Returns None if the file can't be parsed meaningfully.
    """
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()

    if len(text.strip()) < 100:
        return None

    filename = os.path.basename(path)
    slug = Path(path).stem  # filename without .md

    # Title: first H1
    title_match = re.match(r"^#\s+(.+)", text, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else slug

    # Split into sections by ## headers
    sections = {}
    current_header = "_preamble"
    current_lines = []
    for line in text.split("\n"):
        h2 = re.match(r"^##\s+(.+)", line)
        if h2:
            sections[current_header] = "\n".join(current_lines).strip()
            current_header = h2.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)
    sections[current_header] = "\n".join(current_lines).strip()

    # Extract key fields
    key_finding = sections.get("Key Finding", "")
    source = sections.get("Source", "")
    significance = sections.get("Significance", "")
    connections = sections.get("Connections", "")

    # Details = everything that isn't the above
    detail_keys = [
        k for k in sections
        if k not in ("_preamble", "Key Finding", "Source",
                     "Significance", "Connections",
                     "Significance for the EPS Project")
    ]
    # Also grab the EPS-project significance section
    eps_significance = sections.get("Significance for the EPS Project", "")
    if eps_significance and not significance:
        significance = eps_significance
    elif eps_significance:
        significance = significance + "\n\n" + eps_significance

    details_md = "\n\n".join(
        f"## {k}\n\n{sections[k]}" for k in detail_keys if sections[k]
    )

    # Extract year from title or filename
    year = extract_year(title, filename)

    # Extract author from title or filename
    author = extract_author(title, filename)

    # Assign paradigm
    paradigm = assign_paradigm(text, year)

    return {
        "slug": slug,
        "filename": filename,
        "title": title,
        "author": author,
        "year": year,
        "key_finding": key_finding,
        "key_finding_html": md.render(key_finding) if key_finding else "",
        "source": source,
        "source_html": md.render(source) if source else "",
        "significance": significance,
        "significance_html": md.render(significance) if significance else "",
        "connections": connections,
        "connections_html": md.render(connections) if connections else "",
        "details_md": details_md,
        "details_html": md.render(details_md) if details_md else "",
        "full_html": md.render(text),
        "paradigm": paradigm,
        "paradigm_info": config.PARADIGMS[paradigm],
    }


def extract_year(title: str, filename: str) -> int:
    """Pull the primary year from title or filename."""
    # Try filename pattern like _Dean1951_ or _1720_
    m = re.search(r"(\d{4})", filename)
    if m:
        return int(m.group(1))
    # Try title
    m = re.search(r"\((\d{4})\)", title)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d{4})", title)
    if m:
        return int(m.group(1))
    return 0


def extract_author(title: str, filename: str) -> str:
    """Pull author surname(s) from title or filename."""
    # Filename patterns: Valuation_Dean1951, EPS_GrahamHarveyRajgopal2005
    m = re.match(r"[A-Za-z]+_([A-Za-z]+?)(\d{4})", filename)
    if m:
        # CamelCase to separate: GrahamHarvey -> Graham, Harvey
        raw = m.group(1)
        parts = re.findall(r"[A-Z][a-z]+", raw)
        if parts:
            return ", ".join(parts)
        return raw
    # From title: "Author (Year):"
    m = re.match(r"^(.+?)\s*\(\d{4}\)", title)
    if m:
        return m.group(1).strip()
    return ""


def assign_paradigm(text: str, year: int) -> str:
    """Classify a note as practitioner, academic, transitional, or pre-split."""
    text_lower = text.lower()

    prac_score = sum(
        1 for kw in config.PRACTITIONER_KEYWORDS if kw.lower() in text_lower
    )
    acad_score = sum(
        1 for kw in config.ACADEMIC_KEYWORDS if kw.lower() in text_lower
    )

    # Pre-split: everything before 1958 (before M&M)
    if year > 0 and year < 1958:
        return "pre-split"

    # Transitional: year is 1958-1963
    if 1958 <= year <= 1963:
        return "transitional"

    if prac_score >= 3 and acad_score >= 3:
        return "transitional"

    if acad_score > prac_score:
        return "academic"
    if prac_score > acad_score:
        return "practitioner"

    # Default by era
    if year > 0 and year < 1958:
        return "pre-split"
    return "academic"


# ---------------------------------------------------------------------------
# Bibliography loader
# ---------------------------------------------------------------------------
def load_bibliography(path: str) -> list[dict]:
    """Load Omnibus_Book_Bibliography.xlsx into a list of dicts."""
    if not os.path.exists(path):
        print(f"  Warning: bibliography not found at {path}")
        return []

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    # Normalize headers
    headers = []
    for h in rows[0]:
        h_str = str(h).strip() if h else ""
        headers.append(h_str)

    entries = []
    for row in rows[1:]:
        entry = {}
        for i, val in enumerate(row):
            if i < len(headers):
                entry[headers[i]] = val
        # Only include entries we actually have
        have = str(entry.get("Have?", "")).strip().upper()
        entry["have"] = have == "YES"
        entries.append(entry)

    wb.close()
    return entries


# ---------------------------------------------------------------------------
# Content loaders
# ---------------------------------------------------------------------------
def load_yaml(path: str) -> dict | list:
    """Load a YAML file."""
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_all_notes() -> list[dict]:
    """Load and parse all research notes."""
    notes_dir = config.RESEARCH_NOTES_DIR
    note_files = glob.glob(os.path.join(notes_dir, "*.md"))

    notes = []
    for path in note_files:
        filename = os.path.basename(path)
        if filename in config.EXCLUDED_NOTES:
            continue
        note = parse_research_note(path)
        if note:
            notes.append(note)

    # Sort by year
    notes.sort(key=lambda n: (n["year"] if n["year"] > 0 else 9999, n["title"]))
    return notes


def get_era(year: int) -> dict:
    """Return the era definition for a given year."""
    if year < 1958:
        return config.ERAS[0]
    elif year <= 1963:
        return config.ERAS[1]
    else:
        return config.ERAS[2]


# ---------------------------------------------------------------------------
# Site builder
# ---------------------------------------------------------------------------
def build_site():
    """Build the entire static site."""
    print("Building The Two Paradigms of Finance...")

    # Clean build directory contents (don't remove root — Dropbox may lock it)
    if os.path.exists(config.BUILD_DIR):
        for item in os.listdir(config.BUILD_DIR):
            p = os.path.join(config.BUILD_DIR, item)
            try:
                if os.path.isdir(p):
                    shutil.rmtree(p)
                else:
                    os.remove(p)
            except PermissionError:
                pass  # skip locked files
    os.makedirs(config.BUILD_DIR, exist_ok=True)

    # Set up Jinja2
    env = Environment(
        loader=FileSystemLoader(config.TEMPLATES_DIR),
        autoescape=False,
    )

    # Common template context (root-level pages)
    common = {
        "site": config.SITE,
        "paradigms": config.PARADIGMS,
        "eras": config.ERAS,
        "root": "",  # relative path prefix to site root
    }
    # For pages one level deep (evidence/)
    common_deep = {**common, "root": "../"}

    # Load data
    print("  Loading research notes...")
    notes = load_all_notes()
    print(f"    {len(notes)} notes loaded")

    print("  Loading bibliography...")
    bibliography = load_bibliography(config.BIBLIOGRAPHY_PATH)
    print(f"    {len(bibliography)} entries loaded")

    print("  Loading content files...")
    landing_moments_path = os.path.join(config.CONTENT_DIR, "landing_moments.yaml")
    landing_moments = load_yaml(landing_moments_path) if os.path.exists(landing_moments_path) else []

    paradigm_table_path = os.path.join(config.CONTENT_DIR, "paradigm_table.yaml")
    paradigm_table = load_yaml(paradigm_table_path) if os.path.exists(paradigm_table_path) else []

    # Build a slug->note lookup
    notes_by_slug = {n["slug"]: n for n in notes}

    # Resolve landing moment links to actual notes
    for moment in landing_moments:
        if "note_slug" in moment and moment["note_slug"] in notes_by_slug:
            moment["note"] = notes_by_slug[moment["note_slug"]]

    # --------------- Render pages ---------------

    # 1. Landing page
    print("  Rendering index.html...")
    tpl = env.get_template("home.html")
    html = tpl.render(**common, moments=landing_moments, notes=notes)
    write_page("index.html", html)

    # 2. Evidence pages
    print("  Rendering evidence pages...")
    os.makedirs(os.path.join(config.BUILD_DIR, "evidence"), exist_ok=True)
    tpl = env.get_template("evidence.html")
    for i, note in enumerate(notes):
        prev_note = notes[i - 1] if i > 0 else None
        next_note = notes[i + 1] if i < len(notes) - 1 else None
        html = tpl.render(
            **common_deep,
            note=note,
            era=get_era(note["year"]),
            prev_note=prev_note,
            next_note=next_note,
        )
        write_page(f"evidence/{note['slug']}.html", html)
    print(f"    {len(notes)} evidence pages rendered")

    # 3. The Split
    print("  Rendering the-split.html...")
    tpl = env.get_template("the_split.html")
    # Gather the key transitional notes
    split_notes = [n for n in notes if 1951 <= n["year"] <= 1965]
    html = tpl.render(**common, split_notes=split_notes, notes_by_slug=notes_by_slug)
    write_page("the-split.html", html)

    # 4. Two Paradigms comparison
    print("  Rendering two-paradigms.html...")
    tpl = env.get_template("two_paradigms.html")
    html = tpl.render(**common, paradigm_table=paradigm_table, notes_by_slug=notes_by_slug)
    write_page("two-paradigms.html", html)

    # Prepare textbook bibliography entries (used by both timeline and library)
    EXCLUDE_PATH_PREFIXES = ("Historical Railways", "Bibliographies", "Academic articles")
    lib_entries = []
    for entry in bibliography:
        path = str(entry.get("Our Path(s)", "") or "")
        if path and any(path.startswith(pfx) for pfx in EXCLUDE_PATH_PREFIXES):
            continue
        lib_entries.append({
            "author": str(entry.get("Author", entry.get("Author(s)", "")) or ""),
            "title": str(entry.get("Title", "") or ""),
            "year": entry.get("Year", 0) or 0,
            "stream": str(entry.get("Stream", "") or ""),
            "topic": str(entry.get("Topic", "") or ""),
            "have": entry.get("have", False),
            "url": str(entry.get("Archive URL", "") or ""),
            "key_concepts": str(entry.get("Key Concepts", "") or ""),
            "our_filename": str(entry.get("Our Filename", "") or ""),
        })

    # 5. Timeline (all textbooks from bibliography + research-note highlights)
    print("  Rendering timeline.html...")
    tpl = env.get_template("timeline.html")

    # Build lookup of research notes by slug (only textbooks + MM papers)
    note_lookup = {}
    for n in notes:
        if n["slug"] in config.TIMELINE_NOTES:
            note_lookup[n["slug"]] = n

    # --- Load OCR-based paradigm scores from scores.csv ---
    # Scores computed by score_textbooks.py: (npv_hits - eps_hits) / (npv_hits + eps_hits)
    # Range: -1 (pure EPS/practitioner) to +1 (pure NPV/academic)
    # No artificial time-based scaling — the data speaks for itself.
    import csv as _csv
    scores_path = os.path.join(os.path.dirname(__file__), "scores.csv")
    ocr_scores = {}  # filename -> score (float)
    if os.path.exists(scores_path):
        with open(scores_path, encoding="utf-8") as sf:
            for row in _csv.DictReader(sf):
                try:
                    ocr_scores[row["filename"]] = float(row["score"])
                except (KeyError, ValueError):
                    pass
        print(f"    Loaded {len(ocr_scores)} OCR scores from scores.csv")
    else:
        print("    WARNING: scores.csv not found — all scores will be 0")

    # Start with ALL textbook bibliography entries
    STREAM_TO_PARADIGM = {
        "Academic": "academic",
        "Practitioner": "practitioner",
        "Both": "transitional",
    }
    timeline_data = []
    for entry in lib_entries:
        year = entry.get("year", 0) or 0
        try:
            year = int(year)
        except (ValueError, TypeError):
            continue
        if year <= 0:
            continue
        stream = str(entry.get("stream", "") or "")
        paradigm = STREAM_TO_PARADIGM.get(stream, "pre-split")
        if year < 1958:
            paradigm = "pre-split"
        elif 1958 <= year <= 1963:
            paradigm = "transitional"
        title = str(entry.get("title", "") or "")
        # Look up OCR score by filename; fall back to 0 (neutral)
        our_filename = str(entry.get("our_filename", "") or "")
        score = ocr_scores.get(our_filename, 0.0)
        timeline_data.append({
            "slug": "",
            "title": title,
            "author": str(entry.get("author", "") or ""),
            "year": year,
            "paradigm": paradigm,
            "score": round(score, 3),
            "key_finding": "",
            "has_note": False,
        })

    # Overlay research notes as highlighted entries
    for slug, n in note_lookup.items():
        best_idx = None
        for i, td in enumerate(timeline_data):
            if td["year"] == n["year"] and not td["has_note"]:
                note_surname = (n["author"] or "").split(",")[0].strip().lower()
                bib_surname = (td["author"] or "").split(",")[0].strip().lower()
                if note_surname and bib_surname and note_surname == bib_surname:
                    best_idx = i
                    break
        # For research notes, try to find OCR score by matching author+year
        # in the scores lookup (notes don't have filenames directly)
        note_score = 0.0
        if best_idx is not None:
            note_score = timeline_data[best_idx]["score"]
        note_entry = {
            "slug": n["slug"],
            "title": n["title"],
            "author": n["author"],
            "year": n["year"],
            "paradigm": n["paradigm"],
            "score": round(note_score, 3),
            "key_finding": n["key_finding"][:200] + ("..." if len(n["key_finding"]) > 200 else ""),
            "has_note": True,
        }
        if best_idx is not None:
            timeline_data[best_idx] = note_entry
        else:
            timeline_data.append(note_entry)

    timeline_data.sort(key=lambda d: d["year"])
    note_count = sum(1 for d in timeline_data if d["has_note"])
    print(f"    {len(timeline_data)} entries on timeline ({note_count} with research notes)")
    html = tpl.render(**common, timeline_data=timeline_data)
    write_page("timeline.html", html)

    # 6. Library (uses lib_entries prepared above)
    print("  Rendering library.html...")
    tpl = env.get_template("library.html")
    print(f"    {len(lib_entries)} textbook entries (of {len(bibliography)} total)")
    html = tpl.render(**common, library_json=json.dumps(lib_entries, default=str))
    write_page("library.html", html)

    # 7. About
    print("  Rendering about.html...")
    tpl = env.get_template("about.html")
    stats = {
        "total_entries": len(bibliography),
        "have_count": sum(1 for e in bibliography if e.get("have")),
        "note_count": len(notes),
        "year_range": f"{min(n['year'] for n in notes if n['year'] > 0)}–{max(n['year'] for n in notes)}",
    }
    html = tpl.render(**common, stats=stats)
    write_page("about.html", html)

    # Copy static assets
    print("  Copying static assets...")
    static_dest = os.path.join(config.BUILD_DIR, "static")
    if os.path.exists(config.STATIC_DIR):
        shutil.copytree(config.STATIC_DIR, static_dest, dirs_exist_ok=True)

    # Write timeline data as JSON for JS
    timeline_json_path = os.path.join(config.BUILD_DIR, "static", "js", "timeline_data.json")
    os.makedirs(os.path.dirname(timeline_json_path), exist_ok=True)
    with open(timeline_json_path, "w", encoding="utf-8") as f:
        json.dump(timeline_data, f, indent=2, default=str)

    print(f"\nBuild complete! Output in: {config.BUILD_DIR}")
    print(f"  Pages: {2 + len(notes) + 5} total")


def write_page(rel_path: str, html: str):
    """Write an HTML page to the build directory."""
    full_path = os.path.join(config.BUILD_DIR, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(html)


# ---------------------------------------------------------------------------
# Dev server
# ---------------------------------------------------------------------------
def serve():
    """Start a simple HTTP server for development."""
    import http.server
    import functools

    os.chdir(config.BUILD_DIR)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=config.BUILD_DIR)
    server = http.server.HTTPServer(("localhost", 8000), handler)
    print(f"\nServing at http://localhost:8000")
    print("Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    build_site()
    if "--serve" in sys.argv:
        serve()
