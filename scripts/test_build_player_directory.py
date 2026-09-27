"""Safety tests for the verified last-known-good identity cache."""
from __future__ import annotations

import unittest

from build_player_directory import validate_cached_directory, verify_identity


def player(player_id: str = "2544") -> dict:
    return {
        "id": player_id,
        "name": "LeBron James",
        "verified": True,
        "verification": "nba-stats-api-id",
    }


def report(count: int = 1) -> dict:
    return {
        "officialDirectoryAvailable": True,
        "candidateCount": count,
        "sourceBackedCount": count,
        "unverifiedCount": 0,
        "conflictCount": 0,
        "generatedAt": "2026-09-27T06:44:21+00:00",
    }


class VerifiedDirectoryCacheTests(unittest.TestCase):
    def test_accepts_only_a_fully_verified_previous_nba_directory(self) -> None:
        rows = [player()]
        self.assertEqual(validate_cached_directory(rows, report()), {"2544": rows[0]})

    def test_rejects_a_report_without_live_nba_verification_provenance(self) -> None:
        invalid_report = report()
        invalid_report["officialDirectoryAvailable"] = False
        with self.assertRaisesRegex(ValueError, "no successful NBA Stats verification"):
            validate_cached_directory([player()], invalid_report)

    def test_rejects_incomplete_or_conflicted_cache_reports(self) -> None:
        invalid_report = report()
        invalid_report["conflictCount"] = 1
        with self.assertRaisesRegex(ValueError, "incomplete or contains unresolved"):
            validate_cached_directory([player()], invalid_report)

    def test_rejects_cache_reports_without_a_recent_verification_timestamp(self) -> None:
        invalid_report = report()
        invalid_report["generatedAt"] = "2020-01-01T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "outside the allowed 365-day window"):
            validate_cached_directory([player()], invalid_report)

    def test_rejects_unverified_or_duplicate_player_ids(self) -> None:
        unverified = player()
        unverified["verification"] = "reference-name-only"
        with self.assertRaisesRegex(ValueError, "unverified or duplicate"):
            validate_cached_directory([unverified], report())
        with self.assertRaisesRegex(ValueError, "unverified or duplicate"):
            validate_cached_directory([player(), player()], report(2))

    def test_cache_fallback_still_requires_exact_id_and_normalized_name(self) -> None:
        directory = {"2544": player()}
        resolved, error = verify_identity("2544", "LeBron James", directory)
        self.assertEqual(resolved, directory["2544"])
        self.assertIsNone(error)
        self.assertEqual(verify_identity("9999", "LeBron James", directory), (None, "official-id-not-found"))
        self.assertEqual(verify_identity("2544", "Different Player", directory), (None, "official-name-mismatch"))


if __name__ == "__main__":
    unittest.main()
