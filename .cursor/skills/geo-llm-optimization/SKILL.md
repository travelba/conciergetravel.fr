---
name: geo-llm-optimization
description: GEO / AEO optimization for MyConciergeHotel.com (llms.txt, llms-full.txt, AEO blocks, agent-skills.json, Link Header WebMCP, FAQ extraction, freshness signals). Use for any work touching LLM ingestion, AI Overviews, or LLM-actionable surfaces.
---

# GEO / LLM optimization — MyConciergeHotel.com

Beyond Google SEO, the site must rank inside **AI Overviews, ChatGPT, Perplexity, Claude** answers (CDC §6.5 + Excel sheet "GEO & Agentique"). The architecture exposes machine-readable surfaces designed for extraction.

## Triggers

Invoke when:

- Editing `llms.txt`, `llms-full.txt`, AEO blocks, or `agent-skills.json`.
- Adding new structured FAQ content.
- Setting `Link` HTTP headers (RFC 8288).
- Adjusting freshness signals or "last updated" UI.

## Surfaces produced

| Surface                  | Path                                  | Format            | Generated from                               |
| ------------------------ | ------------------------------------- | ----------------- | -------------------------------------------- |
| Quick LLM guide          | `/llms.txt`                           | Markdown < 50 KB  | Static + curated key pages                   |
| Full LLM sitemap         | `/llms-full.txt`                      | Markdown < 500 KB | Payload published pages                      |
| Agent skills             | `/.well-known/agent-skills.json`      | JSON              | Static manifest (search/filter/booking)      |
| Link header              | All pages                             | RFC 8288          | Middleware annotation                        |
| AEO blocks               | Top of editorial pages + hotel detail | HTML              | `<AeoBlock>` component, content from Payload |
| FAQ                      | Editorial + hotel pages               | HTML + JSON-LD    | Payload `faq_content` JSONB                  |
| Sitemap with `<lastmod>` | `/sitemap.xml`                        | XML               | Payload + DB                                 |

## Non-negotiable rules

### `llms.txt` (root)

- Title `# MyConciergeHotel.com — La sélection du Concierge, hôtels d'exception dans le monde` (cf. [ADR-0021](../../docs/adr/0021-pivot-scope-mondial.md)).
- One-line description. **Never** mention « en France » or « France's Palaces » as a geographic boundary — the catalogue spans 91 countries.
- "## Pages stratégiques" with 5–10 curated links + 40–60 word descriptions each.
- "## À propos" with IATA / ASPST credentials, value proposition (`Conseil du Concierge` opérationnel sur chaque fiche), freshness, scope (`615 adresses dans 91 pays`).
- Keep < 50 KB. Validate weekly.

### `llms-full.txt`

- Sectioned by hub: Pilier, Hubs régionaux, Hubs villes, Fiches hôtels, Sélections, Guides, Programme fidélité, Méthodologie.
- Each entry: `- [Title](URL) — 1–3 lines factual description`.
- Generated server-side from Payload published list at request time, cached 1h.

### AEO block (40–80 words) — CDC §6.5

- Component `<AeoBlock>` placed at the top of every editorial page and hotel detail.
- Content authored in Payload field `aeo_block_fr` / `aeo_block_en`. Lint validates 40–80 words (was 40–60 in V1, widened to align with `buildAeoBlock` from `@mch/seo`).
- Format: direct answer to the page's primary question, names entities, includes the freshness phrase ("mise à jour [mois année]").

### IA-ready factual summary (CDC §2.3)

- Distinct from the AEO block — designed as a **150-char extraction unit** that LLMs can quote verbatim.
- Stored in Payload field `factual_summary_fr` / `factual_summary_en`. Lint validates 130–150 chars.
- Format strict: `[Type] [étoiles] situé [quartier/ville], à [distance] de [POI majeur], avec [3 USP].`
  - Example: `Palace 5★ situé sur la Croisette à Cannes, à 25 min de Nice Aéroport, avec spa Dior, plage privée et restaurant 2★ Michelin.`
