---
name: hotel-kit-rollout
description: Rollout du template kit hôtel (9 sections Airelles) vers le catalogue — consignes PO verrouillées sur les pilotes Airelles + Prince de Galles. Couvre F&B complets, avis Google GMB, photos POI/spa sourcées officiellement (Tavily / DAM chaîne / Google Places), ton concierge informatif, gates CDC, promote golden, walk-through obligatoire. À lire avant toute fiche pilote suivante.
---

# Hotel kit rollout — consignes PO pour les fiches suivantes

> **Décision PO (2026-06-10)** : les remarques validées sur **Prince de Galles** (`prince-de-galles-paris`) complètent la fiche de référence **Airelles Gordes** et deviennent **obligatoires** pour chaque fiche pilote suivante, puis pour le rollout catalogue.

Runbook détaillé : [`docs/runbooks/airelles-reference-fiche-plan.md`](../../../docs/runbooks/airelles-reference-fiche-plan.md).

Rule agent : [`.cursor/rules/hotel-kit-rollout.mdc`](../../rules/hotel-kit-rollout.mdc).

## Triggers

Invoke when:

- Onboarding a **new pilot hotel** onto the kit template (structure + données).
- PO flags a mismatch (wrong spa photo, missing bar, press reviews in Google block, « Je réserve… » tone).
- Auditing or promoting a `{slug}-golden.ts` file.
- Deciding whether to **remap gallery metadata** vs **re-source photos**.

## Pilotes de référence

| Slug                     | Rôle                                        | Golden / promote                  |
| ------------------------ | ------------------------------------------- | --------------------------------- |
| `les-airelles-gordes`    | Structure 9 sections + design kit           | `promote:airelles-golden`         |
| `prince-de-galles-paris` | Deuxième pilote données PO (Marriott PARLC) | `promote:prince-de-galles-golden` |

**Ordre rollout** : Airelles validé structure → PdG validé données PO → vagues catalogue par `parent_group` / tier photo (skill `photo-pipeline` §Audit-driven rollout).

---

## Consignes PO — non négociables (D7–D12)

Héritées de D1–D6 (runbook) + retours PO PdG 2026-06-10.

| #   | Sujet                         | Règle                                                                                                                                                                                                                                                       |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7  | **F&B**                       | `restaurant_info.venues[]` = **tous** les outlets officiels (restaurants **et** bars distincts si le site les sépare). Pas de fusion bar/resto ; pas de quota arbitraire « = Airelles ».                                                                    |
| D8  | **`#acces` — Avis voyageurs** | **Uniquement** `google_reviews[]` sync Google Business Profile (`author` + `publish_time` + texte). **Interdit** `featured_reviews` / presse dans ce sous-bloc. CLI : `reviews:sync -- --slug=<slug>`.                                                      |
| D9  | **POI `#autour`**             | Chaque entrée `visit` / `do` / `shop` porte **`image_public_id`** (rendu `around-item has-img`). Gate : `gold.poi_images`.                                                                                                                                  |
| D10 | **`#concierge-questions`**    | Titre : `Le Concierge répond — {hotel.name}`. Réponses **informatives** (3ᵉ personne / « La conciergerie peut… »). **Interdit** engagement 1ʳᵉ personne : « Je réserve », « Je confirme », « Je m'occupe de… ». Gate : `cdc.11.concierge_informative_tone`. |
| D11 | **Titres & labels**           | Jamais de nom de fiche de référence hardcodé (« Airelles Gordes », etc.). Fallbacks média **neutres** ou Cloudinary de l'hôtel courant.                                                                                                                     |
| D12 | **Photos incorrectes**        | Si une photo ne correspond pas au sujet (ex. patio étiqueté spa) → **re-sourcer depuis le site officiel**, pas seulement recatégoriser / réordonner la galerie existante. Voir §Rule 1 ci-dessous.                                                          |

---

## Rule 1 — Photo mismatch → sourcer, pas remapper

**Anti-pattern refusé** : corriger `category` / `alt_*` / `spaHero()` resolver alors que les **pixels** Cloudinary viennent d'un autre sujet (patio, salle de bain, chambre).

**Workflow obligatoire** quand PO ou audit signale une incohérence visuelle :

1. **Identifier la source officielle** — ordre de préférence :
   - DAM presse chaîne (`cache.marriott.com`, `assets.airelles.com`, kit R&C, etc.)
   - Pages expériences / spa / dining du **site officiel** (`official_url`)
   - **Tavily** MCP (`search` + `extract`) ou CLI `tvly` — domaine officiel uniquement
   - **Google Places Photos** (`packages/integrations/google-places/`) si pas de kit structuré
2. **Uploader** vers Cloudinary (`uploadFromUrl`, `source: 'press' | 'official'`) — **même `public_id`** si remplacement slot existant.
3. **Mettre à jour** `{slug}-gallery.ts` (alt, caption, category, credit).
4. **`promote:{slug}-golden`** + vérifier rendu bloc spa / POI / chambre.
5. **Walk-through** navigateur sur la section concernée (skill `user-acceptance-loop`).

**Référence PdG (2026-06-10)** : `press-17` était un patio Marriott (`parlc-patio-5653`) labelé CALMA. Fix = Scene7 officiels via Tavily :

