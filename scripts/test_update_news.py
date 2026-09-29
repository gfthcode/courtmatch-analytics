"""Quality checks for the published NBA news snapshot."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("update-news.py")
SPEC = importlib.util.spec_from_file_location("update_news", MODULE_PATH)
assert SPEC and SPEC.loader
update_news = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(update_news)


class NewsSnapshotTests(unittest.TestCase):
    def test_normalizes_dates_deduplicates_and_sorts_newest_first(self) -> None:
        stories = [
            {"url": "https://ESPN.com/nba/story/older/", "publishedAt": "2026-09-27T10:00:00-04:00", "title": "Older"},
            {"url": "https://espn.com/nba/story/newest#share", "publishedAt": "2026-09-29T12:00:00Z", "title": "Newest"},
            {"url": "https://espn.com/nba/story/older", "publishedAt": "2026-09-28T00:00:00Z", "title": "Duplicate"},
            {"url": "https://espn.com/nba/story/undated", "publishedAt": "not-a-date", "title": "Undated"},
            {"url": "http://espn.com/nba/story/insecure", "publishedAt": "2026-09-30T00:00:00Z", "title": "Insecure"},
        ]

        result = update_news.normalize_articles(stories)

        self.assertEqual([story["title"] for story in result], ["Newest", "Older", "Undated"])
        self.assertEqual(result[1]["publishedAt"], "2026-09-27T14:00:00+00:00")
        self.assertEqual(result[-1]["publishedAt"], "")
        self.assertTrue(all("_published_sort" not in story for story in result))

    def test_requires_a_minimum_snapshot_size(self) -> None:
        self.assertEqual(update_news.MINIMUM_ARTICLES, 5)


if __name__ == "__main__":
    unittest.main()
