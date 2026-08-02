# Architecture cible — la forme du projet après le recadrage

> Référence permanente pour Cursor. Décrit l'état visé à la fin de la Phase B,
> pas un idéal lointain. Tout ce qui n'y figure pas est gelé ou supprimé.

---

## 1. Le dépôt, après

```
conciergetravel.fr/
├── apps/
│   ├── web/                    Front public — Next.js 16, App Router, RSC
│   └── admin/                  Payload CMS 3 — gelé, maintenu fonctionnel
├── packages/
│   ├── domain/                 TS pur, zéro I/O — les règles métier
│   ├── db/                     Migrations forward-only + RLS + schéma Drizzle
│   ├── integrations/           Clients vendors (7 actifs, 7 gelés)
│   ├── seo/                    JSON-LD, sitemaps, llms.txt, surface agent
│   ├── ui/                     Design system + tokens
│   ├── emails/                 React Email → Brevo
│   ├── observability/          pino + Sentry — BRANCHÉ (ne l'était pas)
│   ├── experiments/            Feature flags — gelé
│   └── config/                 ESLint / TS / Tailwind / env
├── scripts/
│   ├── editorial-pilot/        ~150 scripts, chacun décrit dans son README
│   ├── perf/ · photos/ · bootstrap/ · skills/
├── docs/
│   ├── cadrage-2026-08/        ← LA source de vérité du plan
│   ├── adr/                    33 ADR, jamais supprimés
│   ├── 00-*.md → 10-*.md       Documentation de référence
│   ├── runbooks/               Runbooks vivants uniquement
│   ├── marketing/ · legal/     Actionnables
│   └── _archive/               ~180 documents historiques, bandeau explicite
├── design/html-kit/            Une seule référence visuelle (si le kit gagne A0-4)
├── .cursor/
│   ├── rules/                  ~15 règles, globs sans chevauchement
│   └── skills/                 ~25 skills
└── AGENTS.md                   ~250 lignes : hard rules + aiguillage
```

Ce qui a disparu par rapport à aujourd'hui : `DA/`, `design/_compare/`,
`design/stitch/`, ~220 scripts, ~180 documents déplacés en archive, un des deux
templates de fiche.

---

## 2. Le layering — inchangé, et non négociable

```
┌──────────────────────────────────────────────────────────────┐
│  apps/web         apps/admin                                 │
│       ↘             ↙                                        │
│   packages/seo, /emails, /ui, /db, /observability, /config   │
│                       ↑                                      │
│        packages/integrations/<vendor>/  ← Zod, HTTP, Redis   │
│                       ↑                                      │
│              packages/domain/  ← TS pur, aucun I/O           │
└──────────────────────────────────────────────────────────────┘
```

Une couche basse n'importe **jamais** d'une couche haute. `domain` ne connaît ni
`fetch`, ni `next/*`, ni `@supabase/*`. Cette règle est tenue aujourd'hui — elle
a été vérifiée par échantillonnage à l'audit du 2 juillet — et c'est ce qui rend
le code refactorisable. Elle survit intacte au recadrage.

---

## 3. Stratégie de rendu — close, ne pas rouvrir

**Contrat actuel, décidé sur preuve mesurée par ADR-0031 (2026-07-02) :**

| Type de route                       | Rendu                   | Cache                                                             |
| ----------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| Toutes les routes HTML              | `force-dynamic`         | **Aucun cache CDN** — c'est délibéré                              |
| `robots.txt`, `llms*.txt`, sitemaps | statique / `revalidate` | Cache CDN — ces routes n'embarquent aucun script                  |
| Lectures de données catalogue       | —                       | **Data Cache** `unstable_cache`, TTL 3600 s, invalidation par tag |

**Pourquoi le HTML n'est pas caché.** La CSP porte un nonce par requête sous
`strict-dynamic`. Next.js n'estampille pas de nonce dans du HTML prérendu ; sous
`strict-dynamic` l'allowlist `'self'` est ignorée, donc le navigateur bloque
**tous** les scripts — inline et externes. Ce n'est pas une hypothèse : les
4 pages légales étaient en production en `force-static` avec **58 violations CSP
et zéro JavaScript exécuté**. Le mécanisme est mesuré, l'option ISR est morte.

**Où est le levier de performance à la place.** Le Data Cache, avec des gains
déjà obtenus :

| Route                                 | Avant          | Après    |
| ------------------------------------- | -------------- | -------- |
| `/` (home)                            | 2 752 ms       | 114 ms   |
| `/destination` (hub)                  | 2 600-5 900 ms | 163 ms   |
| `/destination/paris`                  | 20 700 ms      | 113 ms   |
| `/classement/meilleurs-palaces-paris` | 10 623 ms      | 620 ms   |
| `/hotel/le-meurice`                   | 3 000-4 464 ms | 1 300 ms |

**Deux pièges capitalisés, à connaître avant de toucher au cache :**

1. **Une entrée de Data Cache est plafonnée à 2 Mo.** Au-delà, l'écriture échoue
   **silencieusement** : la fonction renvoie quand même son résultat, le seul
   signal est une ligne de log serveur. Toute mise en cache d'une charge à
   l'échelle du catalogue doit être **découpée par page** (une entrée par
   millier de lignes) et **vérifiée par une mesure de TTFB à chaud**, jamais
   supposée.
2. **Le coût peut être CPU, pas I/O.** `/destination/paris` tenait 21 s même
   avec le cache chaud : `<EnrichedText>` recompilait une carte d'auto-liens de
   ~5 000 entrées en expressions régulières **à chaque rendu de composant**.
   Corrigé par un cache de compilation, une construction paresseuse et un
   pré-filtre `String.includes`. Avant d'optimiser une requête, profiler.

