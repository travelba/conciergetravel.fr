# Briefs Cursor — prompts prêts à coller

> Un lot = une branche = une PR = une porte d'acceptation. Chaque brief se colle
> tel quel dans Cursor, précédé du bloc de contexte commun.

---

## Le bloc de contexte commun — à coller en tête de CHAQUE mission

Il compense ce qu'un agent frais ne sait pas et neutralise des erreurs déjà
payées. Ne pas l'abréger.

```text
CONTEXTE COMMUN (obligatoire, ne pas dévier) :

PROJET
- Repo : C:\Users\benja\Projects\conciergetravel.fr — monorepo pnpm + Turborepo,
  Next.js 16 App Router, TypeScript strict, Supabase.
- Lis dans l'ordre : AGENTS.md, puis docs/cadrage-2026-08/01-cadrage-A-E.md,
  puis docs/cadrage-2026-08/03-architecture-cible.md.
- Le cadrage d'août 2026 prime sur tout plan antérieur. Les documents sous
  docs/_archive/ sont de l'histoire : ne les exécute pas.

ENVIRONNEMENT
- Windows + PowerShell : utilise curl.exe (jamais l'alias curl), pas de heredoc
  bash. Voir .cursor/skills/windows-dev-environment/SKILL.md.
- DB : passe par PostgREST (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
  Les scripts `pg` directs échouent sur cette machine (DNS IPv6). Les SELECT
  full-catalogue à colonnes lourdes timeout : pré-filtre sur les slugs, puis
  --slugs=.

RÈGLES DURES (non négociables)
- Pas de `any`, pas de `as Foo`, pas de `!` non-null.
- Pas de `dangerouslySetInnerHTML` hors du composant serveur JsonLdScript.
- Aucune PII dans les logs.
- Pas d'import qui traverse une couche (domain n'importe ni fetch, ni next/*,
  ni @supabase/*).
- Migrations forward-only : on n'édite jamais une migration appliquée.
- Des clés i18n, jamais de chaînes en dur — messages d'erreur inclus.
- Aucun JSON-LD Offer, aucun prix ou dispo en direct, aucun appel vendor dans le
  chemin de rendu d'une page publique (le booking est gelé jusqu'à la Phase E).

CONTENU
- Tout texte généré passe hasLeak()
  (scripts/editorial-pilot/src/enrichment/scaffolding-gate.ts) AVANT persistance.
- Toute génération est ancrée DataForSEO (groundHotel / groundKeywords, cache
  data/dfs-cache/). Si DataForSEO est indisponible : log `grounding=off`, marquer
  non ancré, ne jamais publier comme ancré.
- Dry-run d'abord, toujours. Lots de 20-30 entités maximum, re-audit après
  chaque lot.

ACCEPTATION
- Avant tout commit d'un changement visible par un utilisateur : marche la page
  comme un utilisateur réel (prod ou preview, curl.exe si pas de navigateur),
  FR ET EN, mobile ET desktop, et rapporte les URLs parcourues + les preuves.
  Règle .cursor/rules/user-acceptance-before-commit.mdc.

GIT
- Une branche dédiée par lot (nom donné dans le brief), Conventional Commits,
  petits commits. JAMAIS de push sur main.
- N'écris AUCUN fichier hors de la zone d'écriture déclarée dans ton brief.

ARRÊT
- Si tu rencontres une décision de gouvernance (périmètre, suppression de
  données, dégel du booking, indexabilité) : STOP, remonte au PO. Tu ne
  tranches pas.

FIN DE TÂCHE
- Rapport : ce qui a été fait / les preuves / les manques restants.
```

---

## Règle des zones d'écriture

Deux agents n'écrivent **jamais** dans le même dossier. C'est la seule
contrainte qui rend le parallélisme sûr, et elle a été éprouvée en juillet.

