# Synthèse de vérification post-Go-Live — 2026-06-23

> Re-audit de vérification demandé par le PO après exécution du Go-Live
> (« quand tu penses que c'est bon, tu refais un audit complet »). Mené
> sur la **production live** `https://myconciergehotel.com` après merge
> de PR #162 dans `main` (`739fbe5f`).

## Verdict global

| Cluster                                  | Score pré-prod | Score post-deploy | Δ   |
| ---------------------------------------- | -------------- | ----------------- | --- |
| Navigation / Liens + Performance / UX    | 7,5 / 7,0      | **8,0**           | ↑   |
| Contenu / SEO + Business + Concurrentiel | ~7,5           | **8,5**           | ↑   |
| **Global Go-Live**                       | ~7,5           | **≈ 8,25 / 10**   | ↑   |

**0 régression** sur 17 routes clés FR+EN (home, fiche hôtel, destination,
classements, recherche → 200 ; compte → 307 auth attendu ; aucune 5xx).

## Ce que le Go-Live a livré (vérifié en prod)

Le déploiement de PR #162 a levé d'un coup les 3 bloqueurs « prod en
retard » identifiés en pré-prod, tous confirmés live :

- **`/lieux` + `/lieux/paris` → 200** — toute la verticale Lieux (~1147
  pages) était en 404, désormais accessible.
- **`/a-propos` → 308 `/le-concierge`** — plus de 404.
- **`og:image` 1200×630 Cloudinary + hero podium + TL;DR + millésime 2026**
  sur les 688 classements (FR+EN) — le P0 apparence/SEO est live.

Correctifs code Go-Live confirmés PASS en prod :

- Maillage `/guide` → `/destination` (8 country-guides hand-built
  préservés sous `/guide/`).
- Dorchester : `/marque/dorchester` → 308 canonical + absent du sitemap.
- Gating `/dev/*` → 404 en production.
- `loading.tsx` sur 6 hubs + 3 templates ; `cache()` sur
  `getDestinationBySlug` + `listPublishedRankings` + `fetchAllPublished`.
- Hero home migré `next/image` (srcset 320→1920 + preload).
- Newsletter : CTA honnête vers `/le-concierge/contact` (0 form désactivé).
- WhatsApp : recadré « dès la Phase 6 » (plus de « 24/7 » trompeur, DGCCRF).
- Parité EN classements **close** : `intro_en` / `factual_summary_en` /
  `justification_en` NULL = **0** (688/688 + 5 442 entrées, avg EN ≈ FR).
- JSON-LD best-in-class (~10 types) + 0 squatter dans `Restaurant.url` /
  `sameAs`.

## Résidus à finir (remédiation en cours — worker dédié)

| #   | Résidu                                                                           | Sévérité     | Fix                               |
| --- | -------------------------------------------------------------------------------- | ------------ | --------------------------------- |
| 1   | Favicon `/icon.svg` 404 en prod (matcher `proxy.ts` oublie l'icône)              | 🔴 FAIL live | 1 ligne matcher                   |
| 2   | `/selection/<slug>` FR nu → 404 (variantes préfixées OK)                         | 🟠 partiel   | 3 redirects nus                   |
| 3   | Soft-404 : `/hotel/zzz`, `/destination/zzz` → 200 sans `noindex`                 | 🟠 SEO       | `notFound()` sur templates détail |
| 4   | `classement-worlds-50-best-hotels-2025` : stub `intro_en` « DRAFT — » FR sur /en | 🟡 contenu   | retraduction FR→EN                |

→ corrigés sur `feat`, **live au prochain merge `feat`→`main`**.

## Gaps stratégiques résiduels (hors finitions — vrais chantiers)

Benchmark MCH vs `yonder.fr` / `travellers-society.com` (règle PO
permanente) :

1. **Richesse éditoriale concrète par hôtel** — yonder/travellers nomment
   l'architecte/designer, le « prix à partir de », la chambre à booker, la
   table Michelin, l'anecdote vérifiable ; nos justifications restent
   souvent génériques. → chantier d'enrichissement éditorial continu.
2. **Localisation EN de la table comparative** — `editorial_rankings.tables`
   (badge / budget / ambiance) reste FR-only sur **674 / 688** pages `/en`.
   → passe de localisation chiffrée.
3. **Autorité / indexation (le vrai plafond de verre)** — MCH absent du
   top-20 SERP (yonder #1, travellers #2). Hors contenu : GSC + suivi
   positions DataForSEO + backlinks (Phase 5).

**Bonne nouvelle couverture** : depuis l'audit fondateur du matin, les 12
gap rankings (Vienne, Crète, Seychelles…) + 13 slugs `hotel-de-luxe-*` ont
été générés et publiés (671 → 688 classements) — l'écart de couverture vs
yonder s'est nettement réduit.

## Conclusion

Le site est **Go-Live-ready** : les bloqueurs critiques sont levés en prod,
0 régression, scores en hausse sur les deux clusters. Les 4 résidus sont
des finitions mécaniques (remédiation en cours). Les 3 gaps stratégiques
restants sont des chantiers de fond déjà tracés (éditorial, localisation
EN table, autorité Phase 5), pas des bloqueurs de mise en ligne.

Rapports détaillés : `verif-01-nav-perf.md`, `verif-02-content-compet.md`.
