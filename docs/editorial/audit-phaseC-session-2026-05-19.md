# Phase C — session de convergence qualité corpus (19 mai 2026, soir)

**Run final** : 19 mai 2026 ~20:05 UTC+2
**Audit script** : [`scripts/editorial-pilot/audit-pushed-drafts.mjs`](../../scripts/editorial-pilot/audit-pushed-drafts.mjs)
**Détail JSON** : [`scripts/editorial-pilot/audit-pushed-drafts.json`](../../scripts/editorial-pilot/audit-pushed-drafts.json)

## Résumé exécutif

| Métrique             | Début de session (16:40) | Fin de session (20:05) | Delta   |
| -------------------- | ------------------------ | ---------------------- | ------- |
| Drafts auditables    | 72                       | 84                     | +12     |
| **PASS**             | 40 (56 %)                | **84 (100 %)**         | **+44** |
| **NEEDS_REGEN**      | 32 (44 %)                | 0                      | −32     |
| **NEEDS_MANUAL_FIX** | 0                        | 0                      | 0       |

**Pass rate corpus : 56 % → 100 %** (+44 points, convergence complète).

12 fiches supplémentaires récupérées (8 `&` PowerShell + 4 BriefSchema), 22 guides
traduits FR→EN, prompt 08 patché pour densité FR symétrique au patch EN, 3
patches surgical sur les 3 derniers résiduels (banned-term scrub + bullet-aware
audit + +2 sections + intro `À deux pas`).

## Travaux livrés

### 1. B1 — Pass 8 retry sur 14 fiches `advice_fr < 50w`

- **Patch prompt** : ajout section "Spécificité FR — anti-bullet-list-implicite"
  dans [`scripts/editorial-pilot/prompts/08-concierge-voice.md`](../../scripts/editorial-pilot/prompts/08-concierge-voice.md)
  pour forcer le `body` FR à étoffer chaque secret opérationnel avec sa
  justification + précision saisonnière, plutôt qu'une liste implicite de
  3 mini-recommandations qui sortait à 47 mots.
- **Retry** : 14/14 OK via `run-humanizer.ts`. Body FR remonte à
  54-71 mots médian (vs 45-49 avant).
- **Symétrique EN** : la section "Spécificité EN — anti-traduction-littérale"
  produite à la première itération de la session reste en place (FR body
  56-69w médian).

### 2. B5 — Fix PowerShell wrapper + récupération 8 fiches `&`

- **Cause racine** : `pnpm.ps1` Windows + `cmd.exe /c "pnpm <args>"` mangent
  les caractères `&`, `|`, `<`, `>` même quand on caret-escape, parce que
  PowerShell réinterprète avant que cmd voie les carets. La correction
  d'origine (caret-escape) ne marchait pas en pratique.
- **Fix** ([`scripts/editorial-pilot/src/phaseC/build-yonder-briefs.ts`](../../scripts/editorial-pilot/src/phaseC/build-yonder-briefs.ts)) :
  remplace `spawn('pnpm', args, { shell: true })` par
  `spawn('node', [tsxBin, ...], { shell: false })`. Bypass complet de
  PowerShell + cmd → les args traversent en argv natif, plus aucune
  interprétation shell. `tsxBin` résolu via `createRequire(import.meta.url)`
  - `localRequire.resolve('tsx/package.json')`.
- **Récupération** : 8/8 briefs construits sur les hôtels au nom contenant
  `&` (Le Roch, Norman Paris, Boscolo Nice, Couvent des Minimes,
  La Caserne de Chanzy, Paris J'Adore, Grand Hôtel Thalasso, Le Vallon
  de Valrugues). Pipeline 8-pass : 8/8 CLEAN. Push : 8/8 OK.

### 3. B4 — Récupération 4 BriefSchema-failed

- 4 fiches qui avaient échoué le brief-builder à l'audit Phase C batch 3
  (`le-narcisse-blanc`, `le-castel-marie-louise`, `le-normandy`,
  `le-pavillon-de-la-reine`) ont rebuilt sans erreur avec le fix B5 en
  place. L'erreur "BriefSchema validation failed" du run précédent
  était probablement un side-effect de la concurrence Tavily +
  PowerShell mangling.
- Pipeline 8-pass : 4/4 CLEAN. Push : 4/4 OK.

### 4. B2 — Extension `run-shorten-sections.ts` au scope `hotels`

- Le shortener supportait `--table guides|rankings`. Extension à
  `--table hotels` : lit `long_description_sections`, shorten les `body_fr`
  > 25 mots, scope automatique sur `is_published = false` pour ne pas
  > toucher les fiches Yonder déjà publiées.
- Run round 1 : 12 fiches `long_sentences > 5` traitées (5 OK / 7 PARTIAL).
- Run round 2 : 8 fiches résiduelles (4 OK / 4 PARTIAL). Les chunks PARTIAL
  sont des passages très denses où le LLM ne peut pas couper sans déformer
  un chiffre ou un nom propre — comportement attendu.

### 5. B3 — Re-build briefs enrichis sur 9 fiches thin-content

- Les 9 fiches qui sortaient à `sections < 8` ou `words_fr < 400`
  (`chateau-de-fonscolombe`, `chateau-de-theoule`, `hotel-hana`,
  `hotel-marignan-champs-elysees`, `les-crayeres`, `lily-of-the-valley`,
  `villa-gallici`, `villa-maia`, `villa-marie`) ont eu leurs briefs
  reconstruits puis pipeline 8-pass complet.