| Lane              | Zone d'écriture exclusive                                                     |
| ----------------- | ----------------------------------------------------------------------------- |
| **Plateforme**    | `apps/web/src/{app,components,server,lib}`, `packages/{seo,ui,observability}` |
| **Contenu**       | `scripts/editorial-pilot/`, écritures en base                                 |
| **Documentation** | `docs/`, `AGENTS.md`, `.cursor/`                                              |
| **Données**       | `packages/db/migrations/`                                                     |

Au maximum **deux lanes en parallèle** dans ce recadrage. Le pic à 5-6 agents de
juillet a produit des zones qui se chevauchaient et du temps de merge — on ne
recommence pas.

---

# PHASE A

## A1 — ADR de recadrage

**Branche** `chore/adr-0032-recadrage` · **Zone** `docs/adr/`

```text
Rédige docs/adr/0032-recadrage-perimetre-aout-2026.md au format des ADR
existants (regarde 0031 comme modèle).

Il grave six décisions PO. Le PO te donne les réponses ; toi tu écris le
contexte, les forces en présence, les conséquences et ce que la décision ferme :

A0-1 Produit = média + mise en relation jusqu'à la Phase E (pas une OTA).
A0-2 Abandon de la complétude horizontale sur les 2 221 fiches → investissement
     ciblé (~150 fiches, ~50 classements).
A0-3 Outreach humain : engagement 3 h/semaine, ou renoncement assumé.
A0-4 Un seul template de fiche (kit OU standard) — l'autre est supprimé.
A0-5 Verticales actives : hôtels, classements, guides, club. Gelées : lieux,
     itinéraires, marques, labels, annuaire.
A0-6 Locales FR + EN jusqu'à la porte D.

Contrainte importante : cet ADR AMENDE explicitement le pari « complétude
horizontale » de docs/runbooks/PROJET-MASTER-PLAN.md (17 juin). Dis-le
clairement dans une section « Ce que cet ADR change » — c'est le point de
contradiction principal du projet et il ne doit pas rester implicite.

Ne touche à aucun autre fichier.
```

## A2 — Un seul chiffre de catalogue

**Branche** `fix/catalogue-count-single-source` · **Zone** `apps/web/src/lib`, `packages/seo`

```text
Le site affiche trois chiffres différents pour la taille du catalogue :
2 219 (AGENTS.md), 2 929 et 2 984 (llms.txt, home). C'est un signal de
non-fiabilité sur la surface publique.

1. Trouve toutes les occurrences d'un compte d'hôtels/pays codé en dur ou
   calculé localement (apps/web, packages/seo, llms.txt, AGENTS.md, README).
2. Établis une source unique : lib/catalogue-stats.ts, alimentée par une requête
   comptée en base, mise en cache via unstable_cache (TTL 3600, tag
   'hotels-catalogue' — le motif existe déjà dans server/destinations/cities.ts).
3. Fais consommer cette source par tous les points d'affichage.
4. Ajoute un test qui échoue si un nombre à 4 chiffres suivi de « hôtels » /
   « hotels » apparaît en dur dans apps/web/src ou packages/seo/src.

Acceptation : curl.exe sur la home, /hotels, /llms.txt et la page à-propos, en
FR et EN — le même chiffre partout. Rapporte les 4 valeurs constatées.
```

## A3 — Purge des artefacts

**Branche** `chore/purge-artefacts` · **Zone** racine, `.gitignore`

```text
~36 Mo d'artefacts binaires sont versionnés sans être importés par le code.

1. Vérifie d'abord, par grep sur apps/ packages/ scripts/, qu'AUCUN code ne
   référence DA/, design/_compare/ ou design/stitch/. Si un import existe,
   STOP et remonte.
2. Supprime : DA/ (15 Mo, quasi-doublon de design/html-kit — seuls style.css,
   les-airelles-gordes.html et _generated/ diffèrent), design/_compare/ (8,6 Mo),
   design/stitch/ (13 Mo).
3. Avant suppression, copie DA/_generated/ et les deux fichiers divergents dans
   design/html-kit/_from-DA/ — c'est le seul contenu unique de DA/.
4. Ajoute les motifs correspondants au .gitignore.
5. Un seul commit, message explicite : le `git revert` doit tout restaurer.

Ne supprime PAS design/html-kit/ — son sort dépend de l'arbitrage A0-4.
```

