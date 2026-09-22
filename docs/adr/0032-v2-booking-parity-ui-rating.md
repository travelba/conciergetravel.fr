# ADR 0032 — Note UI /10 avec libellé ; JSON-LD reste /5

- Status: accepted
- Date: 2026-07-07
- Refs:
  - CDC v2 : [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../cdc/cahier-des-charges-v2-booking-like.md) §6.3, décision C1a / Q19
  - Matrice parité : [`docs/v2/benchmark-booking-parity-matrix.md`](../v2/benchmark-booking-parity-matrix.md)
  - Hard Rule 11 : [`.cursor/rules/hotel-detail-page.mdc`](../../.cursor/rules/hotel-detail-page.mdc)
  - Skill structured data : [`.cursor/skills/structured-data-schema-org/SKILL.md`](../../.cursor/skills/structured-data-schema-org/SKILL.md)
  - Skill parité UX : [`.cursor/skills/booking-parity-ux/SKILL.md`](../../.cursor/skills/booking-parity-ux/SKILL.md)

## Décision

La refonte v2 affiche la note client **sur une échelle /10 avec un libellé
qualitatif** dans toute l'interface utilisateur (ResultCard SRP, box sticky
fiche, bloc avis, entrées classement). Le **JSON-LD `AggregateRating` reste
sur une échelle /5** avec `bestRating: '5'` — jamais `'10'`.

Deux surfaces, deux échelles, une formule de conversion documentée et testée.

## Contexte

Booking.com et la majorité des OTA européennes affichent une note /10 avec
un adjectif (« Superbe », « Fabuleux »…). Les utilisateurs MCH arrivent avec
ce réflexe visuel ; une note /5 sans conversion crée une friction de
comparaison sur la SRP et la fiche.

Google Rich Results, en revanche, normalise historiquement les avis hôteliers
sur 5 étoiles dans les SERP. Le repo a déjà une Hard Rule 11 : émettre
`bestRating: '10'` produit un affichage incohérent (/5 dans les SERP quoi
qu'il arrive). La source canonique v1 est la note agrégée Google (souvent
stockée /5 en base) ; v2 harmonise l'**affichage** sans mentir au crawler.

Décision PO C1a (2026-07-03) : « Note UI /10 + libellé (conversion ×2
depuis /5), JSON-LD reste /5 ».

## Formule de conversion

### Données source

- **`ratingValue`** en base / read-model : échelle **/5** (float, ex. `4.6`).
- Provenance : agrégat Google Business Profile (Q19 — attribution visible,
  rien de fabriqué).

### UI (/10)

```typescript
/** Pure function — packages/domain or packages/ui-v2 */
function toDisplayRatingTenScale(ratingOutOfFive: number): number {
  const clamped = Math.min(5, Math.max(0, ratingOutOfFive));
  return Math.round(clamped * 2 * 10) / 10; // 1 decimal, e.g. 4.6 → 9.2
}
```

- Affichage : `{displayRating}/10` + libellé (table i18n).
- **Ne jamais** stocker /10 en base — toujours dériver à l'affichage.

### Libellés qualitatifs (fr — exemple)

| Note /10  | Libellé FR                                   |
| --------- | -------------------------------------------- |
| ≥ 9,0     | Exceptionnel                                 |
| 8,0 – 8,9 | Superbe                                      |
| 7,0 – 7,9 | Bien                                         |
| 6,0 – 6,9 | Agréable                                     |
| < 6,0     | _(masquer le bloc note — seuil qualité MCH)_ |

Les seuils sont **data-driven** (config Zod `ratingLabelBands`), pas codés en
dur dans les composants. EN : équivalents culturels (« Exceptional », « Superb »…).

### JSON-LD (/5)

```json
{
  "@type": "AggregateRating",
  "ratingValue": "4.6",
  "bestRating": "5",
  "worstRating": "1",
  "ratingCount": 1234
}
```

- `ratingValue` = valeur source /5 (string, 1 décimale max).
- **`bestRating` toujours `"5"`** — jamais `"10"`.
- Pas de `Review` individuel fabriqué (Q19).

## Surfaces concernées

| Surface                 | Composant v2          | Échelle affichée                   | JSON-LD                     |
| ----------------------- | --------------------- | ---------------------------------- | --------------------------- |
| SRP ResultCard          | `HotelResultCard`     | /10 + libellé                      | Non                         |
| Fiche — box sticky      | `HotelBookingBox`     | /10 + libellé                      | Oui (/5)                    |
| Fiche — section avis    | `HotelReviewsSummary` | /10 + libellé + attribution Google | Oui (/5)                    |
| Classement — entry card | `RankingHotelEntry`   | /10 + libellé                      | ItemList entries → Hotel /5 |
| Compte                  | —                     | N/A                                | N/A                         |

## Conséquences

### Positives

- Parité visuelle Booking sur la note (SRP + fiche).
- JSON-LD conforme Hard Rule 11 et Rich Results Google.
- Conversion pure, testable unitairement (`packages/domain`).

### Négatives

- Deux échelles à maintenir — risque de confusion dev si un composant
  lit la mauvaise source. Mitigation : type branded `RatingOutOfFive` vs
  `DisplayRatingTen` ; ESLint interdit l'affichage direct de la valeur /5.

### Tests obligatoires

- Unit : `toDisplayRatingTenScale(4.6) === 9.2`, clamp 0/5, arrondi.
- Snapshot JSON-LD : `bestRating` jamais `10` sur fixtures palace.
- E2E : fiche `/hotel/le-meurice` — DOM contient `/10`, view-source
  contient `"bestRating":"5"`.

## Anti-patterns interdits

| Anti-pattern                          | Pourquoi                         |
| ------------------------------------- | -------------------------------- |
| `bestRating: '10'` dans JSON-LD       | SERP incohérentes ; Hard Rule 11 |
| Stocker /10 en Supabase               | Double source de vérité          |
| Libellé sans note numérique           | Parité Booking exige les deux    |
| Note affichée sans attribution Google | Q19 — EEAT / crédibilité         |
| Arrondir 4.75 → 10/10                 | Sur-promesse ; garder 1 décimale |

## Plan de rollback

Si Google introduit un format /10 unifié **et** le valide dans Rich Results
(test A/B Search Console), réévaluer en ADR amendement — jusqu'alors /5
JSON-LD reste la norme.

## Validation

- [ ] `packages/domain/src/ratings/display-rating.test.ts` vert
- [ ] Builders `packages/seo/jsonld/hotel.ts` inchangés sur /5
- [ ] Matrice parité F7, S5 → statut OK post-implémentation
- [ ] Walk-through prod post-bascule : DOM /10 vs source /5
