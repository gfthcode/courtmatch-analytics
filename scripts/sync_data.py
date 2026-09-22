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
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> None:
    completed = subprocess.run(command, cwd=ROOT, text=True)
    if completed.returncode:
        raise RuntimeError(f"failed ({completed.returncode}): {' '.join(command)}")


def main() -> None:
    published_directory=Path(os.environ.get("COURTMATCH_PUBLISHED_DATA_DIR", ROOT / "public" / "data"))
    for directory in (ROOT / "data" / "raw", ROOT / "data" / "processed", ROOT / "data" / "reports", published_directory):
        directory.mkdir(parents=True, exist_ok=True)
    run([sys.executable, "scripts/build_player_directory.py"])
    candidate=ROOT / "data" / "processed" / "players-candidate.json"
    if not candidate.exists():
        raise RuntimeError("candidate player directory was not generated. Existing public/data was preserved.")
    os.environ["COURTMATCH_PLAYER_DIRECTORY"] = str(candidate)
    report=json.loads((ROOT / "data" / "reports" / "player-directory-report.json").read_text(encoding="utf8"))
    if not report["officialDirectoryAvailable"] or report.get("sourceBackedCount", 0) != report["candidateCount"] or report["conflictCount"]:
        raise RuntimeError("player directory contains unresolved identities; Live Data was not enabled and public/data was preserved.")
    # Only a source-provided partialPossessions field is publishable. Never revive the
    # unsupported MATCHUP_MIN × 2.1 estimate.
    run([sys.executable, "scripts/normalize_github_data.py"])
    node_binary=os.environ.get("COURTMATCH_NODE_BINARY") or shutil.which("node")
    if not node_binary:
        raise RuntimeError("Node.js was not found; public/data was generated but is not eligible for deployment.")
    run([node_binary, "scripts/validate-data.mjs", str(published_directory)])
    print(f"CourtMatch data sync completed; {published_directory} is a validated NBA dataset.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"CourtMatch data sync failed safely: {error}", file=sys.stderr)
        raise SystemExit(1)
