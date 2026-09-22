#!/usr/bin/env python3
"""Check the committed GitHub Pages shell without requiring the removed build toolchain."""
from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("", "matchups", "comparison", "rankings", "playtypes", "methodology", "sources", "settings")


def fail(message: str) -> None:
    print(f"CourtMatch Pages validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    root_html = ROOT / "index.html"
    html = root_html.read_text(encoding="utf8")
    if "明确标记的演示数据" not in html:
        fail("root metadata must disclose the demo state")
    script = re.search(r'<script type="module" crossorigin src="([^"]+)"></script>', html)
    stylesheet = re.search(r'<link rel="stylesheet" crossorigin href="([^"]+)">', html)
    if not script or not stylesheet:
        fail("root HTML must reference a module script and stylesheet")
    for resource in (script.group(1), stylesheet.group(1)):
        relative = resource.removeprefix("/courtmatch-analytics/")
        if not (ROOT / relative).is_file():
            fail(f"published asset is missing: {relative}")
    for route in ROUTES:
        page = root_html if not route else ROOT / route / "index.html"
        if not page.is_file():
            fail(f"direct-entry page is missing: {page.relative_to(ROOT)}")
        content = page.read_text(encoding="utf8")
        if "canonical" not in content or "__route" not in content:
            fail(f"direct-entry route lacks canonical or recovery handling: {page.relative_to(ROOT)}")
    if not (ROOT / "404.html").is_file() or not (ROOT / ".nojekyll").is_file():
        fail("GitHub Pages fallback files are missing")
    print("Validated GitHub Pages shell, direct-entry routes and demo disclosure")


if __name__ == "__main__":
    main()
