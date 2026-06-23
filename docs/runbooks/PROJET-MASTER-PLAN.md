# 🧭 MyConciergeHotel.com — Plan maître du projet

> **Source de vérité unique.** Consolide le cap éditorial et la roadmap v2
> (tous deux superseded → renvoient ici). Écrit le 17 juin 2026, après audit
> global + challenge stratégique. Exécution **100 % via Cursor**, fondateur
> **seul**. Esprit : **on redémarre proprement, et on ne s'arrête plus.**

---

## 0. Pourquoi ce document existe

Le projet n'a jamais manqué de vélocité — il a manqué de **cap tenu**. Trop de
chantiers ouverts en parallèle (kit poli sans fin, booking ré-ouvert, fiches
parfaites dans des parcours invisibles) ont donné le sentiment de « ne pas
avancer » malgré des dizaines de commits. Ce plan supprime la dispersion par
trois leviers :

1. **Un cap verrouillé** (§2) qu'on ne rediscute plus.
2. **Un seul passage par objet**, sortie complète, prouvée par **4 gates** (§6).
3. **Une cadence de vague répétable** (§11) — toujours le même rythme, jusqu'à
   la fin du catalogue.

---

## 1. Vision & ambition

**MyConciergeHotel.com — « La sélection du Concierge ».** Agence de voyage en
ligne accréditée IATA, qui sélectionne des hôtels d'exception dans le monde et
publie, pour chacun, la fiche la plus complète et la plus utile du web — avec le
**secret opérationnel du Concierge** que les guides ne donnent jamais.

**Le pari (assumé par le PO) :** la douve est éditoriale + **GEO/AEO** — être la
source que les humains ET les IA (ChatGPT, Perplexity, Google AI) citent sur le
luxe hôtelier. Le contenu se construit **en entier d'abord** ; la monétisation
par réservation se branche **en dernier**.

**État final visé :** les 2221 hôtels + lieux + classements + guides +
itinéraires au **niveau Gordes**, maillés, structurés (Schema), citables par les
agents, dans des parcours client testés de bout en bout, sur une UI digne du
luxe — puis le booking.

---

## 2. Décisions stratégiques verrouillées (ne pas rediscuter sans ADR)

| Sujet                                           | Décision PO (17 juin)                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objectif n°1 à 6 mois                           | **Revenu (A) + Trafic GEO/organique (D)**                                                                                                                                                                                                                                                     |
| Largeur vs profondeur                           | **Complétude horizontale** — les 2221 au niveau cible d'abord                                                                                                                                                                                                                                 |
| Booking maintenant                              | **Non — tout le booking reste gelé** (manuel inclus)                                                                                                                                                                                                                                          |
| Barre qualité                                   | **Niveau Gordes universel** sur tout le catalogue                                                                                                                                                                                                                                             |
| Brodage                                         | **Interdit** ; la sélection garantit la matière réelle de chaque section                                                                                                                                                                                                                      |
| **Ligne d'arrivée du plan** (17 juin)           | **L1 — site éditorial + GEO + leads, bout en bout.** Le produit transactionnel (paiement réel + WhatsApp vivant + multilingue + mobile) = **L2**, briques finales **après** L1. Distance L1↔L2 auditée dans [`audit-contenu-vers-produit-2026-06.md`](audit-contenu-vers-produit-2026-06.md). |
| **Lentille « concierge-consumable »** (17 juin) | Tout objet fini doit être **requêtable par l'agent** (dining/POI/expériences/conseil via l'API), pas seulement rendu en HTML — pour que L2 soit _activable_ sans reprise du contenu. Pliée dans la DoD (Gate 1 `agent_consumable`) + RLIEUX.                                                  |

