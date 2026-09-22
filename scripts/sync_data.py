"""Fail-closed production entrypoint for CourtMatch NBA data.

Raw XLSX/Parquet stays under data/raw. The browser only reads public/data JSON.
Existing public data is never replaced until normalization and validation succeed.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> None:
    completed = subprocess.run(command, cwd=ROOT, text=True)
    if completed.returncode:
        raise RuntimeError(f"failed ({completed.returncode}): {' '.join(command)}")


def main() -> None:
    for directory in (ROOT / "data" / "raw", ROOT / "data" / "processed", ROOT / "data" / "reports", ROOT / "public" / "data"):
        directory.mkdir(parents=True, exist_ok=True)
    if not os.environ.get("COURTMATCH_PLAYER_DIRECTORY"):
        raise RuntimeError("COURTMATCH_PLAYER_DIRECTORY is required. Existing public/data was preserved.")
    # Only a source-provided partialPossessions field is publishable. Never revive the
    # unsupported MATCHUP_MIN × 2.1 estimate.
    run([sys.executable, "scripts/normalize_github_data.py"])
    run(["node", "scripts/validate-data.mjs"])
    print("CourtMatch data sync completed; public/data is a validated NBA dataset.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"CourtMatch data sync failed safely: {error}", file=sys.stderr)
        raise SystemExit(1)
