# Audit pré-production MyConciergeHotel.com — Synthèse & Go-Live

> Audit complet « visiteur humain » réalisé le 2026-06-23 en 4 clusters parallèles
> (lecture seule, aucune modification de code/DB). Sections détaillées :
> [`01-navigation-liens.md`](01-navigation-liens.md) ·
> [`02-contenu-seo.md`](02-contenu-seo.md) ·
> [`03-performance-ux.md`](03-performance-ux.md) ·
> [`04-metier-auth-design.md`](04-metier-auth-design.md).
> Périmètre : `apps/web` (66 pages, 51 route handlers). Phase 6 (booking/prix)
> gelée → l'absence de prix/dispo n'est PAS comptée comme bug.

---

## 1. Scores par catégorie

| Catégorie                      | Score /10 | Verdict                                                                                                                                                                    |
| ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation & liens             | **7,5**   | Architecture mûre, parité desktop/mobile/footer, 0 boucle. Pèsent : redirects `/selection/*` morts + chaîne `/guide/[citySlug]`.                                           |
| Contenu & cohérence éditoriale | **7,5**   | Catalogue écrit profond (2219 hôtels + 1147 lieux FR+EN, 0 doublon meta, 0 fuite scaffolding). Pèsent : parité EN classements + justifications génériques.                 |
| SEO & métadonnées              | **7,0**   | Socle code best-in-class (JSON-LD, hreflang, canonical, noindex Phase 6). Pèse : **prod en retard** (P0 ranking non déployé) + `/a-propos` 404.                            |
| Performance & UX               | **7,0**   | Résilience données excellente (0 page 500 sur panne upstream), `next/image` massif, Mapbox code-split. Pèsent : ~28 routes sans `loading.tsx` + scans catalogue dupliqués. |
| Fonctionnel                    | **7,5**   | Funnels critiques OK (contact, Club, auth, demande concierge). Pèsent : newsletter désactivée + WhatsApp non câblé.                                                        |
| Sécurité                       | **8,5**   | 0 exposition. Zod, rate-limit, honeypot, CSRF, nonce CSP, 0 secret/PII client, gardes session+tier.                                                                        |
| Design                         | **8,0**   | Charte homogène, icônes 100 % SVG inline, logo cohérent. Pèse : double système de tokens (DS vs kit).                                                                      |

**Score global ≈ 7,5 / 10.** Aucun défaut structurel. Le site est **proche du Go-Live** : la majorité des points rouges/oranges sont soit un **simple re-déploiement**, soit des correctifs à faible effort.

---

## 2. Constat-racine transverse (à traiter en premier)

