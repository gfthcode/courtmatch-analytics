"""Publication tests for fail-closed staged data sync."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sync_data import promote_validated_stage


class StagedPromotionTests(unittest.TestCase):
    def test_missing_stage_manifest_keeps_published_data_untouched(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            published = root / "data"
            stage = root / "stage"
            published.mkdir()
            stage.mkdir()
            (published / "players.json").write_text("old players", encoding="utf8")
            (published / "manifest.json").write_text("old manifest", encoding="utf8")
            (stage / "players.json").write_text("candidate players", encoding="utf8")

            with self.assertRaisesRegex(RuntimeError, "missing manifest.json"):
                promote_validated_stage(stage, published)

            self.assertEqual((published / "players.json").read_text(encoding="utf8"), "old players")
            self.assertEqual((published / "manifest.json").read_text(encoding="utf8"), "old manifest")

    def test_promotes_a_fully_validated_dataset_and_its_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            published = root / "data"
            stage = root / "stage"
            (published / "mappings").mkdir(parents=True)
            (stage / "mappings").mkdir(parents=True)
            (stage / "players.json").write_text("new players", encoding="utf8")
            (stage / "mappings" / "player-id-map.json").write_text("new mappings", encoding="utf8")
            (stage / "manifest.json").write_text("new manifest", encoding="utf8")

            moved = []
            original_replace = Path.replace

            def record_replace(source: Path, target: Path) -> Path:
                moved.append(source.relative_to(stage).as_posix())
                return original_replace(source, target)

            with patch.object(Path, "replace", record_replace):
                promote_validated_stage(stage, published)

            self.assertEqual((published / "players.json").read_text(encoding="utf8"), "new players")
            self.assertEqual((published / "mappings" / "player-id-map.json").read_text(encoding="utf8"), "new mappings")
            self.assertEqual((published / "manifest.json").read_text(encoding="utf8"), "new manifest")
            self.assertEqual(moved[-1], "manifest.json")


if __name__ == "__main__":
    unittest.main()
