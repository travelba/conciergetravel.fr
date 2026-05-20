# Décision Cloudinary — 19 mai 2026 (mémo pour utilisateur)

État au 19 mai 2026 20:15 UTC+2 : **84 fiches PASS audit éditorial à 100 %**,
0 NEEDS_REGEN, 0 NEEDS_MANUAL_FIX. Reste 3 gates de publication structurelles
sur 84 drafts : photos ≥ 30, FAQ ≥ 10, hero image. La FAQ est en cours de
génération (bg job, ~30 min). Reste **photos + hero**.

## Diagnostic Cloudinary (rappel)

- Compte : `dvbjwh5wy`
- Plan : **Free** (25 crédits/mois)
- Crédits utilisés : 0.21 / 25 → **pas un problème de quota mensuel**
- `image_max_size_bytes: 10 485 760` (10 MB)
- Resources : 80 (cohérent avec 80 photos déjà uploadées)

Les ~200 erreurs `{"kind":"rate_limited"}` du batch overnight correspondent
au rate-limit **par seconde** du plan Free, agressif. Le retry exponentiel
intégré (2s → 32s) ne tient pas une concurrence > 1 sur 200 photos.

## Options chiffrées (mise à jour 19 mai)

| Option | Description                                                                 | Coût     | Temps utilisateur | Time-to-publish 84 fiches |
| ------ | --------------------------------------------------------------------------- | -------- | ----------------- | ------------------------- |
| **A**  | Upgrade Cloudinary **Plus** ($89/mois, 5 000 crédits, rate-limit 5× sup.)   | $89/mois | 5 min (signup)    | **~3-4 h** (batch auto)   |
| **B**  | Relance `--concurrency=1 --sleep=10s` sur le batch Wikimedia → Cloudinary   | 0        | 5 min (kick-off)  | **~30-40 h** wall-clock   |
| **C**  | Curation manuelle photos via Cloudinary MCP (drag-drop), top hotels d'abord | 0        | **~8-12 h actif** | ~10 j si 1 h/jour         |
| **D**  | **Hybride** : tier 1 (top 30) manuel + tier 2 (54 restants) auto slow       | 0        | ~4 h manuel       | ~7-10 j                   |

## Recommandation 19 mai 2026

**Option A** est désormais la plus rationnelle :

1. **Le contenu éditorial est prêt** (84/84 PASS). Toute heure
   supplémentaire bloquée par Cloudinary retarde le revenu IATA.
2. **$89/mois ≈ 6 h de ton temps facturable**, et l'option C/D coûte
   8-12 h actif minimum.
3. **Le plan Plus reste annulable mensuellement** : si après ouverture
   du site les uploads se calment, downgrader au Free.

### Si tu refuses A, fallback B+D :

1. Lancer **B** ce soir en background (slow uploads), laisser tourner 36 h.
2. En parallèle, identifier les **10 hôtels stratégiques** (top recherchés
   marché FR) et les traiter manuellement via Cloudinary MCP (option C ciblée).
3. Au réveil J+2, audit photos par hôtel et fallback Wikipedia/Unsplash pour
   les manques (`HotelImage` fallback déjà branché).

## Décision à prendre

| Décision | Engagement                                                                |
| -------- | ------------------------------------------------------------------------- |
| **A**    | Souscris Plus, je lance le batch en background, time-to-publish ~3-4 h    |
| **B**    | Tu confirmes, je lance le slow uploader background, time-to-publish ~30 h |
| **C**    | Tu prends en main Cloudinary MCP / console toi-même                       |
| **D**    | Hybride, on alloue mes heures sur le tier 1 manuel, B+D en background     |

À répondre quand tu peux. **L'option par défaut si silence > 24 h : B**
(slow uploader, $0, time-to-publish dégradé mais aucune décision financière).

## Référence

- `docs/editorial/yonder-overnight-wakeup.md` §"Options pour débloquer les
  photos" — l'analyse d'origine.
- MCP `cloudinary-env-config` + `cloudinary-asset-mgmt` — outils déjà
  configurés sur le compte `dvbjwh5wy`.
- `.cursor/rules/hotel-detail-page.mdc` Hard Rule 9 — gate ≥ 30 photos.
