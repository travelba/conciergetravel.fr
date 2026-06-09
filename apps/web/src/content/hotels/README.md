# Hotel kit pages (DA-first)

Pilot: **Airelles Gordes** (`les-airelles-gordes`).

## Source of truth

1. **Markup** — `DA/les-airelles-gordes.html` (body extracted to `les-airelles-gordes.body.html`)
2. **Tokens** — `les-airelles-gordes.json` (aligned with `DA/docs/TEMPLATES_GUIDE.md`)
3. **Styles** — `apps/web/src/styles/kit.css` (+ site layout header/footer)
4. **Images** — Cloudinary `cct/hotels/{slug}/` (press kit + POI) ; static fallbacks in `public/kit/airelles/`

## Regenerate body HTML after DA changes

```bash
node scripts/extract-airelles-kit-body.mjs
```

## Runtime

- Slugs in `src/server/hotels/kit/is-hotel-kit-slug.ts`
- `page.tsx` branches to `<HotelPageKit />` (no legacy 30-component stack)
- Data: Supabase row + golden merge via `patchKitGoldenRow()` in `patch-kit-golden-row.ts`
- Interactivity: `HotelKitInteractions` (read-more, expériences, autour, mini-galleries)

---

## Playbook — nouvelle fiche kit

After the Airelles PO sign-off, replicate this checklist for each new hotel.

### 1. Direction artistique

1. Duplicate `DA/template-hotel.html` → `DA/hotels/{slug}.html` (or `{brand}/{slug}.html`)
2. Validate the **9 sections** against the runbook `docs/runbooks/airelles-reference-fiche-plan.md`
3. Extract body → `apps/web/src/content/hotels/{slug}.body.html` (if static fallback needed)
4. Copy brand tokens → `{slug}.json` in `apps/web/src/content/hotels/`
5. Copy static assets → `apps/web/public/kit/{brand}/`

### 2. Golden data (`packages/domain/src/editorial/`)

1. Create `{slug}-golden.ts` following `airelles-golden.ts`:
   - `build{Brand}GoldenFields()` — FAQ (12, 5 featured), POI (visit/do/eat/shop), restaurants, spa, policies, factual ≤150c, meta_desc, gallery ≥30 / ≥10 categories, external_sources ≥5, long_description_sections (7–8), signature_experiences + kid club if applicable
2. Register the builder in `patch-kit-golden-row.ts` → `GOLDEN_BUILDERS`
3. Optional slug-specific display overrides → `kit-display-overrides.ts` (replace `kit-airelles-display.ts` pattern)

### 3. Runtime wiring

1. Add slug to `HOTEL_KIT_SLUGS` in `is-hotel-kit-slug.ts`
2. Kit renderer uses shared `render-hotel-kit-html.ts` + `prepare-hotel-kit-model.ts` (no fork unless DA diverges)
3. `buildHotelKitJsonLd` + `buildHotelKitMetadataFromModel` — shared, data-driven

### 4. Pipelines (run in order)

```bash
# Photos — press kit + POI (Cloudinary, alt bilingue, categories SMD)
pnpm --filter @mch/editorial-pilot exec tsx src/photos/upload-{slug}-gallery.ts
pnpm --filter @mch/editorial-pilot exec tsx src/photos/resource-{slug}-poi-images.ts

# Editorial promotion → Supabase
pnpm --filter @mch/editorial-pilot promote:{slug}-golden

# FAQ humanizer + factual clamp
pnpm --filter @mch/editorial-pilot exec tsx src/faq/run-humanizer-faq.ts --slug={slug}
```

### 5. Quality gates

```bash
pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --slug=les-airelles-gordes
pnpm exec tsc --noEmit -p apps/web
# Rich Results Test FR + EN
# Walk-through UAL : FR+EN desktop 1280px + mobile 390px (skill user-acceptance-loop)
# axe on nav mobile, barre résa, FAQ
```

### 6. Agentique / GEO

- Verify `GET /api/mcp/hotel-photos?slug={slug}&locale=fr`
- Entry in `llms.txt` (auto via route builder when pilot is indexable)
- Rebuild `public/agent-skills.json` if the catalog changed

---

## Airelles reference checklist (DoD)

| Section                      | Anchor                               | Status                                           |
| ---------------------------- | ------------------------------------ | ------------------------------------------------ |
| Galerie + tête + feats + nav | —                                    | kit renderer                                     |
| À propos                     | `#apropos`                           | hook + factual `#factual-summary`                |
| Chambres                     | `#chambres`                          | carrousel + mini-galerie                         |
| L'hôtel en bref              | `#hotel-en-bref`                     | services / expériences / restos / spa / kid club |
| Presse                       | `#presse`                            | presse + distinctions + Instagram                |
| Accès                        | `#acces`                             | carte + politiques + avis                        |
| Autour                       | `#autour`                            | visit / do / events / eat / shop + photos POI    |
| FAQ                          | `#faq` + `#concierge-advice` + Top 5 | ADR-0011                                         |
| Club                         | `#club`                              | inline 4 avantages                               |
| Proximité                    | `#proximite`                         | `pickProximityCards`                             |
| En bref GEO                  | `#en-bref`                           | fact-sheet clôture                               |