**Tension assumée (revenu × booking gelé) — résolution :** le revenu de la phase
contenu ne vient PAS d'une feature de réservation, mais du **trafic GEO →
funnel concierge → lead capté**. Donc **réparer la capture de lead n'est pas du
booking** (pas de paiement/GDS/inventaire — c'est le « Réserver via le
Concierge » classé in-scope par AGENTS.md §4ter) et **reste prioritaire** (carte
R1.5).

---

## 3. Métriques de succès (sinon « fini » n'a aucun sens)

- **D — Trafic** : sessions organiques SEO + **citations LLM/GEO** mesurées.
- **A — Revenu (proxy phase contenu)** : **volume de leads concierge captés**
  (`email_requests` / Brevo). La conversion € arrive post-gel booking.
- **Qualité** : % du catalogue passant l'audit (CDC ≥ 95, gates `kit.*` verts,
  `geo_qa` présent, JSON-LD valide, **0 fuite** `LEAK_MARKERS`).
- **Apprentissage** : **taux de pass au premier essai par vague**, qui doit
  **croître** vague après vague (preuve que le système monte en compétence, §7).

---

## 4. État des lieux — ce qui existe déjà (à ne pas reconstruire)

> Les chiffres exacts seront figés par l'audit **R0** ; voici l'inventaire connu
> au 17 juin.

**Contenu / données**

- **2221 hôtels publiés**, 127 pays (479 Relais & Châteaux, 224 Small Luxury,
  127 World 50 Best, 39 Palaces Atout France) — compteurs live dans
  `apps/web/src/lib/catalogue-stats.ts` (rafraîchis ce matin).
- ~633 classements éditoriaux, ~82 guides destination, 23 itinéraires.
- Blocs déjà à ~100 % sur les publiés : `factual_summary`, `meta_desc`,
  `faq` (≥10), `concierge_advice`, `long_description_sections`.
- Dette connue : long tail à source mince (Belmond, R-C APAC…), guides
  `guide-*` FR-only (dette EN), quelques doublons.

**Plateforme (existe, ne pas refaire)**

- Next.js 16 App Router, monorepo pnpm/Turborepo, TS strict.
- Gabarit **kit hôtel** (9 sections) + gates `kit-fiche-acceptance-gates.ts`.
- **26 endpoints `/api/agent/*`** (search, hotel, quote, places-nearby…) +
  `llms.txt` + `agent-skills` (surface GEO déjà largement construite).
- Pipelines éditoriaux `scripts/editorial-pilot/**` (génération, enrichissement,
  audits, prompts).
- Design system / composants UI, i18n fr+en (`next-intl`), Supabase + RLS,
  Cloudinary (22k+ photos cataloguées, alt/catégorie ~99 %), Sentry, CSP nonce.
- Booking **gelé** mais le code adaptateurs (RateHawk/Travelport/Amadeus/GIATA)
  existe derrière feature-flags.

**Ce qui est cassé / bloquant (entre en R1 / R1.5)**

- Funnel concierge : `/le-concierge/contact` stub, `/api/agent/contact` en
  dry-run, formulaires newsletter/MICE morts.
- Mentions légales en `noindex` (données agence manquantes : Atout France IM,
  garantie financière, RC pro).
- 2 FAQ affirmant IATA/APST non vérifiées (risque conformité).

---

## 5. Principes directeurs

1. **Un seul passage.** Un objet n'est touché qu'une fois et ressort COMPLET
   (contenu + Schema + `geo_qa` + maillage + photos). Pas de « j'y reviendrai ».
2. **Anti-dispersion.** Un seul chantier actif à la fois (la vague en cours).
   Tout le reste attend son tour dans la séquence (§8).
3. **Zéro brodage (ADR-0029).** Jamais inventer un fait pour remplir une forme.
   La sélection garantit la matière ; l'**expérience signature** est une section
   **d'auteur** curée par le Concierge (légitime sans source web). Si le long
   tail manque vraiment de source, **l'audit le liste** → re-sourcer ou sortir
   du périmètre. Jamais à l'aveugle.
