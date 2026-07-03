# Press & data pack — MyConciergeHotel (juillet 2026)

> **Statut** : pack prêt-à-tirer (WS-A du plan maître 2026-07). L'outreach
> humain (envoi / relance) est **reporté par la décision PO D4** — ce
> document reste le socle de données citables, prêt à alimenter un pitch
> presse dès que D4 est rouverte.
>
> **À l'usage du PO / de l'attaché·e de presse** : chaque angle donne un
> titre, 3-5 chiffres exacts, la requête qui les a produits (reproductibilité)
> et le lien vers la page de production correspondante. Aucun chiffre n'est
> inventé ; les limites de données sont explicitement signalées.

## Méthode & source des chiffres

- **Base** : projet Supabase de production `fsmfozxgujskluxakeoq`
  (`public.hotels`, `public.editorial_rankings`, `public.editorial_ranking_entries`).
- **Date de relevé** : 2026-07-02.
- **Accès** : les agrégats groupés (par pays, par label, par classement)
  sont produits en SQL. L'équivalent PostgREST (les scripts du repo passent
  par `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) est donné
  pour les comptages simples ; PostgREST ne fait pas de `GROUP BY`, donc les
  répartitions sont reproduites en SQL via le MCP Supabase ou `psql`.
- **Périmètre** : sauf mention contraire, tous les chiffres portent sur les
  fiches **publiées** (`is_published = true`) — c'est la surface publique.
- **Snapshot de référence** : `apps/web/src/lib/catalogue-stats.ts`
  (`CATALOGUE_PUBLISHED = 2929`, `CATALOGUE_COUNTRIES = 128`, relevé 2026-06-29).

**En-tête PostgREST commun** (pour tous les `curl.exe` ci-dessous) :

```
-H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
-H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

---

## Angle 1 — Un catalogue éditorial mondial : 2 929 hôtels, 128 pays

**Le fait** : là où la plupart des sélections « meilleurs hôtels » se
limitent à une poignée de villes, MyConciergeHotel documente **2 929 hôtels
publiés répartis dans 128 pays**, chacun avec une fiche rédigée et un Conseil
du Concierge.

**Chiffres citables (2026-07-02)**

- **2 929** hôtels publiés.
- **128** pays couverts.
- Top 5 pays : **France 718**, **États-Unis 274**, **Italie 166**,
  **Espagne 121**, **Chine 117**.
- Suite du top 10 : Royaume-Uni 98, Grèce 88, Émirats arabes unis 73,
  Suisse 72, Japon 70.

**Requête (SQL)**

```sql
-- Totaux
select count(*) filter (where is_published) as published,
       count(distinct country_code) filter (where is_published) as countries
from hotels;

-- Répartition par pays (top 15)
select country_code, count(*) as n
from hotels
where is_published
group by country_code
order by n desc
limit 15;
```

**Équivalent PostgREST (total publié)**

```
curl.exe -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/hotels?select=count&is_published=eq.true" ^
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" ^
  -H "Prefer: count=exact"
```

**Pages de production** : `/destination` · `/hotels` · `/hotels/france`

---

## Angle 2 — Les Palaces (label Atout France) dans le catalogue

**Le fait** : le label **Palace** est une distinction officielle d'Atout
France, réservée à un très petit nombre d'établissements **tous situés en
France** (33 Palaces au titre de la promotion 2026 — source Atout France).
MyConciergeHotel les référence et les balise en donnée structurée.

**Chiffres citables (2026-07-02)**

- **33** hôtels du catalogue portent le marqueur Palace (`is_palace = true`).
- **20** sont déjà balisés via la facette structurée `palace-atout-france`
  (émise en JSON-LD `Hotel.award` sur la fiche) — l'alignement des 13 autres
  sur la facette est un chantier en cours (WS-C « claims Palace »).
- **0** hôtel hors de France ne porte ce label : un « Palace » au sens Atout
  France est, par définition, français.

> ⚠ **À vérifier avant pitch** : citer le chiffre conservateur **20**
> (balisage vérifiable en page) ou attendre l'alignement WS-C pour parler
> des **33**. Ne jamais présenter comme « Palace » un établissement hors
> France (règle EEAT + DGCCRF).

**Requête (SQL)**

```sql
-- Fiches balisées par la facette structurée
select count(*) as palaces_facette
from hotels, lateral jsonb_array_elements(affiliations) el
where is_published and el->>'facet_slug' = 'palace-atout-france';

-- Fiches portant le marqueur Palace
select count(*) filter (where is_published and is_palace) as palace_flag
from hotels;
```

**Pages de production** : `/label/palace-atout-france` · `/categorie/palaces-france`

---

## Angle 3 — Ouvertures & fraîcheur éditoriale suivies par le Concierge

