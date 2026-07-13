# Mapping URLs v1 → v2 — MyConciergeHotel.com

> Phase 0 — tâche 0.4. Table de correspondance pour la bascule DNS (Q14).
> Principe CDC §9 : **zéro 301 sur le cœur catalogue** (`/hotel/*`, `/classement/*`,
> `/destination/*`). Locale prefix `/{locale}` (`fr` défaut sans préfixe, `en` → `/en/…`)
> inchangé.
>
> **Actions**
>
> - **conservé** — même path, même canonical.
> - **nouveau** — route v2 absente en v1.
> - **301** — redirection permanente documentée.

---

## 1. Cœur transactionnel et catalogue

| Route v1 (`apps/web`)               | Route v2                            | Action            | Notes                                                                                                 |
| ----------------------------------- | ----------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                                 | `/`                                 | conservé          | Home Booking-like                                                                                     |
| `/recherche`                        | `/recherche`                        | conservé          | SRP ; query params filtres → noindex                                                                  |
| `/recherche?…` (états filtrés)      | `/recherche?…`                      | conservé          | `noindex,follow` + canonical vers SRP de base                                                         |
| `/hotel/[slug]`                     | `/hotel/[slug]`                     | conservé          | ADR-0034 — cible `Hôtel {Nom}` (+ ancres `#tarifs`/`#promos`), ×2 929 fiches                          |
| `/hotel/[slug]/chambres/[roomSlug]` | `/hotel/[slug]/chambres/[roomSlug]` | conservé          | ADR-0009 — canonical strict sous-page                                                                 |
| `/hotels`                           | `/hotels`                           | conservé          | Index annuaire                                                                                        |
| `/hotels/[pays]`                    | `/hotels/[pays]`                    | conservé          | ×128 pays — cible `Hôtel {Pays}` (ADR-0034)                                                           |
| `/hotels/[pays]/[ville]`            | `/hotels/[pays]/[zone]`             | conservé + étendu | Segment 2 = ville OU **région** — cible `Hôtel {Ville}` / `Hôtel {Région}` (ADR-0034), indexable (Q9) |

---

## 2. Éditorial — classements, destinations, guides

