"""Regression tests for official team-ID crosswalk generation."""
from __future__ import annotations

import unittest

from build_id_maps import build_team_id_map


class TeamIdMapTests(unittest.TestCase):
    def test_maps_every_canonical_nba_team_id_to_itself(self) -> None:
        teams = [
            {"id": "1610612745", "abbreviation": "HOU"},
            {"id": "1610612753", "abbreviation": "ORL"},
        ]
        self.assertEqual(
            build_team_id_map(teams),
            {"1610612745": "1610612745", "1610612753": "1610612753"},
        )

    def test_rejects_duplicate_or_non_numeric_team_ids(self) -> None:
        with self.assertRaisesRegex(ValueError, "Duplicate official NBA team ID"):
            build_team_id_map([
                {"id": "1610612745", "abbreviation": "HOU"},
                {"id": "1610612745", "abbreviation": "ORL"},
            ])
        with self.assertRaisesRegex(ValueError, "numeric official NBA ID"):
            build_team_id_map([{"id": "HOU", "abbreviation": "HOU"}])

    def test_rejects_duplicate_team_abbreviations(self) -> None:
        with self.assertRaisesRegex(ValueError, "unique abbreviation"):
            build_team_id_map([
                {"id": "1610612745", "abbreviation": "HOU"},
                {"id": "1610612753", "abbreviation": "HOU"},
            ])


if __name__ == "__main__":
    unittest.main()
