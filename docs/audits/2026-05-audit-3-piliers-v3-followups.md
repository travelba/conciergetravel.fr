# Audit 3-piliers v3 — tâches reportées (post-merge)

> Document de suivi des 5 chantiers identifiés pendant l'audit
> 3-piliers v3 (SEO + GEO + AGENTIQUE) et **volontairement reportés**
> hors scope agent autonome. Tous nécessitent une action humaine ou
> une dépendance externe (DB live, secrets prod, équipe éditoriale).
>
> Référence : 18 PRs livrées les 21 mai 2026 (PRs #75 → #95).
> Voir le bilan complet dans la PR #95.

## Statut global

L'audit a livré **18 PRs sans régression** couvrant les 7 Vagues du
plan. Les 5 chantiers ci-dessous sont les **derniers points
encore ouverts**, classés par priorité opérationnelle.

| #   | Chantier                                                            | Priorité | Dépendance                         | Effort estimé                                       |
| --- | ------------------------------------------------------------------- | -------- | ---------------------------------- | --------------------------------------------------- |
| 1   | Brevo provisioning + bascule live newsletter                        | P0       | Ops (secret)                       | 1 PR (~10 LoC) après provision                      |
| 2   | Concierge Lead — validation voix 7 guides pays                      | P0       | Équipe éditoriale                  | Revue manuelle ~2h par pays                         |
| 3   | `listPublishedHotelsByCountry(iso)` + `get-hotels-by-country` skill | P1       | Code seul                          | 1 PR (helper + endpoint)                            |
| 4   | Payload `journal_entries` collection + `/le-concierge/journal`      | P1       | Équipe content (modèle de contenu) | 1 PR architecture + N PRs contenus                  |
| 5   | Hotel `ItemList` JSON-LD scopé par guide pays                       | P2       | Dépend du #3                       | 1 PR (intégration dans `/guide/[country]/page.tsx`) |

---

## Chantier 1 — Brevo live newsletter relay

**État actuel** : PR #94 a livré `/api/agent/newsletter` en **mode
dry-run** — validation Zod, rate limit IP, honeypot, GDPR strict
fonctionnels. L'endpoint accepte les inscriptions et répond
`202 { mode: 'queued', dryRun: true }`. Pas de relais vers Brevo
(secret prod non provisionné).

**Bloquant** : provision de 2 variables d'environnement côté Vercel
production + preview :

- `BREVO_API_KEY` (existe déjà dans `@mch/config/env`)
- `BREVO_NEWSLETTER_LIST_ID` (à créer côté admin Brevo)

**Action 1 (ops)** :

1. Créer la liste "Newsletter MyConciergeHotel" dans Brevo (FR + EN attributes)
2. Récupérer le `list_id` numérique
3. Ajouter les 2 secrets dans Vercel (production + preview)

**Action 2 (dev — après ops)** : remplacer le bloc `TODO: Brevo relay`
dans `apps/web/src/app/api/agent/newsletter/route.ts` (≤10 LoC) par :

```ts
import { createBrevoContact } from '@mch/integrations/brevo';

// Remplace le bloc TODO:
await createBrevoContact({
  email: data.email,
  attributes: {
    LOCALE: data.locale,
    TOPICS: data.topics?.join(',') ?? '',
  },
  listIds: [env.BREVO_NEWSLETTER_LIST_ID],
});

return agentJson(
  { ok: true, mode: 'subscribed', locale: data.locale },
  { status: 200, cacheControl: 'no-store' },
);
```

Vérifier que `createBrevoContact` existe (référence ADR-0010 e-mail
workflow). Si absent : implémenter dans `packages/integrations/brevo/`
suivant `.cursor/skills/email-workflow-automation/SKILL.md`.

**Tests à ajouter** :

- MSW mock du POST Brevo `/v3/contacts`
- Cas d'erreur : Brevo 4xx (mauvais email) → retour `400` à l'agent
- Cas d'erreur : Brevo 5xx → retry idempotent + `503` après échec final

---

## Chantier 2 — Concierge Lead validation voix 7 guides pays

**État actuel** : PRs #91 + #92 ont livré les 8 guides pays
(Italie + 7) avec ~42 000 caractères / locale d'éditorial dans la
voix « Concierge ». Le contenu est **professionnellement écrit
mais non vérifié terrain**.

**Risque** : les détails opérationnels (numéros de chambre, tables
spécifiques, horaires) sont **indicatifs** et peuvent être imprécis
(ex. « chambre 433 du Gstaad Palace » — vérifié plausible mais pas
confirmé par l'hôtel).

**Action (Concierge Lead — Aurélien)** :
Pour chacun des 7 guides (Suisse, Maroc, Maldives, EAU, Japon,
Thaïlande, USA) :

1. Lire le namespace i18n correspondant dans
   `apps/web/src/i18n/messages/fr.json` (clés `guideSuisse`,
   `guideMaroc`, etc.) — section `regions.items[].concierge`
2. Cocher / corriger / supprimer chaque Conseil du Concierge selon
   la connaissance terrain
3. Si correction : éditer le JSON FR + EN en miroir

**Métrique d'acceptation** : aucun Conseil du Concierge
non-vérifiable en production. Préférer un conseil **moins spécifique
mais vrai** (ex. « demandez une chambre orientation est aux étages
40+ ») à un conseil **précis mais inventé**.

**Échantillon à valider par priorité commerciale** :

- **Italie** (PR #91) — Le Sirenuse, Villa d'Este, Castiglion del Bosco, Splendido
- **Suisse** — Gstaad Palace, Badrutt's Palace, Mont Cervin Palace, Beau-Rivage
- **Maldives** — Cheval Blanc Randheli (Pearl Experience), Soneva Jani

---

## Chantier 3 — `listPublishedHotelsByCountry(iso)` + `get-hotels-by-country`

**État actuel** : les 8 guides pays ne listent **pas** les hôtels
disponibles dans leur catalogue (les régions citent des noms en
texte libre dans la description éditoriale, mais l'inventaire
Supabase n'est pas requêté).

**Pourquoi reporté** : Supabase live actuellement vide (0 rows). Le
helper aurait été tâché de retourner `[]` systématiquement, donc
aucune valeur ajoutée avant que l'équipe content seede les premiers
hôtels internationaux.

**Action 1 (DB)** : aucune migration nécessaire — la colonne
`hotels.country_code` existe déjà (migration `0033_hotels_country_support.sql`).

**Action 2 (code)** :

1. **Créer le helper** `apps/web/src/server/hotels/get-hotels-by-country.ts` :

   ```ts
   import { z } from 'zod';
   import { createServerClient } from '@/lib/supabase/server';
   import type { HotelSummary } from './get-hotel-by-slug';

   const ISO_3166_1_ALPHA_2 = /^[A-Z]{2}$/u;

   export async function listPublishedHotelsByCountry(isoCode: string): Promise<HotelSummary[]> {
     if (!ISO_3166_1_ALPHA_2.test(isoCode)) return [];
     const supabase = await createServerClient();
     const { data } = await supabase
       .from('hotels')
       .select(
         'id, slug, name, city, region, country_code, lat, lng, star_rating, hero_image_url, factual_summary_fr, factual_summary_en',
       )
       .eq('country_code', isoCode)
       .eq('publication_status', 'published')
       .order('luxury_tier', { ascending: true })
       .limit(50);
     return data ?? [];
   }
   ```

2. **Intégrer dans les 8 country pages** (PR séparée) :
   ajouter un `<HotelInventorySection hotels={hotels} />` après
   le bloc `regions` et avant `practical`, qui :
   - rend une `<Section>` listant les hôtels en cards
   - émet un `ItemList` JSON-LD scopé pays (chantier 5)
   - fallback gracieux quand `hotels.length === 0` (cache la section)

3. **Endpoint agent** `/api/agent/hotels-by-country/[isoOrSlug]/route.ts` :
   pattern identique à `/api/agent/country-guide/[slug]` — Zod sur
   ISO 3166-1 alpha-2, rate-limit, cache 1h public.

4. **Skill `get-hotels-by-country`** dans
   `packages/seo/src/agent-skills.ts` (sera 16e skill) :

   ```ts
   {
     name: 'get-hotels-by-country',
     description: 'Liste les hôtels MyConciergeHotel publiés dans un pays donné (ISO 3166-1 alpha-2). Renvoie ID, slug, nom, ville, étoiles, factual summary. Pour le contenu éditorial du pays utiliser get-country-guide.',
     inputSchema: {
       type: 'object',
       properties: {
         country: { type: 'string', description: 'Code ISO 3166-1 alpha-2 (IT, CH, MA, MV, AE, JP, TH, US) — case-insensitive.' },
       },
       required: ['country'],
     },
     endpoint: { method: 'GET', path: '/api/agent/hotels-by-country/{country}' },
   },
   ```

5. **CI guard** : étendre `country-guides.test.ts` pour asserter que
   chaque country slug a aussi son endpoint hotels associé.

---

## Chantier 4 — `/le-concierge/journal` Payload collection

**État actuel** : la route `/le-concierge/journal` est listée dans
le mega-menu mais **404 actuellement** (page non créée). Le concept
éditorial : un magazine interne court (notes du Concierge, reportages
brefs, scoops sur nouvelles ouvertures).

**Pourquoi reporté** : nécessite **un modèle de contenu complet**
côté équipe content avant tout code (voix, longueur, fréquence,
format des entries, taxonomie).

**Action 1 (équipe content)** : valider le modèle :

- Format : notes courtes (300-500 mots) ou long-reads (1500+ mots) ?
- Cadence : hebdomadaire, mensuelle, ad hoc ?
- Taxonomie : par destination ? Par type d'hôtel ? Par sujet (gastronomie, design, voyage) ?
- Auteur : Concierge unique (Aurélien) ou pool ?
- Cycle de revue (qui valide avant publish ?)

**Action 2 (dev — après décision content)** :

1. **Payload collection** `apps/admin/src/collections/JournalEntries.ts` :
   - Champs : `title`, `slug`, `date_published`, `author` (relation), `excerpt`, `content` (Lexical/Slate), `cover_image`, `topics`, `related_hotels` (multi-relation), `seo_meta`
   - Hooks : `afterChange` → `revalidateTag('journal:*')`
   - RLS Supabase : lecture publique, écriture admins/editors

2. **Route Next.js** `apps/web/src/app/[locale]/le-concierge/journal/page.tsx` :
   - Index avec pagination + `ItemList` JSON-LD
   - Sous-route `/le-concierge/journal/[slug]/page.tsx` avec
     `Article` JSON-LD + `<Author>` block (E-E-A-T)

3. **Sitemap + llms.txt** : ajouter `/sitemaps/journal.xml` sous-sitemap

4. **Skill agent** `get-journal-entry` + `list-journal-entries`

---

## Chantier 5 — Hotel `ItemList` JSON-LD scopé par guide pays

**Dépend** : Chantier 3 (`listPublishedHotelsByCountry`).

**Action** : dans `apps/web/src/app/[locale]/guide/[country]/page.tsx`
(les 8 country pages), après le bloc Article + Country + FAQPage,
ajouter un 4ᵉ JSON-LD `ItemList` :

```ts
const inventory = await listPublishedHotelsByCountry(country.iso);
const itemListJsonLd =
  inventory.length === 0
    ? null
    : {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Palaces et hôtels 5★ MyConciergeHotel — ${country.name}`,
        numberOfItems: inventory.length,
        itemListElement: inventory.map((h, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Hotel',
            name: h.name,
            url: `${baseUrl}/hotel/${h.slug}`,
            address: {
              '@type': 'PostalAddress',
              addressLocality: h.city,
              addressCountry: country.iso,
            },
            starRating: h.star_rating
              ? {
                  '@type': 'Rating',
                  ratingValue: String(h.star_rating),
                  bestRating: '5',
                }
              : undefined,
          },
        })),
      };
```

Émettre via `<JsonLdScript data={itemListJsonLd} />` uniquement si
non-null (cohérent avec la politique anti-empty-ItemList de PR #81 +
PR #82).

---

## Suivi

Quand un chantier est démarré, créer une PR dédiée référençant ce
document et la PR-source du sujet (ex. « refs PR #94 chantier 1 »).
Ce document peut être archivé ou supprimé quand les 5 chantiers
sont fermés.

**Sources de vérité** :

- PR #95 (consolidation finale) — `cursor/audit-v3-final-ci-guard-78ae`
- `.cursor/skills/email-workflow-automation/SKILL.md` (chantier 1)
- `EDITORIAL_VOICE.md` + `docs/editorial/style-guide.md` (chantier 2)
- `packages/db/migrations/0033_hotels_country_support.sql` (chantier 3)
- `.cursor/skills/backoffice-cms/SKILL.md` (chantier 4)
- `.cursor/skills/structured-data-schema-org/SKILL.md` (chantier 5)
