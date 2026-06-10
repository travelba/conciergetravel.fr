# Hotel FAQ — Perplexity exhaustive research prompt

> Template for Cursor / MCP Perplexity. Copy, replace placeholders, run via
> `user-perplexity` (`perplexity_research` or paste into agent chat).
> Output lands in `scripts/editorial-pilot/out/faq-perplexity/<slug>.json`.
>
> Skill: `.cursor/skills/hotel-faq-perplexity-enrichment/SKILL.md`

---

Use Perplexity to do exhaustive research on the hotel **{{HOTEL_NAME}}** in **{{CITY}}, {{COUNTRY}}**.

Search across: official hotel website, TripAdvisor, Booking.com, Expedia, Hotels.com, Michelin Guide, luxury travel press, travel blogs, and Google reviews. Cross-validate all answers — only include verified, accurate information.

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

Tone: warm, proactive, luxury concierge voice — use "Je", offer to act immediately.
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
