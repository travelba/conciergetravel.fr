# Sprint 3a — Génération massive premium Concierge (playbook)

**Statut** : ⏳ Gated par Sprint 2.5 (Go pilote). Sprint 3a démarre uniquement après que `pilot-content-quality-report.md` ait coché **GO**.

**Cible** : les 443 hôtels publiés (`is_published = true`), par batchs de priorité.

---

## 1. Ordre de bataille (priorité décroissante)

| Batch | Filtre                                                 | Taille estimée | Délai cible | Justification                      |
| ----- | ------------------------------------------------------ | -------------- | ----------- | ---------------------------------- |
| 1     | `priority='P0'` (palaces flagship parisiens + R&C top) | ≈ 25           | J+1 à J+2   | SEA volume + valeur EEAT           |
| 2     | `priority='P1'` palaces régionaux                      | ≈ 80           | J+3 à J+5   | Reste du top 100 stratégique       |
| 3     | Top 50 trafic SEO (croisement `pageviews_90d` desc)    | ≈ 50           | J+6 à J+8   | ROI immédiat acquisition organique |
| 4     | Reste P1 + P2 publiés                                  | ≈ 290          | J+9 à J+15  | Couverture catalogue complète      |

> 443 hôtels × 4 sections = 1772 appels LLM. À 3 concurrent, médiane ~30s/appel, ~5 h de run cumulé. Réaliste sur 2 semaines en arrière-plan + audit qualité en cascade.

---

## 2. Commandes batch (PowerShell)

```powershell
cd scripts/editorial-pilot

# Batch 1 — P0 palaces
$slugs = (psql $env:SUPABASE_DB_URL -t -c "select string_agg(slug, ',') from hotels where is_published = true and priority = 'P0'").Trim()
pnpm club:conseil-enrichi --slugs="$slugs" --tavily --concurrency=3
pnpm club:quartier         --slugs="$slugs" --tavily --concurrency=3
pnpm club:gastronomie      --slugs="$slugs" --tavily --concurrency=3
pnpm club:timing           --slugs="$slugs" --tavily --concurrency=3

# Batch 2 — P1
$slugs = (psql $env:SUPABASE_DB_URL -t -c "select string_agg(slug, ',') from hotels where is_published = true and priority = 'P1'").Trim()
# (mêmes 4 commandes que ci-dessus avec --slugs="$slugs" --concurrency=4)

# Batch 3 — P2 + reste
# (idem avec priority = 'P2' AND limiter à 100 par run pour éviter d'épuiser le quota Tavily)
```

> **Quota Tavily** : 1000 search-credits / mois (free tier). `searchDepth=advanced` = 2 credits/call × `maxSearchResults=6` × 3 extract calls × 2 credits = ~14 credits/hôtel/section × 4 sections = ~56 credits/hôtel. 443 hôtels ≈ 24 800 credits → **upgrade Tavily paid tier obligatoire avant Sprint 3a**.

---

## 3. Enrichissement Tavily upstream (hôtels à description pauvre)

Pour les hôtels dont `description_fr` < 400 chars, le grounding Tavily seul ne suffit pas — il faut d'abord lancer le pipeline d'enrichissement existant pour étoffer la description, sinon les 4 sections premium tournent à vide.

```powershell
# Lister les hôtels à description pauvre publiés
psql $env:SUPABASE_DB_URL -c "select slug, length(coalesce(description_fr, '')) as len from hotels where is_published = true and (description_fr is null or length(description_fr) < 400) order by len asc;"

# Pour chacun : étendre la description d'abord
pnpm exec tsx src/hotels/run-hotel-description-extend.ts --slugs="<liste>" --tavily
```

Puis re-lancer les 4 passes premium sur ce sous-ensemble.

---

## 4. Audit qualité — échantillonnage 10 %

À chaque batch, prélever **10 %** des hôtels au hasard et scorer manuellement
sur la même grille que Sprint 2.5 (`pilot-content-quality-report.md` §3).

### Outil d'échantillonnage

```sql
-- Tirer un échantillon de 10% des hôtels d'un batch (Supabase SQL editor)
with batch as (
  select id, slug, name, conseil_enrichi, quartier_concierge,
         gastronomie_concierge, timing_acces_concierge
  from public.hotels
  where is_published = true
    and priority = 'P0' -- adapter par batch
    and conseil_enrichi is not null
)
select * from batch order by random() limit ceil(count(*) over () * 0.1);
```

### Seuils de tolérance par batch

- Si **score axe < 4,0** sur l'échantillon → pause batch, audit manuel des 10 derniers hôtels, ajustement prompt si nécessaire.
- Si **score axe ≥ 4,5** sur 3 batchs consécutifs → on peut descendre l'échantillonnage à 5 %.

---

## 5. Suivi opérationnel

Tableau de suivi à tenir dans `docs/le-concierge-club/sprint-3a-mass-generation-log.md` (créé par l'opérateur lors du run) :

| Date | Batch | Hôtels traités | Section | OK / Fail | Tokens (in/out) | Coût Tavily | Échantillon audité | Score moyen | Action |
| ---- | ----- | -------------- | ------- | --------- | --------------- | ----------- | ------------------ | ----------- | ------ |
|      |       |                |         |           |                 |             |                    |             |        |

---

## 6. Idempotence + reprise

- Le filtre `onlyMissingPremiumSection` saute automatiquement les hôtels déjà traités. Un re-run après crash reprend sans doublons.
- Tous les runs écrivent un log JSON dans `scripts/editorial-pilot/runs/premium-section-<section>-<dryOrLive>-<ts>.json`. **Garder ces logs au moins 30 jours** pour audit + post-mortem.

---

## 7. Validation finale du sprint

Sprint 3a est **closed** quand :

- [ ] 443 hôtels publiés ont les 4 sections premium **non-null** (vérifier via `select count(*) from hotels where is_published = true and (conseil_enrichi is null or quartier_concierge is null or gastronomie_concierge is null or timing_acces_concierge is null);` → résultat = 0).
- [ ] L'échantillonnage 10 % final score ≥ 4,0 sur les 4 axes.
- [ ] Tous les hôtels P0 ont leur statut `_*_review_status = 'approved'` (fact-check humain Sprint 4).
- [ ] Aucune fiche publiée n'a une section vide (Payload validateur).

---

## 8. Références

- `docs/le-concierge-club/pilot-content-quality-report.md` — gate Sprint 2.5.
- `scripts/editorial-pilot/src/hotels/run-hotel-premium-section.ts` — CLI.
- `packages/db/migrations/0057_loyalty_member_program.sql` — colonnes éditoriales.
- `.cursor/skills/concierge-voice-pipeline/SKILL.md`.
- `.cursor/skills/content-enrichment-pipeline/SKILL.md` (Tavily).
