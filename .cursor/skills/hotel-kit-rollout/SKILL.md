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

| #   | Sujet                          | Règle                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7  | **F&B**                        | `restaurant_info.venues[]` = **tous** les outlets officiels (restaurants **et** bars distincts si le site les sépare). Pas de fusion bar/resto ; pas de quota arbitraire « = Airelles ».                                                                                                                                                                                                                                         |
| D8  | **`#acces` — Avis voyageurs**  | **Uniquement** `google_reviews[]` sync Google Business Profile (`author` + `publish_time` + texte). **Interdit** `featured_reviews` / presse dans ce sous-bloc. CLI : `reviews:sync -- --slug=<slug>`.                                                                                                                                                                                                                           |
| D9  | **POI `#autour`**              | Chaque entrée `visit` / `do` / `shop` porte **`image_public_id`** (rendu `around-item has-img`). Gate : `gold.poi_images`.                                                                                                                                                                                                                                                                                                       |
| D10 | **`#concierge-questions`**     | Titre : `Le Concierge répond — {hotel.name}` via i18n `hotelPage.conciergeQuestions.title` + `{ hotel: name }` dans `prepare-hotel-kit-model.ts` — **jamais** hardcoder un nom pilote (régression PdG 2026-06-10). Réponses **informatives** (3ᵉ personne / « La conciergerie peut… »). **Interdit** engagement 1ʳᵉ personne : « Je réserve », « Je confirme », « Je m'occupe de… ». Gate : `cdc.11.concierge_informative_tone`. |
| D11 | **Titres & labels**            | Jamais de nom de fiche de référence hardcodé (« Airelles Gordes », etc.). Fallbacks média **neutres** ou Cloudinary de l'hôtel courant.                                                                                                                                                                                                                                                                                          |
| D12 | **Photos incorrectes**         | Si une photo ne correspond pas au sujet (ex. patio étiqueté spa) → **re-sourcer depuis le site officiel**, pas seulement recatégoriser / réordonner la galerie existante. Voir §Rule 1 ci-dessous.                                                                                                                                                                                                                               |
| D13 | **POI = photo dédiée**         | Chaque POI `#autour` porte un asset Cloudinary **`poi-{slug}`** (Wikimedia / officiel / AI fallback) — **jamais** un slot `press-*` de la galerie hôtel. Gate : `gold.poi_dedicated_images`. Script modèle : `resource-airelles-poi-images.ts` ; PdG : `resource-prince-de-galles-poi-images.ts` (`pdg:photos:poi`).                                                                                                             |
| D14 | **Correspondance sujet**       | Avant validation PO : `audit:photo-subject -- --slug=x` (L1 structural) + `--vision` sur les fiches pilote. Gates CDC : `gold.poi_photo_structural`, `photos.gallery_alt_category`. Domain : `@mch/domain/photos`. Voir skill `photo-pipeline` §Photo-subject correspondence.                                                                                                                                                    |
| D15 | **`#chambres` — pick visible** | Le `concierge_pick.slug` doit être la **carte n°1** parmi les **3** tuiles rendues (`renderKitChambres` → `slice(0, 3)`). Chaque tuile visible porte **≥ 1 photo** (DB `hotel_rooms.images[]` ou map `kit-{slug}-display.ts`). Gate : `kit.02.chambres_pick_first_visible`, `kit.02.chambres_visible_have_photo`.                                                                                                                |
| D16 | **Module chambres par slug**   | Chaque kit hors pilote Gordes/PdG exige `resource-{slug}-rooms.ts` + entrées dans `kit-{brand}-display.ts` (pattern PdG). **Interdit** de réutiliser `orderAirellesKitRoomCards` / `resolveAirellesKitRoomImages` pour d'autres slugs (régression wave 5).                                                                                                                                                                       |
| D17 | **FAQ kit ≠ stub promote**     | `faq_content_kit` = Perplexity **40–60** avec `group_fr` — **jamais** `FAQ_CONTENT_KIT = FAQ_CONTENT_PROMOTE`. Gate : `kit.11.faq_kit_not_stub` + `cdc.11.faq_kit_count`.                                                                                                                                                                                                                                                        |
| D18 | **GMB frais**                  | `reviews:sync` < 30 j ; ≥ 3 avis substantifs en cache ; plus récent ≤ 90 j. Gates : `kit.10.gmb_review_count`, `kit.10.gmb_review_recency`, `kit.10.gmb_sync_fresh`.                                                                                                                                                                                                                                                             |
| D19 | **Clôture « livré »**          | **Les deux** : (a) `audit:hotel-fiches-cdc -- --slug=x` **exit 0** sur gates `kit.*` ; (b) walk navigateur §Rule 6. Score CDC ≥ 95 % **sans** gates `kit.*` verts = **refusé**.                                                                                                                                                                                                                                                  |

---

## Rule 6 — Clôture kit : PO parity, pas deploy parity

**Incident wave 5 (2026-06-10)** : 5 fiches poussées avec galerie 30/30 + POI + amen-grid en HTML. PO a vu chambres sans photo, pick invisible, pixels spa/resto faux, FAQ maigre, avis GMB pas récents. Cause : validation sur checks **structurels** (upload, grep prod) au lieu de **parité visuelle CDC**.

