# 🗺️ Roadmap MyConciergeHotel.com — v2 (validée Cursor, 17 juin 2026)

> ⚠️ **Superseded par [`PROJET-MASTER-PLAN.md`](PROJET-MASTER-PLAN.md)** —
> le plan maître consolide cette roadmap, le cap, les 4 gates, la boucle
> d'apprentissage et la cadence de travail. Référez-vous-y comme source de
> vérité unique. Ce fichier reste pour l'historique du raisonnement.
>
> v2 du plan d'exécution. Reprend la roadmap PO du 17 juin, validée et
> corrigée par Cursor après challenge stratégique. Exécution **100 % via
> Cursor**, développeur **seul**.

---

## 🔒 Décisions stratégiques verrouillées (PO, 17 juin)

Après contre-thèse de Cursor (« tranche fine jusqu'au revenu ») et arbitrage PO :

| Question                            | Décision PO                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| Objectif n°1 à 6 mois               | **Revenu (A) + Trafic GEO/organique (D)**                     |
| Largeur vs profondeur               | **Complétude horizontale** — les 2221 au niveau cible d'abord |
| Booking manuel concierge maintenant | **Non — tout le booking reste gelé**                          |
| Barre « niveau Gordes »             | **Universelle** — Gordes partout, quel qu'en soit le coût     |

**Réconciliation de la tension A (revenu) × booking gelé :** dans cette
roadmap le revenu n'est PAS une feature de réservation. Le revenu = trafic
GEO/organique (D) → **funnel concierge → lead capté**. Donc :

> **La capture de lead n'est pas du booking** (pas de paiement, pas de GDS,
> pas d'inventaire — c'est le « Réserver via le Concierge » de AGENTS.md
> §4ter, _in scope_). Elle DOIT fonctionner même booking gelé, sinon le
> trafic GEO rebondit. → carte **R1.5** ajoutée.

---

## 📊 Métriques de succès (sinon « fini » n'a pas de sens)

- **D / trafic** : sessions organiques SEO + citations LLM (GEO) mesurées.
- **A / revenu (proxy phase contenu)** : **volume de leads concierge captés**
  (`email_requests`) — la conversion réelle € arrive post-gel booking.
- **Qualité** : % du catalogue passant l'audit R0 (CDC ≥ 95, gates `kit.*`
  verts, `geo_qa` présent, JSON-LD valide, 0 fuite `LEAK_MARKERS`).
- **Apprentissage** : **taux de pass au premier essai par vague**, qui doit
  **croître** vague après vague (preuve que la boucle de montée en compétence
  fonctionne — cf. §Montée en compétence autonome).

---

## ⭐ Principe directeur — « un seul passage » (conservé)

Un objet (fiche, lieu, guide, classement) n'est touché **qu'une fois** et
ressort **COMPLET** (contenu + Schema + `geo_qa` + maillage). DoD GEO non
négociable, intégrée à chaque carte contenu.

**Clauses de réconciliation ajoutées par Cursor :**

- **Photos ∈ DoD (décision « universel »)** mais le sourcing photo est le
  **goulot calendaire réel** (≈ 66 000 photos pour 2221 × 30). → workstream
  **PHOTOS** parallèle qui doit rester _en avance_ sur les vagues R2 : une
  ville n'est éligible R2 que si son sourcing photo est fait. On préserve
  ainsi le « single pass » sans calendrier fictif.
- **ADR-0029 reste l'invariant anti-fabrication** — mais en filet, pas en
  excuse. **Intention PO (17 juin) : pas de brodage et pas d'attente de slots
  vides** — la sélection des 2221 a été faite pour que **chaque section
  prévue ait sa matière réelle**. La clause « slot vide » ne sert donc que de
  dernier recours et n'est pas censée se déclencher.
  - **Brodage = inventer un fait** (service, chiffre, distance inexistants) →
    **banni**, toujours.
  - **Expérience signature = exception assumée** : section **d'auteur, curée
    par le Concierge** (expertise, secret opérationnel). La rédiger n'est PAS
    de la fabrication — c'est la valeur ajoutée de marque, légitime même sans
    source web « prouvante ».
  - **Arbitrage du long tail délégué à l'audit R0**, pas à l'opinion : si un
    hôtel promu en masse manque réellement de source sur une section, R0 le
    liste nommément → re-sourcer (Tavily) ou sortir du périmètre Gordes. On ne
    tranche pas à l'aveugle.

---

## 🔁 Montée en compétence autonome (décision PO, 17 juin)

