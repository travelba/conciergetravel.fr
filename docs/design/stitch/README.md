# Stitch design snapshot

Mirror of the active Google Stitch project, pulled by
[`@mch/design-import`](../../../scripts/design-import/README.md).

## Layout

| Path                   | Content                                        | Tracked in git?                             |
| ---------------------- | ---------------------------------------------- | ------------------------------------------- |
| `manifest.json`        | Project ID, screen IDs, pull timestamp         | ✅ Yes                                      |
| `MAPPING.md`           | Stitch screen ↔ Next.js route mapping (manual) | ✅ Yes                                      |
| `screens/<id>.html`    | Raw HTML downloaded from Stitch                | ❌ Ignored by default — too noisy for diffs |
| `screenshots/<id>.png` | PNG screenshot of each screen                  | ❌ Ignored by default — large binaries      |

Force-add a specific screen with `git add -f screens/<id>.html` when you need
to anchor a design decision in a code review.

## Refreshing the snapshot

```powershell
$env:STITCH_API_KEY = "<your-key>"
pnpm --filter @mch/design-import pull
```

Run after **every** meaningful Stitch update. Idempotent.

## The mapping doc

`MAPPING.md` is the single source of truth for "which Stitch screen drives
which Next.js route". Update it as part of any redesign PR. The file is
intentionally hand-curated — Stitch IDs are opaque, only a human can decide
which one of three "homepage variants" the team committed to.
