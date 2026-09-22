# CourtMatch Analytics

NBA-only direct-matchup exploration published as a GitHub Pages static site.

## Current data state

The public catalogue is deliberately in **Demo** mode. It is a product demonstration
surface, not an NBA Tracking feed, and it must never be represented as Live data.
The client falls back to its clearly labelled deterministic demo dataset whenever
`data/manifest.json` is `"status": "demo"`.

## Data release policy

- `data/manifest.json` is the only browser-visible catalogue entry point.
- A Live release requires verified NBA player IDs, complete joined player/team/matchup
  files, matching manifest counts, and at least 500 joined matchup records.
- `node scripts/validate-data.mjs data` fails closed before a Live release can be committed.
- Scheduled Actions only validate the public state. A maintainer must explicitly
  select **publish_live** in the manual workflow before an upstream fetch is attempted.
- Failed source fetches or incomplete ID mappings preserve the existing public
  catalogue and cannot silently turn Demo data into Live data.

## Verification

```bash
python3 scripts/build_id_maps.py
node scripts/validate-data.mjs data
python3 scripts/validate_pages.py
```

The same checks run on pull requests, relevant pushes, and the daily scheduled
validation workflow.