4. **Prouver, pas affirmer.** Rien n'est « fait » sans les **4 gates verts** (§6).
5. **Apprendre à chaque vague.** Corriger la **cause** (composant/prompt/gate),
   jamais l'instance en silence. Capitaliser en skill (§7).
6. **On ne s'arrête plus.** Cadence de vague répétable (§11) jusqu'au bout.

---

## 6. Les 4 gates de contrôle (obligatoires, par objet / par vague)

> Rien (fiche, lieu, guide, classement, page, composant) n'est livré sans **les
> 4 gates verts**. Automatisé au maximum pour tenir l'échelle 2221.

### Gate 1 — Code (automatisé, bloquant)

Typecheck (`turbo run typecheck`) · Lint (`pnpm lint`) · Tests unit
(`pnpm test:unit`) · JSON-LD/Schema valide (`@mch/seo/jsonld/*`) · Gates contenu
(`kit.*`, `geo_qa`, `LEAK_MARKERS` anti-scaffold, **`agent_consumable`**) · Build.
Lancé **en lot** par vague via `audit:wave` → rapport pass/fail + raisons.

> **Check `gate1.agent_consumable` (lentille concierge, warn).** Ajouté le
> 17 juin (`wave-gates.ts`). Vérifie que la matière dont un concierge WhatsApp /
> un LLM a besoin pour recommander **après** le séjour est présente dans la
> ligne : **conseil du concierge + ≥ 1 POI** (dining/expériences = bonus listés).
> La moitié _exposition API_ (ces champs réellement servis par
> `/api/agent/hotel/[slug]`) est portée par **INFRA GEO**, pas par ce gate.

### Gate 2 — Visuel objet (semi-auto, bloquant sur échantillon)

Walk navigateur de l'objet rendu (Playwright / `cursor-ide-browser`), **fr+en ×
desktop+mobile**, capture jointe, découvrabilité ≤ 2 clics. Walk **exhaustif** du
pilote (RFICHE), puis **N objets/vague** (≥ 1 par ville + tous les cas limites
remontés par Gate 1).

### Gate 3 — Parcours client A→Z (E2E, bloquant par vague)

Le chemin réel tient bout à bout (anti Concierge Club). Parcours canonique
(booking gelé) : `arrivée (home / landing GEO / recherche)` → `destination /
guide` → `classement` → `fiche hôtel` → `CTA « Réserver via le Concierge »` →
`/le-concierge/contact` → **soumission** → **lead créé (Brevo / `email_requests`)**
→ confirmation. fr+en, desktop+mobile, **0 lien mort**, **failure mode** (form
vide / honeypot / Supabase down → pas de 500). Implémenté en
`apps/web/e2e/parcours-client.spec.ts`, exécuté par vague + CI ; chaque nouveau
type d'objet ajoute son saut.

### Gate 4 — Challenge image & présentation (qualité de marque, bloquant)

On **challenge** le rendu, on ne le constate pas. Standard « La sélection du
Concierge » : premium, sobre, éditorial (réfs `EDITORIAL_VOICE.md`, skills
`luxury-motion-effects`, `responsive-ui-architecture`, `accessibility`).
Grille notée /5 par axe : **données/tableaux** (classements/comparatifs =
composants premium dédiés, **jamais** un tableau brut), hiérarchie visuelle, art
direction photo (ratios/cadrage/qualité), typo & espacement, **cohérence
catalogue**, mobile. Une issue design = **refonte du composant** (ex.
`<RankingTable>` une fois pour toutes), pas maquillage de l'instance.

**Règle dure :** aucun `git commit` / « livré » sans les **4 rapports joints**
(code + captures objet + E2E parcours + challenge design).

---

## 7. Montée en compétence autonome (boucle d'apprentissage)

Le projet **gagne en compétence tout seul** : chaque vague apprend de la
précédente. Le 4-gates n'est pas qu'un filtre, c'est le **signal**.