### Anti-patterns refusés (hard fail)

| Anti-pattern agent                         | Pourquoi c'est faux                                       | Preuve exigée                                                 |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| « 30/30 Cloudinary = CDC photos OK »       | D12/D14 = correspondance **pixel**, pas compteur          | `audit:photo-subject --vision` + screenshot spa/resto/chambre |
| « `concierge_pick` en DB = pick visible »  | Seules 3 cartes rendues ; pick peut être 7ᵉ sans ordering | Screenshot `#chambres` avec badge `cc-pick` sur carte n°1     |
| « `faq_content_kit` présent = FAQ OK »     | 5 items = stub promote (Cheval Blanc)                     | `kit.11.faq_kit_not_stub` + DOM ≥ 40 questions groupées       |
| « `google_reviews_count` > 0 = avis OK »   | Cache stale / 1 avis / pas les plus récents               | `reviews:sync` + dates visibles dans `#acces`                 |
| « HTML prod contient `amen-grid` = livré » | Deploy ≠ rendu PO                                         | Walk FR+EN vs `/hotel/les-airelles-gordes`                    |

### Walk obligatoire avant « c'est bon » (en plus de Rule 5)

Comparer **côte à côte** avec la référence Gordes — sections :

1. `#chambres` — pick en 1ʳᵉ carte + photo sur chaque tuile visible
2. `#hotel-en-bref` — spa + restaurant : sujet photo = label
3. `#acces` — 3 avis GMB datés (pas presse)
4. `#faq` + `#concierge-questions` — profondeur comparable (pas 5 FAQ)
5. `#autour` — vignette dédiée par POI

Screenshots desktop + mobile FR + EN. Commit `Tested:` cite les gates `kit.*` passés.

### Matrice PO → gates (source de vérité code)

Chaque remarque PO wave 5 est verrouillée dans
`scripts/editorial-pilot/src/hotels/kit-po-remark-registry.ts` :

| Remarque PO                                | Gates automatisés                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Photos chambres manquantes                 | `kit.02.chambres_visible_have_photo`, `kit.02.chambres_pick_has_photo`, `kit.16.room_batch_script`                      |
| Hero dupliqué dans la mosaïque             | `kit.02.hero_not_in_gallery`, `kit.02.gallery_unique_public_id`, `kit.02.gallery_source_url_tracked`                    |
| Hero pas une vue d’ensemble                | `kit.02.hero_category_exterior_or_view`                                                                                 |
| POI photo IA sans sourcing réel            | `kit.07.poi_structural`, `gold.poi_dedicated_images`, walk `#autour`                                                    |
| Sélection Concierge chambre invisible      | `kit.02.chambres_pick_first_visible`, `kit.02.concierge_pick_note`, `kit.16.room_display_module`                        |
| Photos expérience / restaurant incorrectes | `kit.02.gallery_no_duplicate_source_url`, `kit.02.gallery_alt_category`, `kit.03.signature_experiences_dedicated_image` |
| FAQ trop faible                            | `kit.11.faq_kit_not_stub`, `kit.11.faq_kit_count`, `kit.11.faq_kit_has_groups`                                          |
| FAQ Concierge trop faible                  | `kit.11.concierge_questions_count`, `kit.11.concierge_informative_tone`, `kit.11.concierge_taxonomy`                    |
| Avis Google récents manquants              | `kit.10.gmb_*`, `cdc.10.google_reviews_gmb`                                                                             |
| POI / F&B / spa (PdG)                      | `kit.07.poi_structural`, `gold.venues_all_handoff`, `gold.spa_dossier` (blockers kit)                                   |
| Clôture « livré » abusive                  | `kit.19.closure_audit_exit_zero` + Rule 6 walk                                                                          |

L'audit `audit:hotel-fiches-cdc` **exit 1** liste les remarques PO encore ouvertes.

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

## Rule 7 — Ordre photo obligatoire (PO 2026-06-10)

**Anti-pattern refusé** : uploader 30 press-\* puis remapper alt/category ; générer POI IA avant d’avoir cherché Commons / site officiel / Google Places.

**Ordre imposé par slot** (chaque slot = sujet unique, `source_url` tracée dans le manifest) :