## A4 + A5 — Archivage documentaire et préséance

**Branche** `docs/archive-et-preseance` · **Zone** `docs/`

```text
docs/ contient 241 fichiers Markdown dont la plupart sont des photographies
datées. Un agent frais ne peut pas distinguer le vivant du périmé.

1. Crée docs/_archive/ avec un README expliquant : archive, valeur historique,
   NE PAS EXÉCUTER.
2. Déplace (git mv, jamais de suppression) :
   - docs/audits/ en entier (46 fichiers)
   - docs/editorial/, docs/pilots/, docs/le-concierge-club/, docs/design/
   - docs/runbooks/ : roadmap-2026-06-v2, cap-editorial-close-2026-06,
     overnight-2026-05-19, master-plan-multi-agent-2026-07, PROJET-MASTER-PLAN,
     audit-contenu-vers-produit-2026-06, playbook-remediation-post-audit-2026-07,
     gate4-design-challenge-rubric
3. Restent en place : docs/adr/ (jamais d'archivage d'ADR), docs/00-*→10-*,
   docs/03-integrations/, docs/09-checklists/, docs/marketing/, docs/legal/,
   docs/integrations/, docs/cadrage-2026-08/, et les runbooks vivants
   (vercel-setup, domain-migration, i18n-v2-rollout, airelles-reference-fiche-plan).
4. En tête de CHAQUE plan maître archivé, ajoute :
   > ⚠️ ARCHIVE — superseded le 2026-08-02 par docs/cadrage-2026-08/.
   > Valeur historique. Ne pas exécuter.
5. Répare les liens cassés dans README.md et docs/00-conception-et-phasage.md.

Acceptation : `git status` ne montre que des renommages et des ajouts de
bandeaux, zéro suppression. Liste les liens réparés.
```

## A6 — Réduction du contexte agent

**Branche** `docs/agents-md-slim` · **Zone** `AGENTS.md`, `.cursor/`

```text
AGENTS.md fait 1 139 lignes. §4bis et §4ter contiennent ~900 lignes d'historique
de vagues qu'un agent relit à chaque session sans en tirer de décision.

1. AGENTS.md cible ~250 lignes :
   - §1 ce qu'est le projet (10 lignes)
   - §2 le layering (le schéma, inchangé)
   - §3 la table d'aiguillage (garde, allège)
   - §4 les hard rules (garde INTÉGRALEMENT — code, contenu, booking, process)
   - §5 renvoi vers docs/cadrage-2026-08/ pour tout ce qui est plan et phasage
   - opérationnel : commandes, hygiène de commit
2. Déplace §4bis + §4ter en entier vers docs/_archive/agents-md-historique.md
   avec un bandeau. La matrice de progression pondérée y va aussi — elle est
   remplacée par les KPI de 05-gouvernance-et-kpi.md.
3. Audite .cursor/rules/*.mdc (30) : liste les chevauchements de globs
   (ADR-0028 en documente déjà), propose des fusions, cible ~15.
4. Audite .cursor/skills/ (48). SUPPRIME : mobile-app-expo,
   whatsapp-concierge-journey, mcp-server-development, luxury-motion-effects.
   GELE (bandeau « Phase E ») : amadeus-gds, little-hotelier, booking-engine,
   payment-orchestration, loyalty-program, competitive-pricing-comparison,
   itinerary-editorial-pipeline. Cible ~25.

Ne supprime aucune hard rule. En cas de doute sur une règle, garde-la et
signale-la.
```

## A7 — Instrumentation zéro

**Branche** `feat/observability-branchee` · **Zone** `apps/web/src/server`, `packages/observability`