> **La prod est en retard sur le repo** (la branche `feat/lieux-a-visiter-vertical` / PR #162 n'est pas mergée+déployée). À elle seule, cette dette explique **3 tickets** indépendants :
>
> - 🔴 **688 pages classement sans `og:image` ni hero above-the-fold** ni millésime courant en prod (le code P0 existe, commit `782efe53`).
> - 🟠 **`/a-propos` + `/en/about` → 404** (la redirection 308 committée n'est pas live).
> - 🔵/🟠 **`/lieux`, `/fr/lieux`, `/lieux/paris` → 404** en prod (verticale entière inaccessible + maillage interne cassé) — probablement le même retard de déploiement, **à confirmer juste après le deploy**.
>
> **Action n°1 = merger PR #162 + déployer + smoke-test** (`og:image`, `/a-propos`, `/lieux`, podium, millésime). Sans nouveau code, ça remonte SEO et corrige 2-3 tickets d'un coup.

---

## 3. Top 10 des problèmes prioritaires

| #   | Sév. | Problème                                                                                  | Catégorie   | Action                                                                            |
| --- | ---- | ----------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | 🔴   | Prod en retard → 688 classements sans `og:image`/hero/millésime live                      | SEO         | **Merge PR #162 + deploy + smoke-test**                                           |
| 2   | 🔴   | Verticale `/lieux` (~1147 pages) renvoie 404 en prod + liens internes cassés              | Nav/Perf    | Vérifier post-deploy ; sinon corriger routing/flag, ou retirer les liens          |
| 3   | 🟠   | `/a-propos` + `/en/about` → 404 (redirect 308 non déployée)                               | SEO/Nav     | Couvert par le deploy ; re-vérifier 308 → `/le-concierge`                         |
| 4   | 🟠   | Redirects `/selection/{lune-de-miel,ski,plage-privee}` → 404 (cibles inexistantes)        | Nav         | Re-pointer vers `/classements/occasion                                            | saison/\*` ou supprimer les 3 règles |
| 5   | 🟠   | Parité EN classements : EN ≈ 58 % du FR, 42 % minces, 85 stubs                            | Contenu     | **Sweep EN en cours** (worker `enrich-ranking-justifications`) — finir + vérifier |
| 6   | 🟠   | 67 `intro_en` + 70 `factual_summary_en` vides → FR rendu sur `/en` (AEO)                  | Contenu     | Compléter EN (pipeline traduction gaté) ou masquer le bloc tant que vide          |
| 7   | 🟠   | Liens internes vers `/guide/[citySlug]` (chaîne 308) — dont `build-link-map`              | Nav         | Repointer vers `/destination/[citySlug]` (canonique ADR-0015)                     |
| 8   | 🟠   | ~28 routes dynamiques lourdes sans `loading.tsx` (paint figé)                             | Perf/UX     | `loading.tsx` générique sur hubs/templates (réutiliser `recherche/loading.tsx`)   |
| 9   | 🟠   | Scans catalogue dupliqués non-`cache()` (`getDestinationBySlug`, `listPublishedRankings`) | Perf        | `cache()`-wrapper (dédupe `generateMetadata` ↔ page)                              |
| 10  | 🟠   | Newsletter = formulaire entièrement désactivé sur page indexable                          | Fonctionnel | Câbler Brevo double opt-in OU remplacer par CTA honnête                           |

**Mentions 🟡 à grouper ensuite** : WhatsApp « 24/7 » sans intégration (risque DGCCRF — recadrer « dès Phase 6 » ou câbler `wa.me`) · `not-found.tsx` libellé retour hardcodé FR (i18n) · hero LCP home `<img>` brut hors `next/image`/Cloudinary · justifications FR génériques (104 formules templatées) vs concret yonder · double système de tokens DS/kit · double slug `/marque/dorchester`.

---

## 4. Checklist « GO LIVE » (bloquants impératifs)

- [ ] **Déployer** la branche en prod (merge PR #162) — débloque #1, #3, et probablement #2.
- [ ] **Smoke-test post-deploy** : `og:image` présent sur 3 `/classement/*`, `/a-propos`→308, `/lieux` + `/lieux/paris`→200, podium+millésime courant rendus.
- [ ] **`/lieux` accessible** (200 FR+EN) — sinon le maillage destination→lieux est cassé (règle `user-acceptance-before-commit`).
- [ ] **Redirects `/selection/*`** : repointer ou supprimer (plus de 301→404).
- [ ] **Newsletter** : câbler OU retirer le faux formulaire désactivé (pas de surface morte indexable).
- [ ] **WhatsApp « 24/7 »** : harmoniser le copy en « dès la Phase 6 » partout OU câbler un vrai lien (conformité DGCCRF).
- [ ] **`/dev/logo-preview` + `/dev/photo-filter-preview`** : gater `notFound()` en prod (ou sortir de l'arbre public).
- [ ] **`not-found.tsx`** : i18n le libellé « Retour à l'accueil » (FR rendu sur `/en`).
- [ ] **favicon.ico + manifest.webmanifest** : fournir les assets (référencés par le proxy, absents du repo).

**Non bloquant Go-Live mais à enchaîner vite** : `loading.tsx` sur les hubs · `cache()` sur les 3 scans · parité `intro_en`/`factual_summary_en` · hero LCP.

---

## 5. Pages à supprimer ou consolider

| Page/route                                                                       | Action                                                                                                 | Raison                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `/marque/dorchester` (alias)                                                     | **Consolider** → 308 vers `/marque/dorchester-collection` ou exclure de `generateStaticParams`+sitemap | Double slug indexable, contenu dupliqué        |
| `/dev/logo-preview`, `/dev/photo-filter-preview`                                 | **Supprimer/gater** en prod                                                                            | Outils QA internes joignables publiquement     |
| Règles redirect `/selection/{lune-de-miel,ski,plage-privee}`                     | **Supprimer ou repointer**                                                                             | 301 → 404 (cibles inexistantes)                |
| Villes destination en « selection coming soon »                                  | **Seeder ou laisser noindex** (ne pas laisser traîner)                                                 | Empty-states qui diluent le hub `/destination` |
| Slugs régions héros sans inventaire (champagne, pays-basque, bordeaux, provence) | **Masquer** jusqu'à seeding du hub régional                                                            | ~4 liens/page vers pages thin noindex          |

---

## 6. Points forts à préserver (moat)

- **Résilience données** : 0 page 500 sur panne Supabase/Algolia/Cloudinary/Mapbox (lecteurs défensifs partout, 7/7 routes prod = 200).
- **Sécurité** : 0 exposition, tous les bons patterns (Zod, rate-limit, honeypot, CSRF, nonce CSP, 0 secret client).
- **Structured data** : ~10 blocs JSON-LD (ItemList + Hotel/entrée + FAQPage + Speakable + hreflang) — on **sur-structure yonder.fr** (~6). Moat GEO/AEO.
- **Profondeur catalogue** : 688 classements multi-axes + 1147 lieux full-EN + 2219 hôtels FR+EN — surface qu'aucun concurrent listicle n'a.
- **Conformité Phase 6** : toutes les surfaces gelées (`reservation/*`, `compte/*`) correctement `noindex`.

---

## 7. MCH vs yonder.fr (rappel règle PO)

- **On gagne** : structured data, profondeur multi-axes, voix Concierge + Conseil, Club −25 %, maillage hôtel↔lieu.
- **On perd / à combler** : (1) **visuel + carte sociale live** (688 classements sans `og:image` faute de deploy) ; (2) **parité + concret éditorial EN/FR** (eux ~150-250 mots concrets/hôtel) ; (3) **phrasing à volume** (`hôtel de luxe {ville}` ×10-26 vs `meilleurs hôtels`) ; (4) **autorité/indexation** (absents top-20 — gap d'autorité, pas de structure → GSC + backlinks, Phase 5).
