# @mch/site-audit — site-wide health crawler (L3)

Read-only HTTP crawler that walks the sitemap of a base URL (prod by default,
or a Vercel preview) and audits **every published page** for health and
coherence. It is the **L3** layer of the QA pyramid — exhaustive page checks
between functional E2E (L2) and visual/perf (L4/L5).

No database, no credentials. Just HTTP.

## Quickstart

> The script is **`crawl`**, not `audit` (`pnpm audit` is a pnpm built-in).

```bash
# Fast budget pass over a random 200 URLs (status + h1 + SEO only):
pnpm --filter @mch/site-audit crawl -- --budget-only --sample=200

# Full audit (links + images live) of a 50-URL sample:
pnpm --filter @mch/site-audit crawl -- --sample=50

# A whole sitemap group, capped:
pnpm --filter @mch/site-audit crawl -- --only=hotels,rankings --limit=300

# Explicit URLs, report-only:
pnpm --filter @mch/site-audit crawl -- --urls=/,/hotel/le-meurice --fail-on=none

# Against a preview deploy:
pnpm --filter @mch/site-audit crawl -- --base=https://<preview>.vercel.app --sample=80
```

## Flags

| Flag                         | Default                                                  | Meaning                                                                             |
| ---------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `--base=URL`                 | `$NEXT_PUBLIC_SITE_URL` → `https://myconciergehotel.com` | site to audit                                                                       |
| `--only=g1,g2`               | all                                                      | restrict to sitemap groups (`hotels,rooms,hubs,guides,rankings,itineraries,places`) |
| `--limit=N`                  | —                                                        | cap URLs kept per group                                                             |
| `--sample=N`                 | —                                                        | random sample of N across all groups                                                |
| `--max-urls=N`               | —                                                        | hard cap after sampling                                                             |
| `--urls=a,b`                 | —                                                        | explicit URL list (bypass the sitemap)                                              |
| `--budget-only`              | off                                                      | skip link/image probing (status + h1 + SEO + JSON-LD only)                          |
| `--no-links` / `--no-images` | both on                                                  | toggle the network probes                                                           |
| `--concurrency=N`            | 8                                                        | page-fetch workers                                                                  |
| `--fail-on=fail\|warn\|none` | `fail`                                                   | exit-code threshold                                                                 |

## Checks

See `.cursor/skills/site-audit-crawler/SKILL.md` for the full table, the
extension points, and the three false-positive traps that were fixed on the
first prod run (HTML entity decoding, bounded probe concurrency, page-scoped
leak detection).

## Output

`scripts/site-audit/runs/site-audit-<timestamp>.{json,html}` (git-ignored).
The process exits `1` when findings reach `--fail-on`, so CI / cron can stop.

## Tests

```bash
pnpm --filter @mch/site-audit test:unit   # 56 unit cases on the pure modules
pnpm --filter @mch/site-audit typecheck
```