```text
@mch/observability (pino + rédaction PII) existe, est correct, et n'est importé
NULLE PART. La production journalise en console.*. Et surtout : le nombre de
demandes concierge reçues n'est mesuré par rien.

1. Branche le logger pino sur les chemins serveur chauds : get-hotel-by-slug,
   les routes /api/agent/*, le handler de contact. ~15 fichiers.
2. Remplace les console.* de ces chemins. Vérifie qu'aucune PII ne transite
   (hard rule 3) — le module de rédaction existe, utilise-le.
3. Pose un compteur de demandes concierge : chaque soumission de contact_requests
   émet un événement journalisé (sans PII) et incrémente un compteur requêtable.
4. Documente en 10 lignes, dans docs/runbooks/, comment lire ce compteur.

Acceptation : soumets une demande de test en préproduction, montre la ligne de
log et la valeur du compteur. Zéro PII dans la sortie.
```

---

# PHASE B

## B1 — Un seul template de fiche

**Branche** `refactor/template-fiche-unique` · **Zone** `apps/web/src/components/hotel`, `apps/web/src/server/hotels`

```text
PRÉREQUIS : l'arbitrage A0-4 doit être rendu et écrit dans l'ADR 0032. Sans lui,
STOP.

Deux templates de fiche coexistent : le « kit » (components/hotel/kit/* +
server/hotels/kit/*, 30+ fichiers) et le standard. Chaque évolution de fiche
coûte donc deux fois.

1. Applique la décision : supprime le perdant, entièrement — composants,
   chargeurs serveur, tests, résolveurs de slug, règles .mdc associées.
2. Le gagnant devient le seul chemin. Supprime les branchements conditionnels
   (is-hotel-kit-slug.ts et ses appelants).
3. Fais tourner les 29 specs E2E. Les specs propres au perdant sont supprimées,
   pas désactivées.
4. Marche 5 fiches variées, FR et EN, mobile et desktop.

Ne « garde pas au cas où ». Le code supprimé reste dans l'historique Git.
```

## B2 — Sécuriser l'injection HTML

**Branche** `fix/sanitize-html-fiche` · **Zone** `apps/web/src/components/hotel`

```text
hotel-page-kit.tsx passe du HTML issu de la base (prefixHtml / mainHtml) à
dangerouslySetInnerHTML. C'est une violation directe de la hard rule n°2 et une
surface d'XSS stocké sur des pages publiques.

Deux options, dans l'ordre de préférence :
(a) parser le HTML stocké et le rendre par composants React typés — la bonne
    solution, plus coûteuse ;
(b) sanitiser à l'écriture ET à la lecture avec une allowlist stricte de balises
    et d'attributs (dompurify est déjà dans les overrides pnpm).

Ajoute des tests avec des charges utiles hostiles : <script>, onerror=,
javascript:, <iframe>, attributs de style avec url().

Acceptation : `grep -rn dangerouslySetInnerHTML apps/web/src` ne renvoie plus
que JsonLdScript. Rendu inchangé sur 3 fiches, avant/après.
```

## B3 — Rate limit fail-closed

**Branche** `fix/rate-limit-fail-closed` · **Zone** `apps/web/src/server/agent`

```text
Dans apps/web/src/server/agent/rate-limit.ts (~L69-80), si Redis est absent ou
qu'Upstash renvoie une erreur, la requête PASSE SANS AUCUNE LIMITE. Une panne
Redis expose donc 26 endpoints publics sans plafond.

1. Inverse le comportement : indisponibilité → 429 (ou 503 avec Retry-After),
   jamais de passage libre.
2. Test unitaire du chemin d'erreur : client Redis qui jette → assertion sur le
   code de statut. Montre-le rouge avant, vert après.
3. Journalise la bascule en fail-closed (sans PII) pour qu'une panne soit
   visible et non silencieuse.
```

## B4 — Un seul prédicat d'indexabilité

**Branche** `fix/indexability-source-unique` · **Zone** `packages/db/migrations`, `apps/web/src/lib`