> Le projet doit **gagner en compétence tout seul** : chaque vague apprend de
> la précédente, le système s'améliore au lieu de répéter ses erreurs à
> l'échelle 2221. Le double gate n'est pas qu'un filtre — c'est le **signal
> d'apprentissage**.

**La boucle (après chaque vague R2 / chaque chantier) :**

1. **Le Gate 1/2 produit un rapport d'échecs** (raisons agrégées : telle section
   thin, tel pattern de fuite, telle phrase > 25 mots, tel JSON-LD invalide).
2. **Analyse racine, pas symptôme** : on corrige la **cause** dans le générateur
   / le prompt / le validateur — jamais l'objet à la main en silence.
   - Échec récurrent de prompt → on durcit le prompt LLM (`scripts/editorial-pilot/**/prompts/*.md`).
   - Faux positif/négatif d'un gate → on corrige le validateur (`kit-fiche-acceptance-gates.ts`, gate QA).
   - Bug visuel récurrent → cas de **régression ajouté** (test Playwright `e2e/` ou snapshot) pour qu'il ne revienne jamais.
3. **Capitalisation obligatoire** (règle `skills-capitalisation`) : toute leçon
   non triviale (gotcha vendeur, piège Zod/TS, tactique de prompt qui marche)
   est écrite dans le **skill le plus proche** ou un nouveau skill, cross-linkée,
   - matrice README mise à jour. La session suivante n'en repaie pas le coût.
