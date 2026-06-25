# FAQ Perplexity kit — Shard 2/4 checkpoint

> Worker dédié à la partition **shard 2** (`globalIndex % 4 == 2` sur les fiches
> publiées triées par slug ASC). Fichier **détenu par le shard 2 uniquement** —
> évite les conflits de rebase sur le doc de backfill partagé pendant que les 4
> workers tournent en parallèle sur `main`.

## État (grounded run)

- **shard2 : 131 / 746** fiches dotées du kit FAQ Perplexity.
- Pipeline : **grounded DataForSEO** (commit `77d33bce`) — `grounding=on`,
  couverture PAA moyenne ~51 % par vague.
- Concurrency 3 (4 shards × 3 = 12 simultanés max, respecté).
- Idempotent : re-skippe les fiches déjà dotées (filtre `faq_content_kit=is.null`).

## Séquence

`--segment=netnew` → `--segment=heads` → `--segment=rest`, boucle
`--limit=40 --concurrency=3 --grounded` jusqu'à `candidates: 0` par segment.

Arrêt propre sur `401` quota Perplexity (termine la vague, pas de spin sur 401).

## Reprise

```powershell
pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-faq-perplexity-batch.ts -- --segment=rest --shards=4 --shard=2 --grounded --limit=40 --concurrency=3
```