```text
Le prédicat d'indexabilité existe en double : la RPC SQL
(packages/db/migrations/0078_list_indexable_hotel_slugs_rpc.sql) et le TypeScript
(indexability.ts). Ils peuvent diverger — et la divergence produit des sitemaps
qui listent des pages en noindex, exactement le signal contradictoire qu'on ne
veut pas envoyer à Google.

1. Établis une source unique. Le TS décide, la RPC est générée depuis lui — ou
   l'inverse, mais choisis et documente.
2. Ajoute un test de non-divergence : sur un échantillon de 200 slugs, la RPC et
   le prédicat TS rendent le même verdict. Le test échoue si un seul diffère.
3. Migration forward-only si le SQL change.

Rapporte le nombre de divergences trouvées sur l'échantillon avant correction —
c'est la mesure du bug.
```

## B5 — Retrait des pipelines non conformes

**Branche** `chore/retrait-generateurs-legacy` · **Zone** `scripts/editorial-pilot/src`

```text
Six générateurs tournent sans grounding DataForSEO ni hasLeak(). Ils peuvent
réinjecter du scaffolding dans un corpus qu'on est en train de nettoyer.

SUPPRIME :
1. src/hotels/premium-section-generator.ts (+ son test)
2. src/hotels/description-extend-generator.ts
3. src/concierge/run-humanizer-faq.ts
4. src/guides/generate-guide.ts        (v1 — generate-guide-v2.ts est conforme)
5. src/rankings/generate-ranking.ts    (v1 — generate-ranking-v2.ts est conforme)
6. src/rankings/meta-desc-generator.ts

Avant chaque suppression, vérifie par grep qu'aucun autre script ne l'importe.
Si un import existe, migre l'appelant vers la v2 ou remonte au PO.

Un bandeau « deprecated » ne suffit pas : un agent pressé lance ce qu'il trouve.
```

## B6 — Élagage des scripts

**Branche** `chore/elagage-scripts` · **Zone** `scripts/editorial-pilot`

```text
374 scripts TypeScript. Beaucoup sont des one-shots de campagnes terminées.
Chaque script mort est un piège pour un agent futur.

1. Classe chaque script en trois piles, dans un tableau que tu produis d'abord
   pour validation PO :
   - VIVANT : outillage réutilisable (grounding, enrichment, quality, i18n, les
     runners v2)
   - ARCHIVE : one-shot de campagne terminée → supprimé, l'historique Git suffit
   - DOUBLON : v1 remplacée par une v2
2. Cibles de suppression déjà identifiées : src/yonder/ (15), src/showcase/ (1),
   src/phaseC/ (2), src/import/ (4), src/geocode/ (1).
3. Écris scripts/editorial-pilot/README.md : une ligne par script survivant —
   ce qu'il fait, quand le lancer, ses arguments.
4. Cible ~150 scripts.

Règle de tri : un script sans description écrivable en une ligne est un script
à supprimer. Ne touche pas à src/grounding/ ni à src/enrichment/.
```

## B7 — Charge utile de `/hotels`

**Branche** `perf/hotels-pagination` · **Zone** `apps/web/src/app/[locale]/hotels`

```text
/hotels renvoie 10,4 Mo de HTML et 2 740 liens hôtel, sans pagination. Le TTFB
est bon (30 ms) : c'est un problème de charge utile, pas de latence. Effet :
gaspillage de budget de crawl et page inutilisable en mobile.

1. Pagine, ou éclate par pays avec un index — préserve le maillage, qui est la
   raison d'être de la page.
2. Cible : moins de 500 Ko par réponse.
3. Le maillage complet reste servi par hubs.xml et les pages pays : vérifie
   qu'aucun hôtel ne devient orphelin. C'est le risque principal du lot.
4. rel=prev/next ou une pagination canonique propre.

Acceptation : curl.exe -w '%{size_download}' avant/après. Preuve qu'aucun hôtel
n'a perdu son unique lien entrant (compte les liens avant/après par slug).
```

## B8 — Nettoyage des routes

**Branche** `chore/nettoyage-routes` · **Zone** `apps/web/src/app`

