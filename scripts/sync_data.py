"""Fail-closed production entrypoint for CourtMatch NBA data.

Raw XLSX/Parquet stays under data/raw. The browser only reads public/data JSON.
Existing public data is never replaced until normalization and validation succeed.
"""
from __future__ import annotations

import os
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str], env: dict[str, str] | None = None) -> None:
    completed = subprocess.run(command, cwd=ROOT, env=env, text=True)
    if completed.returncode:
        raise RuntimeError(f"failed ({completed.returncode}): {' '.join(command)}")


def promote_validated_stage(stage: Path, published: Path) -> None:
    """Move a fully validated staged dataset into place, publishing its manifest last."""
    manifest = stage / "manifest.json"
    if not manifest.is_file():
        raise RuntimeError("validated data stage is missing manifest.json; existing published data was preserved")
    for source in sorted(path for path in stage.rglob("*") if path.is_file() and path != manifest):
        relative = source.relative_to(stage)
        destination = published / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        source.replace(destination)
    published.mkdir(parents=True, exist_ok=True)
    manifest.replace(published / "manifest.json")


def main() -> None:
    published_directory=Path(os.environ.get("COURTMATCH_PUBLISHED_DATA_DIR", ROOT / "public" / "data")).resolve()
    published_directory.mkdir(parents=True, exist_ok=True)
    identity_environment = os.environ.copy()
    identity_environment["COURTMATCH_CACHED_PLAYER_DIRECTORY"] = str(published_directory / "players.json")
    identity_environment["COURTMATCH_CACHED_PLAYER_REPORT"] = str(published_directory / "reports" / "player-directory-report.json")
    with tempfile.TemporaryDirectory(prefix=".courtmatch-publish-", dir=published_directory.parent) as temporary:
        stage=Path(temporary) / "data"
        stage.mkdir()
        (stage / "reports").mkdir()
        work_data=Path(temporary) / "work"
        work_data.mkdir()
        work_environment=identity_environment.copy()
        work_environment["COURTMATCH_DATA_WORK_DIR"] = str(work_data)
        previous_reports=published_directory / "reports"
        if previous_reports.is_dir():
            shutil.copytree(previous_reports, stage / "reports", dirs_exist_ok=True)

        run([sys.executable, "scripts/build_player_directory.py"], env=work_environment)
        candidate=work_data / "processed" / "players-candidate.json"
        if not candidate.exists():
            raise RuntimeError("candidate player directory was not generated. Existing public data was preserved.")
        work_environment["COURTMATCH_PLAYER_DIRECTORY"] = str(candidate)
        report=json.loads((work_data / "reports" / "player-directory-report.json").read_text(encoding="utf8"))
        directory_source_available = report.get("officialDirectoryAvailable") or report.get("cachedDirectoryUsed")
        if not directory_source_available or report.get("sourceBackedCount", 0) != report["candidateCount"] or report["conflictCount"]:
            raise RuntimeError("player directory contains unresolved identities; publication was blocked and public data was preserved.")
        run([sys.executable, "scripts/normalize-player-positions.py"], env=work_environment)
        for report_name in ("player-directory-report.json", "player-position-report.json", "unmapped_players.json"):
            report_source=work_data / "reports" / report_name
            if report_source.is_file():
                shutil.copy2(report_source, stage / "reports" / report_name)
        run([sys.executable, "scripts/import_nba_api_data.py"], env=work_environment)
        api_report=work_data / "reports" / "nba-api-data-report.json"
        if api_report.is_file():
            shutil.copy2(api_report, stage / "reports" / api_report.name)

        # Only a source-provided partialPossessions field is publishable. Never revive the
        # unsupported MATCHUP_MIN × 2.1 estimate.
        stage_environment = work_environment.copy()
        stage_environment["COURTMATCH_PUBLISHED_DATA_DIR"] = str(stage)
        stage_environment["COURTMATCH_PREVIOUS_PUBLISHED_DATA_DIR"] = str(published_directory)
        stage_environment["COURTMATCH_PLAYER_DIRECTORY"] = str(candidate)
        run([sys.executable, "scripts/normalize_github_data.py"], env=stage_environment)
        mapping_environment = stage_environment.copy()
        mapping_environment["COURTMATCH_ID_DATA_DIR"] = str(stage)
        mapping_environment["COURTMATCH_ID_MAPPINGS_DIR"] = str(stage / "mappings")
        run([sys.executable, "scripts/build_id_maps.py"], env=mapping_environment)
        run([sys.executable, "scripts/import_player_playtypes.py"], env=stage_environment)
        run([sys.executable, "scripts/import_team_playtypes.py"], env=stage_environment)
        node_binary=os.environ.get("COURTMATCH_NODE_BINARY") or shutil.which("node")
        if not node_binary:
            raise RuntimeError("Node.js was not found; staged data is not eligible for publication.")
        run([node_binary, "scripts/validate-data.mjs", str(stage)])
        promote_validated_stage(stage, published_directory)
    print(f"CourtMatch data sync completed; {published_directory} is a validated NBA dataset.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"CourtMatch data sync failed safely: {error}", file=sys.stderr)
        raise SystemExit(1)