1. Les gates produisent un **rapport d'échecs** (causes agrégées).
2. On corrige la **cause amont** : prompt LLM durci
   (`scripts/editorial-pilot/**/prompts/*.md`), validateur corrigé
   (`kit-fiche-acceptance-gates.ts`), composant refondu, **cas de régression
   ajouté** (E2E / snapshot) pour qu'un bug ne revienne jamais.
3. **Capitalisation obligatoire** (règle `skills-capitalisation`) : toute leçon
   non triviale → skill le plus proche (ou nouveau), cross-linké, README + matrice
   à jour.
4. **KPI** : le taux de pass au 1er essai par vague **monte**. S'il stagne, la
   boucle 2 n'est pas faite.

**Invariant :** corriger un objet à la main sans corriger sa cause est interdit.

---

## 8. La séquence (phases, dépendances)

| Ordre | Carte                                | Objectif                                                       | Statut                    |
| ----- | ------------------------------------ | -------------------------------------------------------------- | ------------------------- |
| 1     | ⚙️ **R0 — Pilotage & audit**         | Audit catalogue unique = gate de tout + outillage des 4 gates  | 🟡 entamé                 |
| 2     | 🔧 **R1 — Bugs visibles**            | Corriger ce que l'audit révèle (front, liens, compteurs)       | 🟡 entamé                 |
| 3     | 📞 **R1.5 — Contact & conformité**   | Funnel concierge réparé (Brevo) + légal + claims IATA/APST     | À faire (P0)              |
| 4     | 🔌 **INFRA GEO**                     | Consolider les 26 endpoints agent + llms.txt + indexation      | À faire                   |
| 5     | 🎨 **RFICHE — Gabarit pilote**       | 1 fiche Gordes parfaite (4 gates), gabarit figé                | À faire                   |
| 6     | 🏛️ **RLIEUX — Lieux/POI définitifs** | POI partout (dépendance maillage R2)                           | À faire                   |
| 7     | 🏭 **R2 — Déploiement masse**        | 2221 fiches au gabarit, **par vagues** (gate PHOTOS + 4 gates) | Prochainement             |
| 8     | 🏆 **RCLASS — Classements**          | Assemblage d'entités finalisées (composant premium)            | Prochainement             |
| 9     | 🧭 **R3bis — Guides destination**    | Enrichissement + dette EN + dédup                              | Prochainement             |
| 10    | 🏨 **R2bis — Luxe élargi**           | Cohortes non-Palace                                            | Prochainement             |
| 11    | 🤖 **R3quater — Planner IA**         | Orchestration agentique sur contenu complet                    | Prochainement             |
| ∥     | 🧊 **PHOTOS**                        | Sourcing photo, **parallèle**, en avance des vagues R2         | Continu                   |
| 12-14 | 🎫 RPR / 💰 R4 / 🤝 R4bis            | Réservable / monétisation / partenaire                         | 🧊 **Gelé** (schéma seul) |

**Dépendances :** R0 → R1 → R1.5 ; RFICHE **+** RLIEUX **+** PHOTOS(ville) → R2 ;
R2 **+** RLIEUX → RCLASS ; (contenu + INFRA GEO) → R3quater.

### Détail par carte

**R0 — Pilotage & audit.** _Livrables :_ rapport d'audit catalogue (par hôtel :
CDC, gates, `geo_qa`, Schema, fuites, photos, maillage, sources thin) ;
outillage des gates (`audit:wave`, harness walk visuel `runs/visual/`, suite
`parcours-client.spec.ts`, grille challenge design) ; vérifier `geo_qa` sur
`places`/`guides`/`rankings` (créer si absent). _DoD :_ l'audit tourne en une
commande et sort la liste priorisée des vagues + le calendrier réel.

