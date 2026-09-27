"""Tests for fail-closed NBA API snapshot fallback."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import import_nba_api_data as importer


class CachedSnapshotTests(unittest.TestCase):
    def write_snapshot(self, directory: Path, *, player_id: str = 'p1', season: str = '2025-26') -> None:
        (directory / 'player-stats.json').write_text(json.dumps([
            {'playerId': player_id, 'season': season, 'seasonType': 'regular', 'updatedAt': '2026-09-27T00:00:00Z'}
        ]), encoding='utf8')
        (directory / 'daily.json').write_text(json.dumps([
            {'id': 'g1-p1', 'playerId': player_id, 'season': season, 'date': '2026-06-13'}
        ]), encoding='utf8')

    def test_accepts_complete_same_season_verified_id_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.write_snapshot(Path(directory))
            with patch.dict(os.environ, {'COURTMATCH_PREVIOUS_PUBLISHED_DATA_DIR': directory}):
                stats, logs = importer.load_cached_snapshot({'p1'})
        self.assertEqual((len(stats), len(logs)), (1, 1))

    def test_rejects_snapshot_for_an_unverified_or_other_season_player(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.write_snapshot(Path(directory), player_id='other')
            with patch.dict(os.environ, {'COURTMATCH_PREVIOUS_PUBLISHED_DATA_DIR': directory}):
                with self.assertRaisesRegex(RuntimeError, 'do not match'):
                    importer.load_cached_snapshot({'p1'})

    def test_rejects_incomplete_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / 'player-stats.json').write_text('[]', encoding='utf8')
            (Path(directory) / 'daily.json').write_text('[]', encoding='utf8')
            with patch.dict(os.environ, {'COURTMATCH_PREVIOUS_PUBLISHED_DATA_DIR': directory}):
                with self.assertRaisesRegex(RuntimeError, 'incomplete'):
                    importer.load_cached_snapshot({'p1'})


if __name__ == '__main__':
    unittest.main()
