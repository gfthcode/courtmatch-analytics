# CourtMatch Analytics

NBA-only direct-matchup exploration published as a GitHub Pages static site.

## Current data state

The public catalogue is served from `data/manifest.json`. The current manifest is
**quality-gated / stale**, not a production Live release: the published files contain
unresolved player-ID and position mapping gaps. The UI therefore surfaces
**STALE DATA / 数据质量警告** and must not claim that the catalogue is a verified
NBA Tracking feed.

A manifest with `status: "demo"` uses the deterministic built-in demo dataset.
A manifest with `status: "stale"` keeps the published JSON available for inspection,
but it is not presented as Live data. Only `status: "live"` may receive the Live
label, and only after the validation gates below pass.

## Data release policy

- `data/manifest.json` is the only browser-visible catalogue entry point.
- A Live release requires verified NBA player IDs, complete joined player/team/matchup
  files, matching manifest counts, and at least 500 joined matchup records.
- `node scripts/validate-data.mjs data` fails closed before a Live release can be committed.
- Scheduled Actions only validate the public state. A maintainer must explicitly
  select **publish_live** in the manual workflow before an upstream fetch is attempted.
- Failed source fetches or incomplete ID mappings preserve the existing public
  catalogue and cannot silently turn stale or demo data into Live data.

## Reference ingestion project

The upstream reference repository contains the NBA API / pbpstats ingestion scripts
used as a schema and pipeline reference. It is not treated as an automatic production
source for this public Pages build; data is promoted only after the local validation
gates pass.

## Verification

```bash
python3 scripts/build_id_maps.py
node scripts/validate-data.mjs data
python3 scripts/validate_pages.py
```

The same checks run on pull requests, relevant pushes, and the daily scheduled
validation workflow.