**R1 — Bugs visibles.** _Existant :_ déjà entamé (FAQ home, `/a-propos` 308,
footer, label Guides, compteurs, dépôt nettoyé). _Reste :_ tout ce que R0
remonte côté front/liens/découvrabilité. _DoD :_ 4 gates verts sur les pages
touchées.

**R1.5 — Contact & conformité (P0, bridge trafic→revenu).** _Livrables :_
`/le-concierge/contact` fonctionnel ; `/api/agent/contact` → vrai relais Brevo +
`email_requests` ; formulaires newsletter/MICE ré-activés ; mentions légales
complétées (Atout France IM, garantie financière, RC pro) + retrait `noindex` ;
audit des 2 FAQ IATA/APST. _DoD :_ Gate 3 (parcours A→Z finissant sur lead créé)
vert fr+en ; mentions légales indexables.

**INFRA GEO.** _Existant :_ 26 endpoints. _Livrables :_ vérifier vs ADR-0017,
combler les manques, `llms.txt`/`agent-skills` à jour, indexation ; **élargir
`/api/agent/hotel/[slug]`** pour exposer dining (`restaurant_info`), POI/`eat`
(`points_of_interest`), expériences (`signature_experiences`) et `geo_qa` — la
moitié _exposition_ de la lentille concierge (Gate 1 `agent_consumable`). _DoD :_
chaque endpoint annoncé résout (test routes) ; un concierge/LLM peut récupérer en
1 appel de quoi recommander **après** le séjour ; citations testées.

**RFICHE — Gabarit pilote.** _Livrables :_ 1 fiche (ex. Gordes/Paris, POI déjà
présents) amenée au niveau Gordes COMPLET, **4 gates exhaustifs**, gabarit +
prompts + composants figés. _DoD :_ la fiche est la référence ; tout écart en R2
sera mesuré contre elle.

**RLIEUX — Lieux/POI définitifs.** _Pourquoi avant R2 :_ sans POI, les fiches
hors-Paris sortent sans maillage → réouverture massive = violation « single
pass ». _Sous-chantiers nommés (audit §4) :_ (a) **restaurants `eat` à proximité**
— le bucket existe mais n'est pas alimenté (food exclue du sourcing `places`),
c'est la matière des messages « table à réserver » du concierge ; (b)
**générateur `geo_qa`** — aujourd'hui aucun pipeline ne le produit (seul l'audit
le contrôle), à outiller en batch. _DoD :_ POI structurés + `eat` + `geo_qa` +
maillage fiche↔POI prêts pour R2.

**R2 — Déploiement masse.** _Méthode :_ vagues par ville/cohorte ; une vague
n'est éligible que si **PHOTOS(ville)** est fait ; chaque vague passe les 4 gates

- alimente la boucle d'apprentissage. _DoD :_ rapport de vague (4 gates) + taux
  de pass 1er essai en hausse.

**RCLASS / R3bis / R2bis / R3quater.** Mêmes principes : entités finalisées →
assemblage → 4 gates. RCLASS impose le **composant classement premium** (Gate 4).
R3bis solde la **dette EN** des guides + dédup. R3quater n'arrive qu'une fois le
contenu + INFRA GEO complets.

---

## 9. Workstream PHOTOS (parallèle, gating)

Décision « Gordes universel » ⇒ photos **dans la DoD**. Mais c'est le **goulot
calendaire** (~66 000 photos pour 2221 × 30, sourcing légal/semi-manuel). Donc :

- chantier **parallèle** qui doit rester **en avance** des vagues R2 ;
- une ville/cohorte n'est **éligible R2** que si son sourcing photo est terminé ;
- respecte le « single pass » sans calendrier fictif ;
- legal hygiene + Cloudinary + alt enrichi + `ImageObject` (skill `photo-pipeline`).

---

## 10. Booking — gelé jusqu'à la fin (rappel de périmètre)