4. **Mesure du progrès** : le taux de pass au **premier essai** par vague doit
   **monter** (KPI d'apprentissage). S'il stagne, c'est que la boucle 2 n'est
   pas faite.

**Invariant :** corriger un objet à la main sans corriger sa cause amont est
interdit — ça ne scale pas et ça n'apprend rien. Toute correction manuelle
ponctuelle doit s'accompagner d'un ticket « remonter la cause ».

---

## 🔢 Séquence v2 (corrigée)

| Ordre | Carte                     | Rôle                                                                           | Δ vs v1                                         | Statut            |
| ----- | ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------- |
| 1     | ⚙️ **R0**                 | Pilotage : audit catalogue unique = gate de tout                               | —                                               | 🟡 entamé (Lot 0) |
| 2     | 🔧 **R1**                 | Bugs visibles révélés par R0                                                   | —                                               | 🟡 entamé (Lot 1) |
| 3     | 📞 **R1.5**               | **Contact & conformité** : funnel concierge (Brevo) + légal + claims IATA/APST | **NOUVEAU**                                     | À faire (P0)      |
| 4     | 🔌 **INFRA GEO**          | Endpoints agent + llms.txt + indexation                                        | **Reclassé léger** (26 endpoints existent déjà) | À faire           |
| 5     | 🎨 **RFICHE**             | Gabarit pilote Gordes complet (incl. photos + Schema + geo_qa + maillage)      | —                                               | À faire           |
| 6     | 🏛️ **RLIEUX**             | Lieux/POI définitifs                                                           | **REMONTÉ avant R2** (dépendance maillage)      | À faire           |
| 7     | 🏭 **R2**                 | Déploiement gabarit sur 2221, par vagues (gate PHOTOS + audit)                 | —                                               | Prochainement     |
| 8     | 🏆 **RCLASS**             | Classements (assemblage d'entités finalisées)                                  | —                                               | Prochainement     |
| 9     | 🧭 **R3bis**              | Guides destination (enrichissement + dette EN/dédup)                           | dette EN explicitée                             | Prochainement     |
| 10    | 🏨 **R2bis**              | Luxe élargi (non-Palace)                                                       | —                                               | Prochainement     |
| 11    | 🤖 **R3quater**           | Planner IA (orchestration)                                                     | —                                               | Prochainement     |
| —     | 🧊 **PHOTOS**             | Sourcing photo (workstream parallèle, gate R2/R2bis)                           | **explicité**                                   | Continu           |
| 12-14 | 🎫 RPR / 💰 R4 / 🤝 R4bis | Réservable / monétisation / partenaire                                         | gelés, schéma seulement                         | 🧊 Gelé           |

**Dépendances clés :** R0 → R1 → R1.5 ; RFICHE **+** RLIEUX **+** PHOTOS(ville) → R2 ; R2 **+** RLIEUX → RCLASS ; (contenu + INFRA GEO) → R3quater.

---

## 🔧 Les 5 corrections Cursor (filtrées par les décisions PO)

1. **RLIEUX avant R2** (correction de dépendance, pas stratégique). Sinon les
   fiches hors-Paris sortent sans maillage POI (POI inexistants hors des 811
   de Paris aujourd'hui) → réouverture massive = violation « single pass ».
2. **R1.5 Contact & conformité ajoutée** — bridge trafic→revenu (cf. supra).
   Inclut : réparer `/le-concierge/contact` + `/api/agent/contact` (relais
   Brevo réel) + formulaires newsletter/MICE + finaliser mentions légales
   (Atout France IM, garantie financière, RC pro manquants) + auditer les 2
   FAQ qui affirment IATA/APST non vérifiés.
3. **PHOTOS = workstream parallèle explicite** gardé en avance des vagues R2
   (réconcilie « universel photos » + « single pass » + calendrier honnête).
4. **INFRA GEO reclassée légère** : `search`, `hotel/[slug]`, `quote`,
   `places-nearby`, etc. existent déjà (26 routes `/api/agent/*`). Travail =
   consolider/vérifier vs ADR-0017, pas construire.
5. **Calendrier rebâti sur R0** : les dates v1 (R2 = 2221 fiches en 2 sem.)
   sont irréalistes ; on fixe les échéances par vague sur les **chiffres réels**
   de l'audit R0 + le débit photo, pas à l'estime.

---

## 🧱 DoD GEO (gate universel, par objet)

Un objet est « livré » seulement si **tout** est vrai :

- Contenu au gabarit Gordes (15 blocs CDC fiche / structure équivalente lieu/guide/classement).
- Faits **sourcés** (`anchor_facts ≥ 2`/section) ; sinon **slot vide honnête** (ADR-0029, dernier recours).
- **0 fuite** `LEAK_MARKERS`.
- JSON-LD Schema valide (builders `@mch/seo/jsonld/*`).
- **`geo_qa`** présent (existe sur `hotels` via migration 0072 ; à créer pour
  `places`/`guides`/`rankings` en R0 si absent — vérifier avant gate).
- **Maillage interne** câblé (fiche↔POI, classement→entités, guide→hôtels).
- Photos au niveau cible (workstream PHOTOS) — **gate de vague**, pas par-objet bloquant tant que PHOTOS n'a pas couvert la ville.
- **Contrôle obligatoire ci-dessous (4 gates : code + visuel objet + parcours client A→Z + challenge image/présentation) tous verts.**

---

## ✅ Contrôle obligatoire — 4 gates (décision PO, 17 juin)

> Rien de ce qu'on produit (fiche, lieu, guide, classement, page, composant)
> n'est « fait » sans **les quatre gates verts** : code, visuel objet,
> parcours client A→Z, et **challenge image & présentation**. Automatisé
> autant que possible pour tenir l'échelle 2221.

### Gate 1 — Check **code** (automatisé, bloquant)

| Contrôle         | Outil / commande                                                    | Bloquant si                 |
| ---------------- | ------------------------------------------------------------------- | --------------------------- |
| Typecheck        | `pnpm turbo run typecheck`                                          | erreur TS                   |
| Lint             | `pnpm lint`                                                         | erreur ESLint               |
| Tests unitaires  | `pnpm test:unit` (domain/web/integrations)                          | échec                       |
| JSON-LD / Schema | builders `@mch/seo/jsonld/*` + tests Schema                         | invalide                    |
| Gates contenu    | `kit-fiche-acceptance-gates.ts` (`kit.*`), `geo_qa`, `LEAK_MARKERS` | gate rouge / fuite scaffold |
| Build            | `SKIP_ENV_VALIDATION=true … pnpm build`                             | échec build                 |

→ Sur une vague R2, le check code tourne **en lot** sur les objets produits
(script de vague qui agrège les gates par hôtel + un rapport pass/fail).

### Gate 2 — Check **visuel** (semi-automatisé, bloquant sur échantillon)

Règle `user-acceptance-before-commit` appliquée **systématiquement** :

- **Walk navigateur** de l'objet rendu (Playwright/`cursor-ide-browser`).
- **fr + en**, **desktop + mobile**.
- **Capture** attachée au chat / rapport de vague (preuve visuelle).
- **Découvrabilité** : on atteint l'objet en ≤ 2 clics depuis une entrée réelle.
- Échantillonnage à l'échelle : **walk exhaustif du pilote** (RFICHE) puis,
  par vague R2, **walk de N objets/vague** (au moins 1 par ville + tous les
  cas limites signalés par le Gate 1) + capture diff visuelle.

### Gate 3 — Check **parcours client A→Z** (E2E, bloquant à chaque vague)

On ne valide pas que l'objet, on valide que **le chemin réel du client tient
bout à bout** — l'anti-pattern Concierge Club (5 pages parfaites, parcours
invisible) ne doit jamais se reproduire.

**Parcours canonique (phase éditoriale, booking gelé) :**

`arrivée (home / landing GEO / recherche)` → `destination / guide` →
`classement` → `fiche hôtel` → `CTA « Réserver via le Concierge »` →
`/le-concierge/contact` → **soumission formulaire** → **lead créé (Brevo /
`email_requests`)** → page de confirmation.

- Testé **fr + en**, **desktop + mobile**.
- Inclut le **maillage** : chaque saut de lien doit mener quelque part (0 lien
  mort, découvrabilité ≤ 2 clics).
- Inclut le **failure mode** : formulaire vide / honeypot / Supabase down → pas
  de 500, message propre.
- Implémenté en **Playwright** (`apps/web/e2e/parcours-client.spec.ts`) +
  exécuté à chaque vague et en CI. Tout nouveau type d'objet ajoute son saut au
  parcours.

### Gate 4 — Challenge **image & présentation** (qualité de marque, bloquant)

Gate 2 prouve que ça s'affiche ; **Gate 4 prouve que c'est digne d'une marque
de luxe**. On challenge activement le rendu, pas on le constate.

**Standard : « La sélection du Concierge » — premium, sobre, éditorial.**
Réfs : [`EDITORIAL_VOICE.md`](../../EDITORIAL_VOICE.md), skills
`luxury-motion-effects`, `responsive-ui-architecture`, `accessibility`.

| Axe challengé                                         | Question                                                  | Échec si                                                  |
| ----------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **Données / tableaux** (ex. classements, comparatifs) | Est-ce une présentation premium ou un tableau HTML brut ? | Dump tabulaire illisible, non responsive, sans hiérarchie |
| **Hiérarchie visuelle**                               | L'œil est-il guidé (titres, espacements, rythme) ?        | Mur de texte, pas de respiration                          |
| **Image / art direction**                             | Ratios cohérents, qualité, cadrage, pas d'étirement ?     | Photo pixelisée / déformée / mal cadrée                   |
| **Typo & espacement**                                 | Échelle typographique et marges respectées ?              | Incohérences, densité étouffante                          |
| **Cohérence catalogue**                               | Même langage visuel d'un objet à l'autre ?                | Dérive de style entre fiches/vagues                       |
| **Mobile**                                            | Le rendu mobile est-il aussi soigné que desktop ?         | Tableau qui déborde, CTA coupé                            |

**Méthode :** screenshot du rendu → critique contre la grille ci-dessus
(rubrique notée, ex. /5 par axe) → tout axe < seuil = **issue design**
qui repart dans la **boucle de montée en compétence** (corriger le
**composant**, pas l'instance ; ex. refondre `<RankingTable>` une fois pour
toutes, pas maquiller un classement). Les classements/comparatifs ne sont
**jamais** de simples tableaux Markdown — composants dédiés premium.

### Outillage à mettre en place (tâche R0)

- Script **`audit:wave`** : lance Gate 1 en lot sur une liste de slugs, sort un
  rapport `pass/fail` + raisons (réutilise les gates existants).
- Harness **walk visuel** réutilisable (navigate→snapshot→screenshot fr/en ×
  desktop/mobile) branché sur la liste de vague, dépose les captures dans
  `runs/visual/<vague>/`.
- Suite **E2E parcours client A→Z** (`parcours-client.spec.ts`) maintenue à jour
  à chaque nouveau type d'objet, exécutée par vague + en CI.
- Grille **challenge design** (rubrique notée /5 par axe) appliquée sur le
  rendu de chaque type d'objet — issues design = composant à refondre, pas
  instance à maquiller.
- **Aucun `git commit` / « livré »** sans les 4 rapports (code + captures objet + E2E parcours + challenge design) joints.

---

## Journal d'avancement (repris du cap)

- **R0/R1 entamés (17 juin, commits `ce1d822`, `f36c1f5`, `3eae508`)** :
  compteurs catalogue live rafraîchis (2221 / 479 R&C / 633 classements / …),
  dépôt nettoyé (~110 fichiers scratch), bugs visibles corrigés (FAQ home
  rendue, `/a-propos` 404→308, footer `palace`→`palaces-france`, label
  Guides→/destination), identité légale éditeur remplie (Travel Business
  Agency, SASU, RCS Nanterre 991 614 694).
- **Bloqué (entre dans R1.5)** : mentions légales `noindex` tant que Atout
  France IM + garantie financière + assureur RC pro non fournis.