1. **Hero** — 1 photo **exterior** ou **view** montrant l’établissement dans son ensemble. `hero_image` **interdit** dans `gallery_images[]` (gate `kit.02.hero_not_in_gallery`).
2. **Galerie 30** — 10 catégories CDC, **0 URL source dupliquée**, **0 public_id dupliqué**, chaque entrée porte `url` ou `source_url` (gate `kit.02.gallery_source_url_tracked`).
3. **Chambres** — 1 photo officielle par `room.slug` via `resource-{slug}-rooms.ts` + map display ; **interdit** le fallback `galleryTiles[index % n]`.
4. **Spa / resto (#hotel-en-bref)** — slot galerie `spa`/`dining` vérifié visuellement ; si le pixel ne correspond pas → re-sourcer (Rule 1), pas seulement `spaHero()` resolver.
5. **POI #autour** — pour chaque POI : Tavily/Commons/Places **d’abord** ; upload `poi-{slug}` ; **IA seulement** si aucune source libre de droits (documenter dans le script).
6. **Promote** → `audit:hotel-fiches-cdc` exit 0 sur tous les `kit.02.*` → **walk Rule 6** (mosaïque + chambres + spa + autour).

**Exemple Les Prés d’Eugénie** : `press-1` (réception) était hero **et** galerie[0] ; `press-4` reprenait la même URL source que `press-1` — invisible au gate url tant que `source_url` absent du JSONB.

---

Avant de demander validation PO :

- [ ] **Structure** : 9 sections kit, ancres D1–D6 (runbook).
- [ ] **Golden file** : `packages/domain/src/editorial/{slug}-golden.ts` (+ gallery, concierge-questions si volumineux).
- [ ] **Promote** : `promote:{slug}-golden` → Supabase ; 0 champ critique NULL.
- [ ] **Galerie** : ≥ 30 images CDC ; **0 URL source dupliquée** (`kit.02.gallery_no_duplicate_source_url`) ; spa/restaurant/expérience **vérifiés visuellement** (D12/D14).
- [ ] **Chambres kit** : pick carte #1 + 3 tuiles visibles avec photo (`kit.02.*`) ; script `resource-{slug}-rooms.ts` (D15–D16).
- [ ] **F&B** : count venues = site officiel (D7).
- [ ] **Google reviews** : `reviews:sync` < 30 j, ≥ 3 avis, plus récent ≤ 90 j (D8 + D18 + `kit.10.*`).
- [ ] **POI** : 100 % `image_public_id` **dédiés** `poi-{slug}` — pas de `press-*` recyclé (D9 + D13).
- [ ] **Photo-subject audit** : `audit:photo-subject -- --slug=x` → 0 fail structural ; `--vision` sur pilotes (D14).
- [ ] **Concierge questions** : 20–30 items, ton informatif (D10).
- [ ] **FAQ kit** : Perplexity 40–60 + promote 10–15 (skill `hotel-faq-perplexity-enrichment`).
- [ ] **Audit** : `audit:hotel-fiches-cdc -- --slug=<slug>` — **exit 0** incluant tous les gates `kit.*` (D19).
- [ ] **Walk FR + EN** : Rule 6 — 5 sections vs Gordes, desktop + mobile.

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

Gates partagés : `hotel-fiche-cdc-gates.ts` + **`kit-fiche-acceptance-gates.ts`** (D15–D19, exit 1 sur fiche kit). Legacy : `cdc.10.google_reviews_gmb` (blocker kit), `gold.poi_*`, `cdc.11.faq_kit_count`.

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

| Anti-pattern                                          | Correctif                                            |
| ----------------------------------------------------- | ---------------------------------------------------- |
| Remapper metadata spa sans changer l'asset Cloudinary | Rule 1 — Tavily + upload officiel                    |
| 1 seul restaurant alors que le site liste bar + resto | D7 — éclater `venues[]`                              |
| Presse Forbes dans « Avis voyageurs »                 | D8 — `reviews:sync` only                             |
| POI sans vignette                                     | D9 — `image_public_id` Cloudinary                    |
| POI avec photo chambre / galerie `press-*`            | D13 — `resource-{slug}-poi-images.ts` + `poi-{slug}` |
| « Je réserve… » dans `#concierge-questions`           | D10 — réécriture 3ᵉ personne                         |
| Label « Airelles » sur une autre fiche                | D11 — i18n + titres dynamiques                       |
| « Tests passent, ship » sans walk navigateur          | Rule 5 + Rule 6                                      |
| « Score CDC 95 % » avec gates `kit.*` rouges          | D19 — `audit:hotel-fiches-cdc` exit 1                |
| Réutiliser ordering/images Airelles pour autre slug   | D16 — `kit-{slug}-display.ts` dédié                  |
| `FAQ_CONTENT_KIT = FAQ_CONTENT_PROMOTE`               | D17 — `kit.11.faq_kit_not_stub`                      |

---

## References

- Runbook : [`docs/runbooks/airelles-reference-fiche-plan.md`](../../../docs/runbooks/airelles-reference-fiche-plan.md)
- CDC fiche : [`.cursor/rules/hotel-detail-page.mdc`](../../rules/hotel-detail-page.mdc)
- Photos : [`photo-pipeline`](../photo-pipeline/SKILL.md), [`photo-quality-seo-geo-agentique`](../photo-quality-seo-geo-agentique/SKILL.md)
- FAQ Perplexity : [`hotel-faq-perplexity-enrichment`](../hotel-faq-perplexity-enrichment/SKILL.md)
- Walk-through : [`user-acceptance-loop`](../user-acceptance-loop/SKILL.md)
- Voix : [`concierge-voice-pipeline`](../concierge-voice-pipeline/SKILL.md)
- FAQ kit Perplexity (0075 prod, titre concierge) : [`hotel-faq-perplexity-enrichment`](../hotel-faq-perplexity-enrichment/SKILL.md) Rule 6–7