Hors scope tant que le catalogue n'est pas livré : `Offer`/`priceValidUntil`
JSON-LD, widget de réservation, funnel `/recherche→/checkout` avec GDS,
comparateur de prix, sentiments Amadeus, calcul de tier loyalty depuis
historique, indicateurs d'urgence, iframe paiement, idempotency booking. **Y
compris le booking manuel** (décision PO). Le code adaptateurs reste derrière
flags, en référence. Ré-ouverture = cartes RPR/R4/R4bis, après le contenu.

---

## 11. Cadence de travail — « on ne s'arrête plus »

Le même rythme, vague après vague, jusqu'au bout du catalogue :

1. **Choisir la vague** (selon la priorisation R0 ; une seule active).
2. **Vérifier le prérequis PHOTOS** (sinon, c'est PHOTOS la tâche).
3. **Produire** au gabarit figé (RFICHE), single-pass, zéro brodage.
4. **Passer les 4 gates** (code + visuel + parcours A→Z + design).
5. **Apprendre** : corriger les causes (prompt/gate/composant), capitaliser en
   skill, ajouter les régressions.
6. **Rendre le rapport de vague** (4 rapports + ce que le système a appris + KPI
   pass 1er essai).
7. **Commit/walk** (règle `user-acceptance-before-commit`) → **vague suivante**.

Aucune nouvelle initiative n'ouvre un 2e chantier : elle entre dans la séquence
(§8) ou attend. C'est ça qui supprime le sentiment de stagnation.

---

## 12. Risques & mitigations

| Risque                                     | Impact                    | Mitigation                                                                               |
| ------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------- |
| **Débit photo** (goulot)                   | Bloque R2                 | Workstream parallèle en avance ; vagues gated photo ; sourcing priorisé top cohortes     |
| **Coût LLM/Tavily/Perplexity** à l'échelle | Cash                      | Cache disque par slug, batchs, ne régénérer que les gaps (réconciliation wanted/present) |
| **Bande passante review solo**             | Goulot humain             | Gates automatisés (Gate 1) + échantillonnage (Gate 2/4) ; rapports synthétiques          |
| **GEO = canal non contrôlé**               | ROI trafic incertain      | Mesurer citations + sessions ; garder le funnel lead prêt à monétiser dès Phase booking  |
| **Perfectionnisme du gabarit**             | Ne jamais sortir la masse | RFICHE figé = irréversible sauf ADR ; après, on déploie                                  |
| **Dérive de scope**                        | Retour de la dispersion   | §2 verrouillé + §11 un seul chantier actif                                               |

---

## 13. Gouvernance & source de vérité

- **Ce document** est la référence. Le cap et la roadmap v2 y renvoient.
- Toute décision structurante (changement de séquence, de barre qualité, de
  périmètre booking) passe par un **ADR** (`docs/adr/`).
- Les leçons techniques vivent dans `.cursor/skills/` (capitalisation continue).
- Le suivi d'avancement se tient dans le **journal** ci-dessous.

---

## 14. Journal d'avancement

- **17 juin — R0/R1 entamés** (commits `ce1d822`, `f36c1f5`, `3eae508`) :
  compteurs catalogue rafraîchis (2221 / 479 R-C / 633 classements / 82 guides),
  dépôt nettoyé (~110 fichiers scratch + `.gitignore`), bugs visibles corrigés
  (FAQ home rendue, `/a-propos` 404→308, footer `palace`→`palaces-france`, label
  Guides→/destination), identité légale éditeur remplie (Travel Business Agency,
  SASU, RCS Nanterre 991 614 694).
- **Bloqué (R1.5)** : mentions légales `noindex` tant que Atout France IM +
  garantie financière + assureur RC pro non fournis (donnée non-codable, en
  attente PO).
- **17 juin — R0 outillage des 4 gates livré (typecheck + 9 tests verts)** :
  - Gate 1 (contenu) : `scripts/editorial-pilot/src/quality/wave-gates.ts`
    (compose `evaluateHotelFiche` + ajoute les 2 checks manquants du plan :
    `gate1.geo_qa_present` (DoD, migration 0072) et `gate1.no_leak` (ADR-0029,
    `LEAK_MARKERS`)) + CLI `audit-wave.ts` + script `audit:wave` (rapport
    pass/fail par vague dans `runs/`, exit 1 si blocker) + tests unitaires.
  - Gate 3 (parcours) : `apps/web/e2e/parcours-client.spec.ts` (funnel A→Z,
    fr+en, mobile, failure-mode 404≠500).
  - Gate 4 (image) : `docs/runbooks/gate4-design-challenge-rubric.md` (grille
    notée /5, refonte composant pas instance).
  - Gate 2 (visuel) : réutilise le harness screenshots Playwright existant
    (`playwright.prod.config.ts`, `wave5-kit-rule6-walk`).
  - **Validé end-to-end contre Supabase live** (échantillon 60 publiés) :
    l'outil tourne, et ses checks délégués (`publish`/`indexable`/`t3`)
    coïncident avec l'audit canonique (`audit:hotel-fiches`) — cross-check sur
    `les-airelles-gordes`.
  - **Findings R0 (handoff R1 / learning loop)** :
    1. **~42 % de fuites scaffolding** (`gate1.no_leak` : 25/60) dans
       `long_description_sections[].body_*` et `concierge_advice.*.body` —
       dette ADR-0029 réelle, à nettoyer.
    2. **Le cleaner existant `descaffold:sections` ne couvre que le FR**
       (`description_fr`, `body_fr`, `summary_fr`) — les fuites EN +
       `concierge_advice` trouvées par R0 ne sont PAS traitées → à étendre.
    3. **`gate1.publish` (T0 strict) diverge du gate Phase-1** réellement
       utilisé pour publier ; pass rate ≈ 0 % = distance au niveau Gordes,
       pas un bug (documenté dans `wave-gates.ts`).
  - **Fix learning-loop appliqué** : `descaffold-sections.ts` importe
    désormais `hasLeak` du module partagé `scaffolding-gate.ts` (fin de la
    copie locale du regex qui pouvait dériver).
  - **Reste R0 (décision/accès requis)** : (a) faire tourner `audit:wave`
    sur tout le catalogue pour la liste priorisée des vagues ; (b) migrations
    `geo_qa` sur `places`/`guides`/`rankings` (prod, forward-only).
- **17 juin — Audit « du contenu au produit » + verrouillage L1** :
  - Question PO : « si on applique le plan, le projet est livré bout en bout ? »
    → \*\*Non : le plan livre L1 (éditorial + GEO + leads), pas L2 (paiement réel
    - WhatsApp vivant).\*\* Audit écrit, sourcé code, dans
      [`audit-contenu-vers-produit-2026-06.md`](audit-contenu-vers-produit-2026-06.md)
      (2 passes `explore` : pile transactionnelle = stubs/flags, paiement ABSENT,
      runtime WhatsApp 0 %, seul chemin de réservation vivant = Travelport
      sandbox sous flag ; lead vivant = demande concierge email).
  - **Décision PO : verrouiller L1.** L2 (réservation + WhatsApp + multilingue
    - mobile) = briques finales après L1.
  - **Lentille concierge pliée dans la DoD** (audit §4) :
    - Nouveau check **`gate1.agent_consumable`** (warn) dans `wave-gates.ts` :
      conseil concierge + ≥ 1 POI présents (dining/expériences = bonus listés) ;
      moitié _exposition API_ portée par INFRA GEO. Tests verts (12/12),
      typecheck clean.
    - **INFRA GEO** étendu : `/api/agent/hotel/[slug]` doit exposer
      dining/POI/`eat`/expériences/`geo_qa`.
    - **RLIEUX** : sous-chantiers nommés = restaurants `eat` à proximité +
      générateur `geo_qa` (aujourd'hui non outillé).