```text
1. /dev/logo-preview et /dev/photo-filter-preview sont exposées en production.
   Supprime-les, ou ferme-les derrière une garde d'environnement.
2. Huit guides pays sont codés en dur (guide/italie, /japon, /maroc, /suisse,
   /thailande, /maldives, /etats-unis, /emirats-arabes-unis) alors que
   guide/[citySlug] existe. Deux chemins pour la même chose.
   → Unifie vers la route dynamique, avec redirections 301 si les URLs changent.
   Si le contenu de ces 8 pages n'existe pas en base, migre-le d'abord.
3. robots.txt bloque /fr/compte/ alors que le chemin FR réel est /compte/.
   Corrige.
4. llms.txt liste des URLs /fr/… qui redirigent toutes en 307 vers la canonique
   sans préfixe. Émets les canoniques.

Acceptation : curl.exe sur les 8 guides pays (200 attendu, ou 301 vers la
nouvelle URL), sur /dev/* (404), et vérification des deux fichiers texte.
```

---

# PHASE C

## C1 — Claims faux (priorité absolue du lot contenu)

**Branche** `fix/claims-palace-atout-france` · **Zone** écritures en base + `scripts/editorial-pilot`

```text
Du contenu factuellement faux est indexé. /en/categorie/palaces-paris cite le
Ritz et le Park Hyatt comme Palaces, annonce « twelve Palaces » et « reviewed
every five years ». La liste officielle Atout France de juin 2026 dit :
33 Palaces dont 13 à Paris, révision tous les 3 ans, et ni le Ritz ni le Park
Hyatt n'en font partie.

1. Établis la liste de référence en base, sourcée (le PDF Atout France de juin
   2026 fait foi).
2. Audite le catalogue : chaque entité affirmant un statut Palace est vérifiée
   contre la liste.
3. Corrige par lots de 20-30, avec --dry-run d'abord. Priorité aux 10 fiches P0
   déjà identifiées (the-berkeley, ritz, claridges, burj-al-arab…) et aux pages
   de catégorie.
4. Règle : chaque claim est SOURCÉ ou RETIRÉ. Pas de nuance, pas de « souvent
   considéré comme ».
5. hasLeak() sur tout texte modifié.

Acceptation : re-audit avant/après sur les entités traitées, marche FR + EN des
pages corrigées, zéro claim Palace non sourcé sur le périmètre traité.
```

## C2 — Mentions légales

**Branche** `fix/mentions-legales` · **Zone** `apps/web/src/app/[locale]/(legal)`, `i18n`

```text
La page mentions légales contient des placeholders [À COMPLÉTER] et elle est
liée depuis le pied de page de TOUTES les pages du site. C'est un risque
juridique et un signal de confiance désastreux.

Deux issues, au choix du PO :
(a) compléter — raison sociale, SIREN, capital, directeur de publication,
    hébergeur, accréditation IATA, médiateur du tourisme, garantie financière ;
(b) retirer le lien du pied de page tant que la page est un brouillon.

Fais (a) si le PO fournit les données, (b) sinon. Ne laisse pas la situation
actuelle. Même traitement pour CGV, confidentialité et cookies s'ils ont le
même défaut — vérifie-les.

Acceptation : marche FR + EN des 4 pages légales, aucun placeholder visible.
```

## C3 + C4 — Purge du français dans l'anglais

**Branche** `fix/parite-en` · **Zone** `apps/web/src/app/[locale]/classement*`, `i18n`, base

```text
L'EN génère déjà plus d'impressions que le FR — c'est la locale qu'on sabote.
Constats en production : /en/classements/lieu/paris affiche « Sélection
éditoriale de 8 hôtels raffinés à/en Paris » (FR brut), « 8-star hotels »
(mistranslation) et des dates « 2023 » périmées.

Deux chantiers, DANS CET ORDRE :

1. DÉTERMINISTE d'abord — chaînes en dur (5 fichiers) :
   classement/[slug]/page.tsx (~L544 et ~L743), classements/page.tsx (~L369),
   classements/[axe]/[valeur]/page.tsx (~L355), et global-error.tsx qui est
   monolingue FR. → clés next-intl.
2. CONTENU ensuite — audit des surfaces EN à la recherche de FR résiduel, de
   mistranslations (« 8-star ») et de dates périmées. Par lots de 20-30, EN
   natif et non traduction littérale, voix Concierge, grounding EN + hasLeak().

Acceptation : 10 pages EN marchées — zéro FR résiduel, zéro mistranslation.
Rapporte les URLs.
```

