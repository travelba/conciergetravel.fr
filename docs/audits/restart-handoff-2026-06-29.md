# Restart handoff — 2026-06-29 05:37

Computer restart mid-session. Everything below captures state so work resumes cleanly.

## Git state at restart

- **Nothing unpushed** — `origin/main..HEAD` empty. All work is on `origin/main`.
- HEAD: `5798a8c6` (anti-cannibalization pin fix).
- Working tree had 4 uncommitted files (survive restart on disk), all owned by the
  still-running photo worker — leave for review then commit after restart:
  - `.cursor/skills/photo-pipeline/SKILL.md`
  - `scripts/editorial-pilot/src/photos/gen-places-discovery.ts`
  - `scripts/editorial-pilot/src/photos/run-zero-photo-backfill.ts`
  - `scripts/editorial-pilot/src/photos/upload-press-kit-images.ts`

## Post-audit execution wave — 6/7 chantiers DONE & deployed

| #   | Chantier                                                                                               | Status       | Commit(s)              |
| --- | ------------------------------------------------------------------------------------------------------ | ------------ | ---------------------- |
| W1  | Funnel concierge + anomalies (/fr non-issue, count→2 984, CTA+nav+phone optional)                      | ✅ live      | `be4b800f`, `14e84907` |
| W2  | Perf (hero preload 5→1; cache migration deferred → ADR-0031, PO arbitrage)                             | ✅ live      | `1e80f711`             |
| W3  | Avis Google AggregateRating sync 8 → 2172 fiches (15 no-data)                                          | ✅ live (DB) | `634bd82e`             |
| W4  | EEAT cohorte juin: external_sources 503→150, geo_qa 489→139                                            | ✅ live (DB) | DB-only                |
| W6  | Maillage: 45 geo-head rankings (zero-ranking 999→826), anti-cannibal 25 villes, mesh hôtel↔lieu 73→307 | ✅ live      | `96c35470`, `5798a8c6` |
| W7  | Guides pays: dedup 13 stubs + parité EN 100 %                                                          | ✅ live      | `66335c92`, `88006536` |

## ONLY remaining chantier — W5 Photos (resume this)

Goal: raise sub-10-photo fiches to ≥10. Last known floor **765 → 663** (~04:50).
DB-only writes (Cloudinary refs), idempotent + resumable (re-selects fiches still <10).

**Resume command (3-worker fleet, run each in its own terminal):**

```powershell
cd scripts/editorial-pilot
npx tsx src/photos/run-zero-photo-backfill.ts --worker=0 --workers=3 --min-gallery=1 --max-gallery=10
npx tsx src/photos/run-zero-photo-backfill.ts --worker=1 --workers=3 --min-gallery=1 --max-gallery=10
npx tsx src/photos/run-zero-photo-backfill.ts --worker=2 --workers=3 --min-gallery=1 --max-gallery=10
```

Residual structural floor = ~22 zero-Places fiches (pre-opening / R&C lodges / obscure
independents) — need Tavily/official-site/manual sourcing, defer.

## Pending PO decisions (not automatable here)

- **ADR-0031** — flip editorial routes to CDN cache (nonce→hash / ISR). Biggest speed lever,
  gated behind ADR-0027 PO + security β-gate.
- **Authority/GSC pack** — submit sitemaps (hotels 2984 + rankings) to Search Console + backlinks.
  The real gap vs yonder.fr.

## Supabase MCP fix (diagnosed this session)

Both MCP Supabase servers fail: project server (`fsmfozxgujskluxakeoq`) has empty
`SUPABASE_ACCESS_TOKEN`; user-level server points to the wrong project
(`snrgmuvoxhqbnusbakkv`). Fix: create a PAT at supabase.com/dashboard/account/tokens,
then `[Environment]::SetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','sbp_…','User')` and
fully restart Cursor. Also: `~/.cursor/mcp.json` stores plaintext secrets (Mapbox `sk.`,
DataForSEO pwd, Brevo, Stitch, Perplexity) — switch to `${VAR}` + rotate.
