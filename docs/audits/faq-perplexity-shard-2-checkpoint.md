# FAQ Perplexity kit — Shard 2/4 checkpoint

> Worker dédié à la partition **shard 2** (`globalIndex % 4 == 2` sur les fiches
> publiées triées par slug ASC). Fichier **détenu par le shard 2 uniquement** —
> évite les conflits de rebase sur le doc de backfill partagé pendant que les 4
> workers tournent en parallèle sur `main`.

## État (grounded run) — ✅ PARTITION TERMINÉE

- **shard2 : 746 / 746** fiches dotées du kit FAQ Perplexity (0 restante).
- Segments `netnew` → `heads` → `rest` tous **EXHAUSTED** proprement
  (le segment `rest` a rattrapé les échecs de gate des vagues précédentes,
  idempotent).
- Pipeline : **grounded DataForSEO** (commit `77d33bce`) — `grounding=on`,
  couverture PAA moyenne ~51-60 % par vague.
- 21 vagues groundées · coût cumulé **Perplexity ≈ $87.40 + EN ≈ $2.80 = ~$90.21**.
- Concurrency 3 (4 shards × 3 = 12 simultanés max, respecté).
- Idempotent : re-skippe les fiches déjà dotées (filtre `faq_content_kit=is.null`).
- Acceptance prod : `/hotel/hotel-de-la-chaize` → 200 + JSON-LD `FAQPage`.

## Séquence

`--segment=netnew` → `--segment=heads` → `--segment=rest`, boucle
`--limit=40 --concurrency=3 --grounded` jusqu'à `candidates: 0` par segment.

Arrêt propre sur `401` quota Perplexity (termine la vague, pas de spin sur 401).

## Reprise

```powershell
pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-faq-perplexity-batch.ts -- --segment=rest --shards=4 --shard=2 --grounded --limit=40 --concurrency=3
```
