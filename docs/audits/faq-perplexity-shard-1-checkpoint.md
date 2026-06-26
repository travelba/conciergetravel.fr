# FAQ Perplexity kit — Shard 1/4 checkpoint

> Worker dédié à la partition **shard 1** (`globalIndex % 4 == 1` sur les fiches
> publiées triées par slug ASC). Fichier **détenu par le shard 1 uniquement** —
> évite les conflits de rebase sur le doc de backfill partagé pendant que les 4
> workers tournent en parallèle sur `main`.

## État (grounded run)

- **shard1 : 732 / 746** fiches dotées du kit FAQ Perplexity (14 restantes).
- Vagues grounded : netnew (+53), heads #1-5 (+111/+110/+115/+117/+46), rest #1 (+103) — PAA 48-62 %.
- 14 restantes = ratés de gate transitoires (kit.en_parity / promote.canonical) → retry idempotent.
- Pipeline : **grounded DataForSEO** (commit `77d33bce`) — `grounding=on`,
  couverture PAA moyenne ~51-57 % par vague (non-bloquant si PAA hors-sujet).
- Concurrency 3 (4 shards × 3 = 12 simultanés max, respecté).
- Idempotent : re-skippe les fiches déjà dotées (filtre `faq_content_kit=is.null`).
- Quota Perplexity sain (0 × `401` sur les vagues grounded netnew + heads).
- Coût Perplexity cumulé (session grounded) : ~$88,9.

## Séquence

`--segment=netnew` → `--segment=heads` → `--segment=rest`, boucle
`--limit=120 --concurrency=3 --grounded` jusqu'à `candidates: 0` par segment.

Arrêt propre sur `401` quota Perplexity (termine la vague, pas de spin sur 401).

## Reprise

```powershell
pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-faq-perplexity-batch.ts -- --segment=rest --shards=4 --shard=1 --grounded --limit=120 --concurrency=3
```
