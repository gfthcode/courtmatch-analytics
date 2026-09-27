"""Attach truthful refresh mode and source-quality diagnostics to the staged manifest."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def age_days(value: object, now: datetime) -> int | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return max(0, (now - parsed.astimezone(timezone.utc)).days)


def main() -> None:
    data_dir = Path(os.environ.get("COURTMATCH_PUBLISHED_DATA_DIR", "data"))
    manifest_path = data_dir / "manifest.json"
    manifest = read_json(manifest_path)
    if not manifest:
        raise SystemExit("Cannot write data quality metadata without a valid staged manifest")
    api = read_json(data_dir / "reports/nba-api-data-report.json")
    directory = read_json(data_dir / "reports/player-directory-report.json")
    now = datetime.now(timezone.utc)
    reasons: list[str] = []

    refresh_mode = api.get("refreshMode", "unknown")
    manifest["refreshMode"] = refresh_mode
    manifest["dataQualityCheckedAt"] = now.isoformat()
    manifest["positionMappingRate"] = directory.get(
        "positionMappingRate", manifest.get("positionMappingRate", 0)
    )
    manifest["positionUnknownCount"] = directory.get("positionUnknownCount", 0)
    manifest["nbaStatsDataThrough"] = api.get("lastGameDate")
    game_date = api.get("lastGameDate")
    if isinstance(game_date, str):
        try:
            game_age = max(0, (now.date() - datetime.fromisoformat(game_date).date()).days)
            manifest["nbaStatsDataAgeDays"] = game_age
            if game_age > 7:
                reasons.append(f"NBA 球员比赛日志截止 {game_date}，已 {game_age} 天无更新")
        except ValueError:
            reasons.append("NBA 球员比赛日志缺少有效的最后比赛日期")
    else:
        manifest["nbaStatsDataAgeDays"] = None
        reasons.append("NBA 球员比赛日志缺少有效的最后比赛日期")

    if refresh_mode != "live":
        reasons.append("NBA Stats 使用已验证缓存，未能确认本轮上游实时刷新")
    if not directory.get("officialDirectoryAvailable"):
        reasons.append("球员目录使用已验证缓存")
    rate = manifest.get("positionMappingRate", 0)
    if isinstance(rate, (int, float)) and rate < 100:
        reasons.append(f"位置映射覆盖率 {rate:.1f}%，未知位置未推测填充")

    freshness = {
        "球员统计与比赛日志": (manifest.get("playerStatsSourceUpdatedAt"), 14),
        "球员打法快照": (manifest.get("playerPlaytypesSourceUpdatedAt"), 30),
        "球队打法快照": (manifest.get("teamPlaytypesSourceUpdatedAt"), 30),
        "球队统计快照": (manifest.get("teamStatsSourceUpdatedAt"), 30),
    }
    source_ages: dict[str, int | None] = {}
    for label, (timestamp, limit) in freshness.items():
        age = age_days(timestamp, now)
        source_ages[label] = age
        if age is None:
            reasons.append(f"{label}缺少可验证的源更新时间")
        elif age > limit:
            reasons.append(f"{label}源快照已 {age} 天，超过 {limit} 天新鲜度阈值")

    manifest["sourceAgeDays"] = source_ages
    manifest["staleReasons"] = reasons
    manifest["status"] = "stale" if reasons else "live"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
    print(json.dumps({"status": manifest["status"], "refreshMode": refresh_mode, "positionMappingRate": rate, "staleReasons": reasons}, ensure_ascii=False))


if __name__ == "__main__":
    main()