**Reste à faire (lot B7)** : `/hotels` répond en 30 ms mais renvoie **10,4 Mo**
de corps — c'est un problème de charge utile, pas de latence.

---

## 4. Surface publique cible

### Indexable — ce sur quoi on se bat

| Famille                             | Volume approximatif  | Rôle                        |
| ----------------------------------- | -------------------- | --------------------------- |
| `/hotel/[slug]`                     | ~2 200               | L'actif éditorial           |
| `/classement/[slug]`                | ~860                 | La porte d'entrée organique |
| `/destination/[citySlug]`           | ≥ 3 hôtels seulement | Hub géographique            |
| `/guide/[citySlug]`, `/guides`      | ~80                  | Long-read                   |
| `/le-concierge/*`                   | ~10                  | Confiance, E-E-A-T, capture |
| `/le-concierge-club`                | 2                    | Capture d'e-mails           |
| `/hotels`, `/hotels/[pays]/[ville]` | paginé               | Annuaire, maillage          |

### Non indexable — présent, plus investi

Lieux, itinéraires, marques, labels, catégories, sous-pages de chambres,
destinations de moins de 3 hôtels, compte, réservation. **`noindex` + retrait
des sitemaps**, réversible en une décision.

### Surface agent — l'avance à défendre

`llms.txt`, `llms-full.txt`, `hotels.jsonl`, `.well-known/agent-skills.json`,
26 endpoints `/api/agent/*`. C'est le canal où l'autorité classique compte le
moins et où le projet est structurellement en avance. **On le garde intégralement,
on le maintient cohérent** (aujourd'hui `llms.txt` liste des URLs `/fr/…` qui
redirigent toutes en 307 vers la canonique sans préfixe — à corriger).

---

## 5. Contrats techniques permanents

Ces règles ne se rediscutent pas sans ADR.

**Code**

1. Pas de `any`, pas de `as Foo`, pas de `!` non-null. On restreint par Zod ou
   par type guard.
2. Pas de `dangerouslySetInnerHTML` en dehors du composant serveur
   `JsonLdScript`.
3. Aucune donnée personnelle dans les logs. Jamais d'e-mail, de téléphone, de
   nom complet, de moyen de paiement.
4. Pas d'import qui traverse une couche.
5. Migrations forward-only.
6. Des clés i18n, pas de chaînes en dur — y compris les messages d'erreur.
7. Composants serveur par défaut ; `'use client'` exige une interactivité réelle.
8. Un seul `Sentry.init` par runtime.

**Contenu**

9. Tout texte généré passe le gate `hasLeak()` **avant** persistance.
10. Toute génération est ancrée DataForSEO (`groundHotel` / `groundKeywords`)
    avec un gate de couverture PAA en sortie. Dégradation propre si DataForSEO
    est indisponible : journaliser `grounding=off`, marquer non ancré, **ne
    jamais publier en se faisant passer pour ancré**.
11. Aucune affirmation non sourcée. Un fait sans source est retiré, pas nuancé.

**Réservation (jusqu'à la Phase E)**

12. Aucun JSON-LD `Offer`, aucun prix, aucune disponibilité en direct sur une
    surface publique.
13. Aucun appel vendor dans le chemin de rendu d'une page publique.
14. Aucune promesse de réservation dans du contenu indexé.

**Processus**

15. Marche d'acceptation utilisateur obligatoire avant tout commit d'un
    changement visible : atteindre la page comme un utilisateur réel, FR **et**
    EN, mobile **et** desktop, et rapporter les URLs parcourues. La règle vient
    d'un cas réel : le Concierge Club a été livré avec cinq pages et zéro entrée
    de navigation.

---

## 6. Données — 27 tables, la carte courte

| Domaine     | Tables clés                                                                    |
| ----------- | ------------------------------------------------------------------------------ |
| Catalogue   | `hotels` (+ `affiliations` jsonb, `external_sources`), `hotel_rooms`, `cities` |
| Éditorial   | `editorial_rankings`, `editorial_guides`, `places`, `itineraries`              |
| Client      | `profiles`, `favorites`, `contact_requests`                                    |
| Réservation | `bookings` (gelé jusqu'à E)                                                    |
| Fidélité    | `loyalty_*`, `hotel_member_benefits`                                           |

RLS active sur les 27 tables `public.*`, ~115 policies. **Le prédicat
d'indexabilité est aujourd'hui dupliqué** entre la RPC SQL `0078_*` et
`indexability.ts` — source unique à établir (lot B4), sans quoi les sitemaps
listeront des pages en `noindex`.

---

## 7. Ce qui rentre en Phase E, et à quelles conditions

Rien de ce qui suit n'est supprimé — tout est **gelé et prêt** :

- Un connecteur unique choisi parmi `travelport`, `amadeus`, `ratehawk`,
  `little-hotelier` ; les six autres restent en sommeil.
- Le tunnel `/reservation/*` (machine à états, idempotence, récapitulatif,
  paiement) est écrit et documenté dans `docs/05-booking-flow.md`.
- Le JSON-LD `Offer` avec `priceValidUntil` se réactive **uniquement** sur le
  périmètre réellement réservable.
- Les indicateurs d'urgence (« X personnes consultent », « stock restant »)
  restent **interdits** sauf preuve d'une disponibilité réellement limitée
  côté vendor — DSA article 25, DGCCRF.