- Rendered visually right under the H1 + mapped into Schema `description` of `Hotel`.
- Must be unique per hotel — Algolia indexing rejects duplicates.

### FAQ extraction (CDC §2.11 — levier GEO majeur)

- Authored in Payload `faq_content` JSONB.
- **Volume per page type:**
  - Hotel detail: **10–15 Q&A obligatoires** (CDC §2.11, up from 5 in V1).
  - Classements, sélections, comparatifs, guides: 5–10 Q&A.
- **10 questions canoniques (obligatoires sur fiche hôtel)** — must be present even when answers are generic, because LLMs rank pages on coverage breadth:
  1. Y a-t-il un parking ? (gratuit/payant, valet, EV, hauteur)
  2. À quelle heure est servi le petit-déjeuner et combien coûte-t-il ?
  3. Le Wi-Fi est-il gratuit dans tout l'hôtel ?
  4. Les animaux sont-ils acceptés ? (frais, taille, restrictions)
  5. Quelle est la distance jusqu'à l'aéroport / la gare la plus proche ?
  6. La piscine est-elle chauffée / accessible toute l'année ?
  7. Le check-in anticipé est-il possible et à quel tarif ?
  8. Un transfert depuis l'aéroport est-il proposé ?
  9. Quelles sont les conditions d'annulation et de modification ?
  10. Quelles sont les taxes incluses / non incluses (taxe de séjour, resort fees) ?
- **Questions personnalisées** (5+ par hôtel) : spa, restaurant, salles de réunion, plage privée, etc.
- **Réponses factuelles courtes : 50–100 mots** — denser than the AEO block (40–80), optimised for LLM citation extraction.
- Rendered both as HTML (`<details open>` for the first Q to keep DOM text visible) and JSON-LD `FAQPage`.

#### ADR-0011 C1 — Top 5 Réponses du Concierge (visible) + FAQPage 10–15 (JSON-LD)

The CDC pushed two conflicting requirements: a "visible top 5" for human readability and a "10-15 entries" floor for AEO citation breadth. ADR-0011 reconciles them with a two-block layout:

- `<TopConciergeFaq>` (`apps/web/src/components/hotel/top-concierge-faq.tsx`) — Server Component rendered **before** `<HotelFaq>`. Reads `faq_content[].featured === true` and caps to 5 items, with an optional `concierge_tip_fr` per item ("Mon conseil : …"). Self-elides if fewer than 5 items are flagged featured (avoids broken UI on incomplete hotels).
- `<HotelFaq>` (10–15 Q&A, first item `<details open>` for LLM crawler visibility) — kept as the canonical FAQ. **Emits the JSON-LD `FAQPage` over all 10-15 entries.** The Top 5 component deliberately does **not** emit its own `FAQPage` to avoid duplicate structured data; the 5 featured entries are a strict subset of the 10–15 already in JSON-LD.
- Curation: the LLM humanizer (`run-humanizer-faq.ts`, prompt `11-concierge-faq.md`) marks exactly 5 items as `featured: true` per hotel, prioritising actionable + frequently asked questions (parking, breakfast, check-in, transfers, pets). A `clampFeatured` post-step guarantees the exact-5 invariant even when the LLM picks fewer.
- Tip coverage cap: ≤ 2 `concierge_tip_fr` per hotel, drop overflow silently.

Hard rules:

- The visible Top 5 must always be a **subset** of the entries in the JSON-LD FAQPage. Never surface a featured FAQ that isn't also in the canonical 10-15 list.
- Never emit two `FAQPage` blocks for the same hotel (Google Rich Results merges them inconsistently — the structured `<HotelFaq>` JSON-LD is the source of truth).
- E2E coverage in `apps/web/e2e/hotel-concierge-blocks.spec.ts` asserts (a) 5 visible questions without interaction, (b) tips render, (c) exactly one `FAQPage` JSON-LD block in `<head>`.