**Le fait** : la conciergerie tient un fil des dernières adresses inspectées
et met à jour ses fiches en continu. La page `/ouvertures` expose en
permanence les **20 dernières adresses** passées en revue.

**Chiffres citables (2026-07-02)**

- **20** adresses affichées dans le fil « Ouvertures & visites récentes ».
- Parmi les fiches à **date d'ouverture documentée**, les plus récentes :
  **Conrad Los Angeles (2022)**, **Cheval Blanc Paris (2021)**,
  **Shangri-La Paris (2010)**.
- **44** distinctions / labels distincts sont représentés dans le catalogue,
  pour **2 132** balisages au total — un signal de fraîcheur et d'ampleur.

> ⚠ **Limite de données assumée** : la colonne `opened_at` n'est renseignée
> que sur **7 / 2 929** fiches et `last_renovated_at` sur **0 / 2 929**. Cet
> angle est donc le plus faible en l'état — à renforcer par un back-fill des
> dates d'ouverture/rénovation avant d'en faire un pitch « nouveautés ». Le
> fil `/ouvertures` est actuellement trié par priorité éditoriale, pas par
> date d'ouverture (documenté dans `ouvertures/page.tsx`).

**Requête (SQL)**

```sql
-- Couverture des dates
select count(*) filter (where opened_at is not null) as with_opened,
       count(*) filter (where last_renovated_at is not null) as with_renovated
from hotels where is_published;

-- Ouvertures documentées (récentes d'abord)
select name, city, country_label_fr, opened_at
from hotels
where is_published and opened_at is not null
order by opened_at desc;

-- Ampleur des distinctions
select count(distinct el->>'facet_slug') as distinct_labels,
       count(*) as total_label_tags
from hotels, lateral jsonb_array_elements(affiliations) el
where is_published;
```

**Page de production** : `/ouvertures`

---

## Angle 4 — Les classements éditoriaux les plus riches

**Le fait** : MyConciergeHotel publie **863 classements éditoriaux**. Les plus
denses reprennent les palmarès de référence du secteur (World's 50 Best,
Travel + Leisure, Condé Nast) et les enrichissent d'une justification signée
par entrée — un aimant à citation pour les moteurs de réponse (AI Overviews,
Perplexity, ChatGPT Search).

**Chiffres citables (2026-07-02)**

- **863** classements publiés.
- Le plus riche : **The World's 50 Best Hotels 2025 — 99 entrées**.
- **Travel + Leisure World's Best 2025 — 84 entrées**.
- **Condé Nast Traveler Gold List 2025-2026 — 69 entrées**.
- Classements « collection » les plus fournis : Top Relais & Châteaux France
  (50), Top Ritz-Carlton monde (45), Top Four Seasons monde (45).

**Requête (SQL)**

```sql
-- Nombre de classements publiés
select count(*) filter (where is_published) as published_rankings
from editorial_rankings;

-- Classements les plus riches (par nombre d'entrées)
select r.slug, r.title_fr, count(e.*) as entries
from editorial_rankings r
join editorial_ranking_entries e on e.ranking_id = r.id
where r.is_published
group by r.slug, r.title_fr
order by entries desc
limit 12;
```

**Pages de production** : `/classements` ·
`/classement/classement-worlds-50-best-hotels-2025` ·
`/classement/classement-travel-leisure-worlds-best-2025`

---

## Rappel des distinctions représentées (données d'appui, tous angles)

Top labels balisés sur les fiches publiées (facette `affiliations[].facet_slug`,
relevé 2026-07-02) :

| Label / collection          | Fiches publiées |
| --------------------------- | --------------- |
| Relais & Châteaux           | 474             |
| Small Luxury Hotels         | 224             |
| Forbes Travel Guide 5★      | 187             |
| The World's 50 Best Hotels  | 119             |
| Michelin — 3 Clés           | 80              |
| Condé Nast Gold List        | 58              |
| Leading Hotels of the World | 31              |
| Palace (Atout France)       | 20              |

```sql
select el->>'facet_slug' as facet_slug, count(*) as n
from hotels, lateral jsonb_array_elements(affiliations) el
where is_published
group by 1
order by n desc
limit 40;
```

---

## Contact presse

- **E-mail** : presse@myconciergehotel.com (à confirmer par le PO avant envoi).
- **Page publique** : `/le-concierge/presse-et-partenaires`.
- **Éditeur** : TRAVEL BUSINESS AGENCY, SASU — 9 rue Greffulhe, 92300
  Levallois-Perret (voir `/mentions-legales`).

_Pack généré le 2026-07-02 (WS-A). Rafraîchir les chiffres avant tout envoi
si le catalogue a bougé — relancer les requêtes ci-dessus._