| Route v1                      | Route v2                      | Action   | Notes                                                                                                                                              |
| ----------------------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/classements`                | `/classements`                | conservé | Hub index                                                                                                                                          |
| `/classement/[slug]`          | `/classement/[slug]`          | conservé | ×855 long-reads — 3 patrons canoniques : `meilleur-hotel-luxe-{ville}` · `meilleur-hotel-5-etoiles-{pays}` · `plus-beaux-hotels-{pays}` (ADR-0034) |
| `/classements/[axe]/[valeur]` | `/classements/[axe]/[valeur]` | conservé | Hubs facettes (lieu, type, thème, occasion, saison)                                                                                                |
| `/destination`                | `/destination`                | conservé | Index hubs                                                                                                                                         |
| `/destination/[citySlug]`     | `/destination/[citySlug]`     | conservé | ~133 hubs ; guide inliné (ADR-0015)                                                                                                                |
| `/guides`                     | `/guides`                     | conservé | Index guides                                                                                                                                       |
| `/guide/[citySlug]`           | `/guide/[citySlug]`           | conservé | Guides ville/région/cluster                                                                                                                        |
| `/guide/italie`               | `/guide/italie`               | conservé | Pages pays hand-built                                                                                                                              |
| `/guide/japon`                | `/guide/japon`                | conservé |                                                                                                                                                    |
| `/guide/maroc`                | `/guide/maroc`                | conservé |                                                                                                                                                    |
| `/guide/maldives`             | `/guide/maldives`             | conservé |                                                                                                                                                    |
| `/guide/thailande`            | `/guide/thailande`            | conservé |                                                                                                                                                    |
| `/guide/suisse`               | `/guide/suisse`               | conservé |                                                                                                                                                    |
| `/guide/emirats-arabes-unis`  | `/guide/emirats-arabes-unis`  | conservé |                                                                                                                                                    |
| `/guide/etats-unis`           | `/guide/etats-unis`           | conservé |                                                                                                                                                    |
| `/categorie/[categorySlug]`   | `/categorie/[categorySlug]`   | conservé | Pages catégorie (ADR-0016)                                                                                                                         |
| `/label/[facetSlug]`          | `/label/[facetSlug]`          | conservé | Distinctions / labels                                                                                                                              |
| `/marques`                    | `/marques`                    | conservé | Index marques                                                                                                                                      |
| `/marque/[brandSlug]`         | `/marque/[brandSlug]`         | conservé | Pages chaîne                                                                                                                                       |

---

## 3. Inspiration et POI

| Route v1                        | Route v2                        | Action   | Notes                 |
| ------------------------------- | ------------------------------- | -------- | --------------------- |
| `/inspiration`                  | `/inspiration`                  | conservé | Hub inspiration (Q18) |
| `/itineraires`                  | `/itineraires`                  | conservé | ×23 publiés           |
| `/itineraire/[slug]`            | `/itineraire/[slug]`            | conservé |                       |
| `/ouvertures`                   | `/ouvertures`                   | conservé | Ouvertures récentes   |
| `/le-conseil-du-concierge`      | `/le-conseil-du-concierge`      | conservé |                       |
| `/lieux`                        | `/lieux`                        | conservé | ADR-0030 — ~1 147 POI |
| `/lieux/[citySlug]`             | `/lieux/[citySlug]`             | conservé |                       |
| `/lieux/[citySlug]/[placeSlug]` | `/lieux/[citySlug]/[placeSlug]` | conservé |                       |

---

## 4. Programme membre et compte

| Route v1                       | Route v2                              | Action      | Notes                                        |
| ------------------------------ | ------------------------------------- | ----------- | -------------------------------------------- |
| `/programme-membre`            | `/programme-membre`                   | **nouveau** | Équivalent Genius — indexable (Q38, Q41)     |
| `/compte`                      | `/compte`                             | conservé    | Hub tuiles ; `noindex`                       |
| `/compte/connexion`            | `/compte/connexion`                   | conservé    | `noindex`                                    |
| `/compte/inscription`          | `/compte/inscription`                 | conservé    | Adhésion = création compte                   |
| `/compte/favoris`              | `/compte/listes` ou `/compte/favoris` | conservé    | v2 : listes nommées ; alias 301 si renommage |
| `/compte/rejoindre`            | `/compte/inscription`                 | **301**     | Fusion signup membre → inscription standard  |
| `/compte/mot-de-passe-oublie`  | `/compte/mot-de-passe-oublie`         | conservé    |                                              |
| `/compte/nouveau-mot-de-passe` | `/compte/nouveau-mot-de-passe`        | conservé    |                                              |

---

## 5. Le Concierge Club → abandon (Q18)

| Route v1                      | Route v2                   | Action  | Notes                                                 |
| ----------------------------- | -------------------------- | ------- | ----------------------------------------------------- |
| `/le-concierge-club`          | `/programme-membre`        | **301** | 0 inscrit — programme gratuit remplace le Club payant |
| `/le-concierge-club/prestige` | `/programme-membre`        | **301** | Si route existe en v1                                 |
| `/presse/le-concierge-club`   | `/presse/programme-membre` | **301** | Kit presse mis à jour                                 |
| `/le-concierge/fidelite`      | `/programme-membre`        | **301** | Ancienne page fidélité Club                           |

---

## 6. Institutionnel « Le Concierge »

| Route v1                              | Route v2                              | Action   | Notes                  |
| ------------------------------------- | ------------------------------------- | -------- | ---------------------- |
| `/le-concierge`                       | `/le-concierge`                       | conservé |                        |
| `/le-concierge/faq`                   | `/le-concierge/faq`                   | conservé | Aide header            |
| `/le-concierge/contact`               | `/le-concierge/contact`               | conservé |                        |
| `/le-concierge/reserver`              | `/le-concierge/reserver`              | conservé | Devis pré-rempli (Q22) |
| `/le-concierge/methode-editoriale`    | `/le-concierge/methode-editoriale`    | conservé |                        |
| `/le-concierge/pour-les-hoteliers`    | `/le-concierge/pour-les-hoteliers`    | conservé |                        |
| `/le-concierge/mice-et-seminaires`    | `/le-concierge/mice-et-seminaires`    | conservé |                        |
| `/le-concierge/presse-et-partenaires` | `/le-concierge/presse-et-partenaires` | conservé |                        |
| `/le-concierge/newsletter`            | `/le-concierge/newsletter`            | conservé | Brevo (Q21)            |
| `/le-concierge/badge`                 | `/le-concierge/badge`                 | conservé | Widget badge           |
| `/a-propos`                           | `/a-propos`                           | conservé |                        |

---

## 7. Réservation (Phase 9 — hors bascule v2 initiale)

| Route v1                               | Route v2                          | Action                    | Notes                         |
| -------------------------------------- | --------------------------------- | ------------------------- | ----------------------------- |
| `/reservation/start`                   | `/reservation/start`              | conservé                  | Inactif jusqu'à Phase 9       |
| `/reservation/recap`                   | `/reservation/recap`              | conservé                  |                               |
| `/reservation/payment`                 | `/reservation/payment`            | conservé                  |                               |
| `/reservation/confirmation/[ref]`      | `/reservation/confirmation/[ref]` | conservé                  |                               |
| `/reservation/invite`                  | `/reservation/invite`             | conservé                  |                               |
| `/reservation/sandbox/[slug]/chambres` | —                                 | **301** → `/hotel/[slug]` | Dev only — pas exposé prod v2 |

---

## 8. Légal et technique

| Route v1            | Route v2            | Action      | Notes                 |
| ------------------- | ------------------- | ----------- | --------------------- |
| `/mentions-legales` | `/mentions-legales` | conservé    |                       |
| `/confidentialite`  | `/confidentialite`  | conservé    |                       |
| `/cgv`              | `/cgv`              | conservé    |                       |
| `/cookies`          | `/cookies`          | conservé    |                       |
| `/sitemap.xml`      | `/sitemap.xml`      | conservé    | Régénéré post-bascule |
| `/robots.txt`       | `/robots.txt`       | conservé    |                       |
| `/llms.txt`         | `/llms.txt`         | conservé    |                       |
| `/api/agent/*`      | `/api/agent/*`      | conservé    | ADR-0017              |
| `/api/mcp`          | `/api/mcp`          | **nouveau** | Serveur MCP public v2 |

---

## 9. Routes dev / internes (non migrées)

| Route v1                    | Route v2 | Action     | Notes                         |
| --------------------------- | -------- | ---------- | ----------------------------- |
| `/dev/logo-preview`         | —        | **absent** | Dev only, non déployé prod v2 |
| `/dev/photo-filter-preview` | —        | **absent** | Idem                          |

---

## 10. Récapitulatif actions

| Action       | Count (routes principales)                               |
| ------------ | -------------------------------------------------------- |
| conservé     | ~55                                                      |
| nouveau      | 2 (`/programme-membre`, `/api/mcp`)                      |
| 301          | 5–6 (Concierge Club + `/compte/rejoindre` + sandbox dev) |
| absent (dev) | 2                                                        |

---

## 11. Implémentation redirects

Les 301 sont centralisés dans :

- **Next.js** : `apps/web-v2/next.config.ts` → `redirects()` async.
- **Vercel** : fallback edge si besoin (rollback < 15 min, CDC §9).
- **Tests** : E2E Playwright — une spec par 301 critique (Club → programme-membre).

```typescript
// Exemple — apps/web-v2/next.config.ts (extrait)
{
  source: '/le-concierge-club',
  destination: '/programme-membre',
  permanent: true,
},
{
  source: '/le-concierge-club/:path*',
  destination: '/programme-membre',
  permanent: true,
},
```

Locale : dupliquer pour `/en/le-concierge-club` → `/en/programme-membre` via middleware `next-intl`.

---

## Références

- CDC v2 §6.2–6.3 : [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../cdc/cahier-des-charges-v2-booking-like.md)
- ADR URL fiche : [`docs/adr/0008-url-structure-hotel-flat.md`](../adr/0008-url-structure-hotel-flat.md)
- ADR chambres : [`docs/adr/0009-hotel-room-subpages-indexable.md`](../adr/0009-hotel-room-subpages-indexable.md)
- Skill SEO : [`.cursor/skills/seo-technical/SKILL.md`](../../.cursor/skills/seo-technical/SKILL.md)
- Freeze v1 : [`.cursor/rules/v2-migration-freeze.mdc`](../../.cursor/rules/v2-migration-freeze.mdc)
