# Hotel FAQ — Perplexity exhaustive research prompt

> Template for Cursor / MCP Perplexity. Copy, replace placeholders, run via
> `user-perplexity` (`perplexity_research` or paste into agent chat).
> Output lands in `scripts/editorial-pilot/out/faq-perplexity/<slug>.json`.
>
> Skill: `.cursor/skills/hotel-faq-perplexity-enrichment/SKILL.md`

---

Use Perplexity to do exhaustive research on the hotel **{{HOTEL_NAME}}** in **{{CITY}}, {{COUNTRY}}**.

Search across: official hotel website, TripAdvisor, Booking.com, Expedia, Hotels.com, Michelin Guide, luxury travel press, travel blogs, and Google reviews. Cross-validate all answers — only include verified, accurate information.

## Real search demand (DataForSEO) — anchor the FAQ on these

Before listing the categories below, **prioritise the questions people actually
ask**. Paste the grounding block printed by:

```bash
pnpm --filter @mch/editorial-pilot exec tsx src/grounding/print-hotel-grounding.ts --slug={{SLUG}}
```

```
{{REAL_QUERIES_PAA}}
```

Rule: every relevant People-Also-Ask question above MUST be covered (reformulated
naturally and specific to this hotel). Ignore off-topic noise (celebrities,
unrelated trivia). Use the high-volume keyword phrasing inside the answers when
it reads naturally — never force an off-topic keyword, never fabricate a fact to
match one. These real queries take priority over the generic category checklist.

Generate two JSON outputs for MyConciergeHotel.com:

## 1. faq

Every factual question a guest could ask about the hotel — before and during their stay. Be exhaustive: aim for **40 to 60 questions minimum** (up to 80 for flagship kit fiches), covering every detail a guest might wonder about.

Tone: factual, concise, informative — like a hotel information sheet.
Each item: `category`, `question`, `answer`

Categories to cover exhaustively (use these exact French labels):

- Arrivée & Départ (check-in/out times, early arrival, late checkout, luggage storage)
- Localisation & Accès (address, distances from airports, parking, valet, shuttle)
- Chambres & Équipements (room types, sizes, views, minibar, safe, AC, soundproofing)
- Services inclus (breakfast, Wi-Fi, pool access, spa access, bikes, minibar)
- Restauration (restaurants, opening hours, dress code, reservations, breakfast, room service)
- Spa & Bien-être (brand, treatments, opening hours, pools, hammam, sauna, booking)
- Activités & Loisirs (on-site sports, excursions, rentals, evening entertainment)
- Famille & Enfants (kids club, babysitting, family rooms, child menus)
- Animaux (accepted breeds, size limits, extra charges)
- Accessibilité (wheelchair access, adapted rooms)
- Facturation & Politiques (payment methods, deposit, cancellation, extra fees)
- Durabilité (eco certifications, green practices)

## 2. concierge_questions

Every question where the guest needs personalized concierge assistance. Aim for **20 to 30 questions minimum**.

Tone: **informative concierge desk** — factual, helpful, **no first-person commitment**. Prefer « La conciergerie peut… », « Il est recommandé de… », « Les réservations s'effectuent… » — **never** « Je réserve / Je confirme / I will book ».
Each item: `category`, `question`, `concierge_reply`

Categories (use these exact French labels):

- Transferts & Transport
- Réservations de restaurants
- Réservations spa
- Excursions & Visites culturelles
- Occasions spéciales
- Shopping & Services de luxe
- Activités familiales
- Expériences personnalisées

## SEO / GEO rules

- Write questions in natural language, exactly as a guest would type or say them (voice search & AI search optimized).
- Include long-tail variations (e.g. "Le spa est-il inclus dans le tarif chambre ?" AND "Dois-je payer un supplément pour le spa ?").
- Answers must be complete sentences, not bullet points — optimized for Google Featured Snippets and AI answer engines (Perplexity, ChatGPT, Gemini).
- Each answer must be self-contained — readable without context.
- If a fact cannot be verified across at least two sources, omit the specific number and say: "Contactez la conciergerie pour confirmer les modalités du jour."

## Output format

Return **clean JSON only**, no markdown, no explanation:

```json
{
  "faq": [{ "category": "Arrivée & Départ", "question": "…", "answer": "…" }],
  "concierge_questions": [
    { "category": "Transferts & Transport", "question": "…", "concierge_reply": "…" }
  ]
}
```

## Post-research pipeline (repo)

```bash
# Validate JSON locally
pnpm --filter @mch/editorial-pilot faq:perplexity:validate -- --input=out/faq-perplexity/{{SLUG}}.json --hotel-name="{{HOTEL_NAME}}"

# Push to Supabase (faq_content_kit + faq_content promote + concierge_questions)
pnpm --filter @mch/editorial-pilot faq:perplexity:push -- --slug={{SLUG}} --input=out/faq-perplexity/{{SLUG}}.json --hotel-name="{{HOTEL_NAME}}"
```

Golden reference: `DA/_generated/airelles-faq-data.json` (77 factual + 28 concierge).
