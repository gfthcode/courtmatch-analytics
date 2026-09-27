#!/usr/bin/env python3
"""Refresh the static NBA news feed from ESPN's public RSS feed."""

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
OUT = (PUBLIC_DIR / "data" / "news.json") if PUBLIC_DIR.is_dir() else (ROOT / "data" / "news.json")
FEED = "https://www.espn.com/espn/rss/nba/news"
NS = {"dc": "http://purl.org/dc/elements/1.1/", "media": "http://search.yahoo.com/mrss/"}


def clean_html(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def item_text(node: ET.Element, tag: str) -> str:
    child = node.find(tag)
    return (child.text or "").strip() if child is not None else ""


def main() -> None:
    request = urllib.request.Request(FEED, headers={"User-Agent": "CourtMatch-Analytics/1.0 (+https://gfthcode.github.io/courtmatch-analytics/)"})
    with urllib.request.urlopen(request, timeout=20) as response:
        root = ET.fromstring(response.read())

    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("ESPN feed response did not contain an RSS channel")

    articles = []
    for item in channel.findall("item")[:50]:
        title = item_text(item, "title")
        url = item_text(item, "link")
        if not title or not url.startswith("https://"):
            continue
        raw_date = item_text(item, "pubDate")
        try:
            published = parsedate_to_datetime(raw_date).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            published = ""
        image_node = item.find("media:content", NS)
        image = image_node.attrib.get("url", "") if image_node is not None else ""
        categories = [node.text.strip() for node in item.findall("category") if node.text and node.text.strip()]
        author = item.find("dc:creator", NS)
        articles.append({
            "id": item_text(item, "guid") or url,
            "title": clean_html(title),
            "summary": clean_html(item_text(item, "description")),
            "url": url,
            "publishedAt": published,
            "image": image,
            "author": (author.text or "").strip() if author is not None else "",
            "categories": categories,
        })

    if not articles:
        raise RuntimeError("ESPN feed returned no valid articles; keeping previous snapshot")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": "ESPN NBA RSS", "feedUrl": FEED, "updatedAt": datetime.now(timezone.utc).isoformat(), "articles": articles}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(articles)} articles to {OUT}")


if __name__ == "__main__":
    main()