### Freshness (CDC §6 — visible dated updates)

- Visible "Dernière mise à jour : [Mois Année]" badge near H1 on every editorial page **and on every hotel detail page** (component `<LastUpdatedBadge />`).
- Triple sync: visible UI badge ↔ `<lastmod>` in `sitemap.xml` ↔ JSON-LD field.
  - Editorial pages: `Article.dateModified`.
  - Hotel pages: `Hotel.dateModified` + `lastReviewed` (Schema.org extension for evergreen content).
- Updated automatically by Payload `afterChange` hooks. Manual override only via an explicit "force freshness" button in Payload (audit-logged).

### POIs + distances as LLM citation signals (CDC §2.7)

- Each hotel exposes a `<HotelPois>` block listing 5–15 POIs (airports, stations, beaches, museums, restaurants) with **chiffres et unités** (`distance_km`, `walk_min`, `transit_min`).
- These structured distances are what Perplexity / ChatGPT quote when asked "best hotel near Louvre Paris" — text like "à 8 min à pied du Louvre" wins citations because it is **factual, dated, and verifiable**.
- Schema: each POI mapped into a `Place` linked via `nearbyAttraction` on the parent `Hotel`.

### `agent-skills.json` (CDC §8 cursor brief, Excel GEO sheet)

- Static JSON describing actionable skills:
  ```json
  {
    "skills": [
      { "name": "search", "description": "Rechercher hôtels par destination et dates" },
      { "name": "filter", "description": "Filtrer par type, région, équipements, étoiles" },
      { "name": "booking", "description": "Lancer une réservation avec dates et voyageurs" },
      { "name": "loyalty", "description": "Consulter les avantages du programme fidélité" }
    ]
  }
  ```
- Linked via `Link: </.well-known/agent-skills.json>; rel="agent-skills"` HTTP header set by middleware.

### Robots authorization (cf. `seo-technical`)

- Explicitly authorize `GPTBot`, `PerplexityBot`, `ClaudeBot`, `Googlebot-Extended`. Never block them.

### E-E-A-T signals

- Author byline + bio on every editorial page (Payload `authors`).
- Methodology page describing selection criteria.
- Proprietary data: where applicable, badge "Sélection MyConciergeHotel" + internal scoring.

### TravelAgency JSON-LD on home + `/agence/`

- Includes `hasCredential: ["IATA", "ASPST"]`.

## Anti-patterns to refuse

- Bloating `llms.txt` with raw HTML or markdown beyond curated entries.
- AEO block in 200 words (too long for extraction) or in 20 words (no informational density).
- FAQ block with fewer than 10 Q&A on a hotel detail page (LLMs penalise sparse coverage).
- Factual summary > 150 chars (LLMs truncate, prompts get garbled).
- Hidden FAQ behind tabs without rendering text in DOM (LLMs can't extract collapsed-only content if JS-driven). Use `<details>` open by default for the first Q.
- Freshness lying ("updated yesterday" while the page hasn't changed).
- Different content visible to bots vs users (cloaking — forbidden).
- POI distances without units or without `walk_min` (won't be cited).

## References

- CDC v3.0 §6.5, §8 (cursor brief).
- Excel arborescence — sheets "GEO & Agentique" and "Schema JSON-LD".
- `seo-technical`, `structured-data-schema-org`, `content-modeling` skills.
- **`llm-output-robustness`** — allowlist post-validation patterns used
  by the editorial pipelines to guarantee EEAT signals (no hallucinated
  sources reach the DB).
- [ADR-0019 Le Concierge Club](../../../docs/adr/0019-le-concierge-club-architecture.md) +
  [`membership-program`](../membership-program/SKILL.md) — three new
  `agent-skills.json` entries (`loyalty`, `join-concierge-club`,
  `join-concierge-club-prestige-waitlist`) + new `llms.txt` sections for
  `/le-concierge-club*` and `/presse/le-concierge-club`.