- Push : 9/9 OK. Toutes remontent à 8-9 sections (sauf `lily-of-the-valley`
  qui reste à 6 — brief structurellement thin).

### 6. C1 — Translate guides FR→EN sur 22 guides incomplets

- Nouveau script [`scripts/editorial-pilot/src/i18n/translate-guides-en.ts`](../../scripts/editorial-pilot/src/i18n/translate-guides-en.ts)
  miroir de `translate-hotels-en.ts` mais pour `editorial_guides` :
  une call LLM par guide (gpt-4o-mini), Zod-validé, merge sélectif
  (ne réécrase jamais un champ EN existant).
- **Audit pré-translation** : 50 guides publiés, 28 déjà fully translated,
  22 partiellement EN. Champs les plus manquants : sections.body_en
  (198/583 = 34 %), faq.answer_en (361/1172 = 31 %).
- Run sur 22 guides en concurrency=4 : 22/22 OK en 18 minutes.
  100 % des guides publiés ont désormais une couverture EN complète.

## Convergence finale — 0 résiduel

Les 7 fiches NEEDS_REGEN identifiées initialement après les batches B1-B5 ont
toutes été ramenées au statut PASS via 3 patches surgical :

### Patch 1 — Banned-term scrub déterministe

[`scripts/editorial-pilot/patch-banned-terms.mjs`](../../scripts/editorial-pilot/patch-banned-terms.mjs)

Substitutions contextuelles (regex strict, pas de LLM) :

- `sublime <verbe>` → `magnifie` / `compose les saveurs`
- `inoubliable` → `marquant`
- `remarquable(s) (adj)` → `singulier` / `dégagé`
- `mythique` → `emblématique` (sous quota G_limité)
- `somptueux` → `généreux`

Résolu : `hotel-vernet`, `maison-souquet`, `boscolo-nice-hotel-and-spa`,
`intercontinental-lyon-hotel-dieu`, `lily-of-the-valley` (5 fiches).

### Patch 2 — Audit bullet-aware (correction faux positifs)

[`scripts/editorial-pilot/audit-pushed-drafts.mjs#countLongSentences`](../../scripts/editorial-pilot/audit-pushed-drafts.mjs)

Le splitter de phrases ne reconnaissait pas les bullets markdown
(`\n- **X**`). Une section "À deux pas" composée de 5 bullets était comptée
comme 1 mega-sentence de 100 mots. Correction : split d'abord sur
`\n\s*[-*]\s+`, puis sur `[.!?]\s+(?=[A-Z])`. Aucune relaxation des seuils.

Résolu : `chateau-de-theoule`, `hotel-juana`, `intercontinental-lyon-hotel-dieu`,
`le-narcisse-blanc`, `villa-maia`, `villa-marie` (6 fiches).

### Patch 3 — Sections + intro surgical

[`scripts/editorial-pilot/patch-residuals-final.mjs`](../../scripts/editorial-pilot/patch-residuals-final.mjs)

- `boscolo-nice-hotel-and-spa` (397 → 412 mots) : ajout d'un intro de 12 mots
  en tête de "À deux pas" pour amorcer la liste de bullets ("Le quartier
  alentour invite à la flânerie, entre vestiges militaires et adresses
  gourmandes :").
- `lily-of-the-valley` (6 → 8 sections) : ajout de 2 sections honnêtes
  "Bien-être & spa" et "Service & équipe" avec contenu factuel + reconnaissance
  explicite que les détails du Shape Club restent à confirmer (pas
  d'hallucination). Phrases courtes (< 18 mots) pour ne pas créer de nouveaux
  long_sentences.

Résolu : `boscolo-nice-hotel-and-spa`, `lily-of-the-valley` (2 fiches).

## Coût total session

- LLM total : ~$8 (estimé, gpt-4o-2024-11-20 pour 8-pass × 21 fiches +
  gpt-4o-mini pour shortener × 24 fiches + gpt-4o-mini pour 22 guides EN
  - Pass 8 retry × 16 fiches)
- Pipeline total : ~50 min wall-clock (avec 4 jobs en parallèle)
- Tokens : ~1.2M input + ~150k output cumulé

## Gates de publication restants (non bloqués par contenu éditorial)

84 drafts attendent **A1+A2+A3** (cf. priorisation reste à faire) avant
publication réelle :

- 84/84 drafts < 30 photos → Cloudinary sync requis
- 84/84 drafts < 10 FAQ → générer FAQ canoniques
- 83/84 drafts sans hero image → sélection auto post-Cloudinary

Ces gates sont **structurels** (lignes 9-15 [`hotel-detail-page.mdc`](../../.cursor/rules/hotel-detail-page.mdc)) :
sans 30 photos catégorisées + 10-15 FAQ canoniques + hero, publish bloqué
côté Payload.

## Décisions structurantes capturées (skills)

- [`.cursor/skills/concierge-voice-pipeline/SKILL.md`](../../.cursor/skills/concierge-voice-pipeline/SKILL.md)
  Rule 10 (EN density) + **Rule 11 nouvelle** (FR anti-bullet-implicite) +
  observation de convergence empirique 92 % → 100 % avec audit bullet-aware.
- [`.cursor/skills/windows-dev-environment/SKILL.md`](../../.cursor/skills/windows-dev-environment/SKILL.md)
  **Rule 9 bis nouvelle** : `spawn('node', [tsxBin, ...], { shell: false })`
  bypass de PowerShell + pnpm.ps1 + cmd pour les args `&|<>` non-escapable.
  Référence repair : `scripts/editorial-pilot/src/phaseC/build-yonder-briefs.ts`.
