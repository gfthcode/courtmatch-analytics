"""Regression tests for the external CourtMatch catalogue gate."""
from __future__ import annotations

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import normalize_github_data as pipeline


class CatalogueGateTests(unittest.TestCase):
    def test_stage_validator_receives_the_complete_candidate_directory(self) -> None:
        stage = Path("/tmp/courtmatch-candidate")
        with patch.object(pipeline.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="ok", stderr="")) as run:
            pipeline.validate_catalogue_stage(stage)
        run.assert_called_once_with(
            ["node", "scripts/validate-data.mjs", str(stage)],
            cwd=pipeline.ROOT,
            text=True,
            capture_output=True,
        )

    def test_invalid_stage_stops_before_any_public_move_can_begin(self) -> None:
        with patch.object(pipeline.subprocess, "run", return_value=SimpleNamespace(returncode=1, stdout="", stderr="bad foreign key")):
            with self.assertRaisesRegex(RuntimeError, "staged NBA catalogue failed validation: bad foreign key"):
                pipeline.validate_catalogue_stage(Path("/tmp/courtmatch-candidate"))