## C8 — Crawl-focus

**Branche** `seo/crawl-focus-perimetre-reduit` · **Zone** `apps/web/src/lib`, `packages/seo`, sitemaps

```text
PRÉREQUIS : l'arbitrage A0-5 (verticales gelées) doit être écrit dans l'ADR 0032.

Google indexe /destination/dommeldange (1 hôtel) pendant que le-meurice reste
« Discovered, not indexed ». Le budget de crawl part dans la longue traîne vide.

Passe en noindex + retire des sitemaps :
- les destinations de moins de 3 hôtels
- les verticales gelées : /lieux/*, /itineraire/*, /marque/*, /label/*,
  /categorie/*
- les sous-pages de chambres /hotel/[slug]/chambres/[roomSlug]

Utilise le prédicat unique du lot B4 — pas une seconde implémentation.
Tout doit être réversible par une seule bascule.

Acceptation : compte les URLs par sitemap avant/après ; vérifie par curl.exe que
5 pages de chaque famille portent bien le meta noindex ; confirme qu'AUCUNE
page du périmètre retenu n'a été coupée par erreur — c'est le risque du lot.
Après merge : resoumission GSC (lot D7).
```

---

# PHASE D

## D1 + D2 — CTA universel et funnel de demande

**Branche** `feat/cta-concierge-universel` · **Zone** `apps/web/src/components`, `apps/web/src/app`

```text
PRÉREQUIS : arbitrage A0-1 (média + mise en relation) écrit.

Le bouton « Réserver » est désactivé sur la majorité du catalogue. C'est le
principal appel à l'action du site, et il est mort. Le seul revenu accessible
aujourd'hui — la demande concierge traitée à la main — n'a donc pas de porte
d'entrée fiable.

1. Remplace tout CTA de réservation par « Demander au Concierge », actif sur
   100 % des fiches. Zéro bouton disabled sur tout le site.
2. Le CTA mène au formulaire de demande, pré-rempli avec l'hôtel concerné.
3. Le parcours complet fonctionne : soumission → e-mail à l'opérateur →
   accusé de réception au client. Les templates existent dans packages/emails,
   vérifie-les de bout en bout.
4. Aucune promesse de prix ni de disponibilité (le booking reste gelé).

Acceptation : marche 10 fiches variées FR + EN, mobile + desktop ; soumets une
demande réelle en préproduction et montre les deux e-mails reçus. Compte les
boutons disabled restants sur le site : doit être 0.
```

## D8 — Matrice lexicale

**Branche** `seo/matrice-lexicale-luxe` · **Zone** `scripts/editorial-pilot/src/rankings`

```text
SEULE création de contenu autorisée par le cadrage.

Le catalogue compte 521 slugs « meilleurs-* » et environ 1 seul « hotel-de-luxe-* »,
alors que le volume de recherche est sur « hôtel de luxe {ville} » et « luxury
hotels {city} » — 10 à 30 fois supérieur. On s'est positionné sur la formulation
qui ne se cherche pas.

1. Vérifie ce delta par DataForSEO avant de produire quoi que ce soit. Si le
   delta n'est pas confirmé, STOP et remonte.
2. Génère la matrice hotel-de-luxe-{ville} (FR) et réoriente titres et H1 EN sur
   « luxury hotels {city} », via le combinator et run-rankings-v2-bulk.
3. Uniquement les villes avec au moins 4 hôtels en inventaire. En dessous, on ne
   crée pas la page.
4. Grounding DataForSEO + gate PAA + hasLeak(). Lots de 20-30.
5. Surveille la cannibalisation avec les slugs meilleurs-* existants : la règle
   anti-cannibalisation s'applique, hiérarchise explicitement.

Acceptation : 10 pages marchées, re-audit, vérification qu'aucune page
meilleurs-* n'a perdu son positionnement au profit d'un doublon interne.
```
