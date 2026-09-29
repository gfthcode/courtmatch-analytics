#!/usr/bin/env python3
"""Refresh the static NBA news feed from ESPN's public RSS feed."""

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import json
import os
from pathlib import Path
import re
from urllib.parse import urlsplit, urlunsplit
import urllib.request
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
OUTPUT_OVERRIDE = os.environ.get("COURTMATCH_NEWS_OUTPUT")
OUT = (ROOT / OUTPUT_OVERRIDE) if OUTPUT_OVERRIDE else ((PUBLIC_DIR / "data" / "news.json") if PUBLIC_DIR.is_dir() else (ROOT / "data" / "news.json"))
NEWS_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=50"
RSS_FEED = "https://www.espn.com/espn/rss/nba/news"
NS = {"dc": "http://purl.org/dc/elements/1.1/", "media": "http://search.yahoo.com/mrss/"}
MINIMUM_ARTICLES = 5


def clean_html(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def item_text(node: ET.Element, tag: str) -> str:
    child = node.find(tag)
    return (child.text or "").strip() if child is not None else ""


def fetch(url: str, accept: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; CourtMatchAnalytics/1.0; +https://gfthcode.github.io/courtmatch-analytics/)", "Accept": accept})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read()


def fetch_api_articles() -> list[dict]:
    payload = json.loads(fetch(NEWS_API, "application/json"))
    rows = payload.get("articles") or payload.get("headlines") or []
    articles = []
    for row in rows[:50]:
        links = row.get("links") or {}
        web = links.get("web") or {}
        url = web.get("href") or row.get("url") or row.get("link") or ""
        title = row.get("headline") or row.get("title") or ""
        if not title or not url.startswith("https://"):
            continue
        images = row.get("images") or []
        image = row.get("image") or (images[0].get("url", "") if images and isinstance(images[0], dict) else "")
        authors = row.get("authors") or []
        author = authors[0].get("name", "") if authors and isinstance(authors[0], dict) else row.get("byline", "")
        articles.append({"id": str(row.get("id") or url), "title": clean_html(title), "summary": clean_html(row.get("description") or row.get("summary") or ""), "url": url, "publishedAt": row.get("published") or row.get("publishedAt") or "", "image": image, "author": author, "categories": [item.get("description", "") for item in row.get("categories", []) if isinstance(item, dict)]})
    return articles


def fetch_rss_articles() -> list[dict]:
    root = ET.fromstring(fetch(RSS_FEED, "application/rss+xml, application/xml, text/xml"))
    channel = root.find("channel")
    if channel is None:
        return []
    articles = []
    for item in channel.findall("item")[:50]:
        title, url = item_text(item, "title"), item_text(item, "link")
        if not title or not url.startswith("https://"):
            continue
        raw_date = item_text(item, "pubDate")
        try:
            published = parsedate_to_datetime(raw_date).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            published = ""
        image_node = item.find("media:content", NS)
        image = image_node.attrib.get("url", "") if image_node is not None else ""
        creator = item.find("dc:creator", NS)
        articles.append({"id": item_text(item, "guid") or url, "title": clean_html(title), "summary": clean_html(item_text(item, "description")), "url": url, "publishedAt": published, "image": image, "author": (creator.text or "").strip() if creator is not None else "", "categories": [node.text.strip() for node in item.findall("category") if node.text and node.text.strip()]})
    return articles


def normalize_articles(articles: list[dict]) -> list[dict]:
    """Deduplicate stories and put valid publication dates in stable newest-first order."""
    by_url: dict[str, dict] = {}
    for article in articles:
        url = article.get("url", "").strip()
        if not url.startswith("https://"):
            continue
        parts = urlsplit(url)
        key = urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), parts.query, ""))
        if key in by_url:
            continue
        published = article.get("publishedAt", "")
        try:
            timestamp = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            timestamp = timestamp.astimezone(timezone.utc)
            article["publishedAt"] = timestamp.isoformat()
            article["_published_sort"] = timestamp.timestamp()
        except (AttributeError, TypeError, ValueError, OverflowError):
            article["publishedAt"] = ""
            article["_published_sort"] = float("-inf")
        by_url[key] = article
    normalized = sorted(by_url.values(), key=lambda item: item["_published_sort"], reverse=True)
    for article in normalized:
        article.pop("_published_sort", None)
    return normalized


def main() -> None:
    source = "ESPN NBA News API"
    try:
        articles = normalize_articles(fetch_api_articles())
        if len(articles) < MINIMUM_ARTICLES:
            raise RuntimeError(f"only {len(articles)} usable stories (minimum {MINIMUM_ARTICLES})")
    except Exception as error:
        print(f"ESPN news API unavailable ({error}); trying official RSS fallback")
        articles = []
    if not articles:
        source = "ESPN NBA RSS"
        try:
            articles = normalize_articles(fetch_rss_articles())
        except Exception as error:
            raise RuntimeError(f"ESPN API and RSS returned no usable stories; keeping previous snapshot ({error})") from error
    if len(articles) < MINIMUM_ARTICLES:
        raise RuntimeError(f"ESPN returned only {len(articles)} usable news stories; keeping previous snapshot (minimum {MINIMUM_ARTICLES})")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": source, "feedUrl": NEWS_API if source.endswith("API") else RSS_FEED, "updatedAt": datetime.now(timezone.utc).isoformat(), "articles": articles}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(articles)} articles to {OUT}")


if __name__ == "__main__":
    main()
