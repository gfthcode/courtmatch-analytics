import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPT = Path(__file__).with_name("finalize_data_quality.py")


class FinalizeDataQualityTests(unittest.TestCase):
    def run_finalizer(self, refresh_mode: str, directory_live: bool, position_rate: float = 100, team_playtype_age: int = 45):
        now = datetime.now(timezone.utc)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            reports = root / "reports"
            reports.mkdir()
            old = (now - timedelta(days=team_playtype_age)).isoformat()
            fresh = (now - timedelta(days=1)).isoformat()
            manifest = {
                "status": "stale", "lastUpdated": now.isoformat(),
                "playerStatsSourceUpdatedAt": fresh,
                "playerPlaytypesSourceUpdatedAt": fresh,
                "teamPlaytypesSourceUpdatedAt": old,
                "teamStatsSourceUpdatedAt": fresh,
            }
            (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf8")
            (reports / "nba-api-data-report.json").write_text(json.dumps({"refreshMode": refresh_mode, "lastGameDate": now.date().isoformat()}), encoding="utf8")
            (reports / "player-directory-report.json").write_text(json.dumps({
                "officialDirectoryAvailable": directory_live,
                "positionMappingRate": position_rate,
                "positionUnknownCount": 500 - int(position_rate * 5),
            }), encoding="utf8")
            environment = os.environ.copy()
            environment["COURTMATCH_PUBLISHED_DATA_DIR"] = str(root)
            subprocess.run([sys.executable, str(SCRIPT)], check=True, env=environment, capture_output=True, text=True)
            return json.loads((root / "manifest.json").read_text(encoding="utf8"))

    def test_cache_fallback_and_old_snapshot_are_reported_without_hiding_them(self):
        manifest = self.run_finalizer("verified-cache", False, 95)
        self.assertEqual(manifest["status"], "stale")
        self.assertEqual(manifest["refreshMode"], "verified-cache")
        self.assertEqual(manifest["positionMappingRate"], 95)
        self.assertTrue(any("球队打法快照" in reason for reason in manifest["staleReasons"]))
        self.assertEqual(manifest["sourceAgeDays"]["球队打法快照"], 45)

    def test_fresh_live_sources_are_marked_live(self):
        manifest = self.run_finalizer("live", True, 100, 1)
        self.assertEqual(manifest["status"], "live")
        self.assertEqual(manifest["staleReasons"], [])


if __name__ == "__main__":
    unittest.main()