- `lc-parlc-lux-parlc-spa-double-13746` → hero spa (`press-17`)
- `lc-parlc-lux-parlc-spa-hammam2-40183` → `press-13`
- `lc-parlc-lux-parlc-spa-relax2-39825` → `press-14`
- Script ciblé : `pnpm --filter @mch/editorial-pilot pdg:photos:wellness`

---

## Rule 2 — Checklist données par fiche pilote

Avant de demander validation PO :

- [ ] **Structure** : 9 sections kit, ancres D1–D6 (runbook).
- [ ] **Golden file** : `packages/domain/src/editorial/{slug}-golden.ts` (+ gallery, concierge-questions si volumineux).
- [ ] **Promote** : `promote:{slug}-golden` → Supabase ; 0 champ critique NULL.
- [ ] **Galerie** : ≥ 30 images CDC ou plan Phase 2 documenté ; catégories spa/restaurant/exterior **vérifiées visuellement**.
- [ ] **F&B** : count venues = site officiel (D7).
- [ ] **Google reviews** : sync GMB, ≥ 3 avis datés dans `#acces` (D8).
- [ ] **POI** : 100 % `image_public_id` (D9).
- [ ] **Concierge questions** : 20–30 items, ton informatif (D10).
- [ ] **FAQ kit** : Perplexity 40–60 + promote 10–15 (skill `hotel-faq-perplexity-enrichment`).
- [ ] **Audit** : `audit:hotel-fiches-cdc -- --slug=<slug>` — golden + CDC ≥ 95 %.
- [ ] **Walk FR + EN** : desktop + mobile, discoverability depuis `/` si nav touchée.

---

## Rule 3 — Outillage par slug (pattern PdG)

Répliquer le pattern **un golden TS + scripts npm dédiés** plutôt que des one-shots non reproductibles :

| Artefact             | Emplacement                                                                    |
| -------------------- | ------------------------------------------------------------------------------ |
| Golden content       | `packages/domain/src/editorial/{kebab-slug}-golden.ts`                         |
| Gallery manifest     | `packages/domain/src/editorial/{kebab-slug}-gallery.ts`                        |
| Concierge Q&A        | `packages/domain/src/editorial/{kebab-slug}-concierge-questions.ts`            |
| Gallery upload batch | `scripts/editorial-pilot/src/photos/resource-{kebab-slug}-gallery-batch.ts`    |
| Promote script       | `scripts/editorial-pilot/src/hotels/promote-{kebab-slug}-golden.ts`            |
| npm scripts          | `scripts/editorial-pilot/package.json` (`promote:…`, `{chain}:photos:gallery`) |

Gates partagés : `scripts/editorial-pilot/src/hotels/hotel-fiche-cdc-gates.ts` (`cdc.10.google_reviews_gmb`, `cdc.11.concierge_informative_tone`, `gold.poi_images`).

---

## Rule 4 — Ton & voix (concierge questions vs FAQ)

| Surface                           | Ton                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `faq_content` / `faq_content_kit` | Factuel, fiche info                                                             |
| `concierge_advice`                | Voix concierge complice, secret opérationnel (ADR-0011)                         |
| `concierge_questions`             | **Informatif** — ce que la conciergerie **peut** faire, sans promesse au « Je » |

Exemple **interdit** : « Je réserve votre table au Bar 19.20 dès votre arrivée. »

Exemple **OK** : « La conciergerie peut contacter le Bar 19.20 pour une table en terrasse, sous réserve de disponibilité le jour même. »

---

## Rule 5 — Avant commit / « c'est live »

Hard rule [`.cursor/rules/user-acceptance-before-commit.mdc`](../../rules/user-acceptance-before-commit.mdc) :

- URLs walkées + screenshots bloc spa / F&B / avis Google / POI.
- Preuve discoverability si nav/footer touchés.
- Mentionner dans le commit : `Tested: walked /hotel/<slug> FR+EN, spa photo = official DAM, GMB reviews in #acces`.

---

## Anti-patterns

| Anti-pattern                                          | Correctif                         |
| ----------------------------------------------------- | --------------------------------- |
| Remapper metadata spa sans changer l'asset Cloudinary | Rule 1 — Tavily + upload officiel |
| 1 seul restaurant alors que le site liste bar + resto | D7 — éclater `venues[]`           |
| Presse Forbes dans « Avis voyageurs »                 | D8 — `reviews:sync` only          |
| POI sans vignette                                     | D9 — `image_public_id` Cloudinary |
| « Je réserve… » dans `#concierge-questions`           | D10 — réécriture 3ᵉ personne      |
| Label « Airelles » sur une autre fiche                | D11 — i18n + titres dynamiques    |
| « Tests passent, ship » sans walk navigateur          | Rule 5                            |

---

## References

- Runbook : [`docs/runbooks/airelles-reference-fiche-plan.md`](../../../docs/runbooks/airelles-reference-fiche-plan.md)
- CDC fiche : [`.cursor/rules/hotel-detail-page.mdc`](../../rules/hotel-detail-page.mdc)
- Photos : [`photo-pipeline`](../photo-pipeline/SKILL.md), [`photo-quality-seo-geo-agentique`](../photo-quality-seo-geo-agentique/SKILL.md)
- FAQ Perplexity : [`hotel-faq-perplexity-enrichment`](../hotel-faq-perplexity-enrichment/SKILL.md)
- Walk-through : [`user-acceptance-loop`](../user-acceptance-loop/SKILL.md)
- Voix : [`concierge-voice-pipeline`](../concierge-voice-pipeline/SKILL.md)
