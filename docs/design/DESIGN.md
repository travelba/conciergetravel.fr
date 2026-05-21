---
name: Concierge Travel Visual Language
brand: ConciergeTravel.fr
philosophy: Sober Luxury
status: active (V1)
source_of_truth: This file is the canonical design system spec for the project. It mirrors the Stitch design system asset `assets/5552533c32214a9b977d438e80eb455c` (project `10099065051001187678` — "ConciergeTravel.fr"). Any change here MUST be propagated to the Stitch DS via `update_design_system`, and vice versa.
references:
  - stitch_project: https://stitch.withgoogle.com/projects/10099065051001187678
  - stitch_ds_asset: assets/5552533c32214a9b977d438e80eb455c
  - hotel_detail_blocks: .cursor/rules/hotel-detail-page.mdc (CDC §2, 15 blocks)
  - editorial_voice: EDITORIAL_VOICE.md + ADR-0011 (Le Concierge tone)
---

# Concierge Travel Visual Language

> Bridge between a prestige editorial magazine and a high-performance booking
> engine. **Sober Luxury** — quality whispered through white space and precise
> typography rather than shouted through ornamentation.

## 1. Brand context

- **Marque** : `ConciergeTravel.fr` — agence de voyage IATA / APST agréée
- **Cible** : voyageurs à fort revenu, 35-65 ans, FR + EN (V1) ; +ES/DE/IT (V2) ; +AR/ZH/JA (V3)
- **Catalogue** : hôtels 5 étoiles et Palaces de France (V1), International Yonder (V1.5+)
- **Voix éditoriale** : « Le Concierge » — expert complice, jamais commercial, toujours précis. Cf. [`EDITORIAL_VOICE.md`](../../EDITORIAL_VOICE.md).
- **Mood** : Magazine éditorial × moteur de réservation transactionnel. Pas tape-à-l'œil. Le luxe se chuchote.

## 2. Colors — palette canonique

The palette is rooted in a gallery-like foundation. Off-white serves as the
primary canvas, providing a warmer, more sophisticated feel than pure white.
Charcoal is used for all primary communication.

### Brand colors

| Role            | Token       | Hex       | Usage                                                                                |
| --------------- | ----------- | --------- | ------------------------------------------------------------------------------------ |
| **Primary**     | `charcoal`  | `#1A1A1A` | Tous les textes principaux, CTAs, headers, signature                                 |
| **Background**  | `off-white` | `#FAFAF8` | Canvas principal, plus chaud que blanc pur                                           |
| **Accent gold** | `gold`      | `#C9A96E` | Loyalty status, picks experts, signature concierge — **réservé moments de prestige** |
| **Accent sage** | `sage`      | `#8C9681` | Sustainability, nature, status indicators soft — éditorial uniquement                |

### System colors (Material Design 3 named, FIDELITY variant)

```yaml
surface: '#FDF8F8'
surface-bright: '#FDF8F8'
surface-container-lowest: '#FFFFFF'
surface-container-low: '#F7F3F2'
surface-container: '#F1EDEC'
surface-container-high: '#EBE7E6'
surface-container-highest: '#E5E2E1'
surface-dim: '#DDD9D8'
surface-tint: '#5F5E5E'
surface-variant: '#E5E2E1'
on-surface: '#1C1B1B'
on-surface-variant: '#444748'
inverse-surface: '#313030'
inverse-on-surface: '#F4F0EF'
outline: '#747878'
outline-variant: '#C4C7C7'

primary: '#000000'
primary-container: '#1C1B1B'
on-primary: '#FFFFFF'
on-primary-container: '#858383'
inverse-primary: '#C8C6C5'

secondary: '#745A27' # gold-darker
secondary-container: '#FEDB9B'
on-secondary: '#FFFFFF'
on-secondary-container: '#795F2B'

tertiary: '#000000'
tertiary-container: '#161E0F' # sage-darker
on-tertiary-container: '#7D8773'

error: '#BA1A1A'
error-container: '#FFDAD6'
on-error: '#FFFFFF'
on-error-container: '#93000A'

background: '#FDF8F8'
on-background: '#1C1B1B'
```

### Color usage rules

- **Primary text**: always charcoal `#1A1A1A` on off-white surfaces. Never pure black.
- **Gold**: reserved for loyalty status, "expert pick" badges, premium upgrades. **Never** on body text.
- **Sage green**: optional accent for sustainability content, status indicators in editorial contexts. Never on CTAs.
- **Pure black `#000000`**: only for `primary` token (very rare, e.g. CTA fills).
- **Pure white `#FFFFFF`**: only for `on-primary` text inside dark CTAs and `surface-container-lowest`.
- WCAG 2.2 AA contrast minimum on all text/background pairings.

## 3. Typography

The typography system uses a classic pairing to signal the dual nature of the
platform:

- **Noto Serif** — for all headlines and storytelling elements. Provides a
  literary, authoritative voice. Generous line heights, breathable.
- **Inter** — functional workhorse. UI elements, inputs, long-form body, all
  metadata. Clarity is paramount.
- **Inter `label-caps`** — small uppercase metadata, trust signals, badges.
  Distinct hierarchy that feels like a professional stamp.

### Type scale

```yaml
display-xl: # Hero H1, page titles
  fontFamily: Noto Serif
  fontSize: 48px
  fontWeight: 400
  lineHeight: 1.1
  letterSpacing: -0.02em

headline-lg: # Section titles
  fontFamily: Noto Serif
  fontSize: 32px
  fontWeight: 400
  lineHeight: 1.2

headline-md: # Subsection titles
  fontFamily: Noto Serif
  fontSize: 24px
  fontWeight: 400
  lineHeight: 1.3

body-lg: # Long-form editorial body
  fontFamily: Inter
  fontSize: 18px
  fontWeight: 400
  lineHeight: 1.6

body-md: # Default body text
  fontFamily: Inter
  fontSize: 16px
  fontWeight: 400
  lineHeight: 1.6

label-caps: # Metadata, trust signals, breadcrumb-like
  fontFamily: Inter
  fontSize: 12px
  fontWeight: 600
  lineHeight: 1.0
  letterSpacing: 0.1em
  textTransform: uppercase

interactive: # Button labels, form actions
  fontFamily: Inter
  fontSize: 14px
  fontWeight: 500
  lineHeight: 1.0
```

## 4. Layout & Spacing

Fixed Grid for desktop, fluid for mobile.

```yaml
unit: 4px # base spacing token
touch-target: 44px # WCAG 2.2 minimum, ENFORCED
gutter: 24px # column gap on grids
margin-mobile: 20px # page horizontal padding mobile
margin-desktop: 80px # page horizontal padding desktop
section-gap: 120px # between editorial features (block-level vertical spacing)
```

- **Desktop grid**: 12 columns, max-width centered (~1280-1440px). Avoid full-bleed except for hero photography.
- **Mobile grid**: fluid 4-column. 44px minimum touch target on every interactive element.
- **Section-gap (120px)** is the visible breathing room between two distinct editorial features. Don't compress it.
- Photographic content may break the grid (full-bleed) — but text content stays centered.

## 5. Shape language

Soft, slightly rounded — neither brutalist sharp nor friendly bubble:

```yaml
rounded:
  sm: 0.125rem # 2px  — subtle inputs
  DEFAULT: 0.25rem # 4px  — buttons, cards (Stitch ROUND_FOUR)
  md: 0.375rem # 6px
  lg: 0.5rem # 8px
  xl: 0.75rem # 12px — badges, chips
  full: 9999px # circular elements (favicon avatars only)
```

- **Buttons & inputs**: 4px (`DEFAULT`)
- **Imagery (large editorial)**: 0px sharp — feels like printed magazine spreads
- **Badges/chips**: 12px (`xl`) — distinguishes from functional UI elements
- **Avatars**: `full` (circular)

## 6. Elevation & Depth

This DS **avoids heavy drop shadows and floating effects** to maintain its
"sober" character. Depth is communicated through:

1. **Surface Tiers** — subtle shifts from `#FAFAF8` (primary background) to
   `surface-container` (`#F1EDEC`) etc. to define container areas.
2. **Borders** — 1px charcoal lines at very low opacity (10-15%, `outline-variant: #C4C7C7`) to define cards, input fields.
3. **Photography as Depth** — background images with high-quality "blur-to-focus"
   transitions or parallax effects provide the primary sense of environmental depth.
4. **Overlays** — when modals are required, use a high-blur backdrop filter with
   a subtle Charcoal tint (`bg-[#1C1B1B] bg-opacity-40 backdrop-blur-sm`) rather
   than a solid black overlay.

**Never use**: `box-shadow: 0 4px 12px rgba(0,0,0,0.15)` style heavy elevation.

## 7. Components

### Buttons

| Variant           | Background         | Text                        | Border       | Min height | Use case                                                 |
| ----------------- | ------------------ | --------------------------- | ------------ | ---------- | -------------------------------------------------------- |
| **Primary**       | `charcoal #1A1A1A` | white                       | none         | 44px       | Default CTA: Réserver, Vérifier disponibilité, Confirmer |
| **Secondary**     | transparent        | charcoal                    | 1px charcoal | 44px       | Secondary actions: Ajouter aux favoris, Partager         |
| **Loyalty**       | `gold #C9A96E`     | charcoal                    | none         | 44px       | **Réservé** loyalty status / premium upgrade buttons     |
| **Tertiary text** | none               | charcoal underline on hover | none         | 44px       | Editorial links, footer nav                              |

All buttons: 44px minimum height. Padding `12px 20px` mini.

### Cards

- **Travel destination cards**: photography-first. Title in **Noto Serif**, overlaid using a subtle gradient OR placed in a high-contrast container below the image.
- **Hotel cards (search results)**: photo on top (16:9 or 4:3), Noto Serif title, Inter metadata, gold star or label-caps "Palace" classification badge.
- **Editorial Journal Entry**: large drop-cap in Noto Serif (60-72px), wide margins, mimicking a physical travel magazine. **This is the signature component for "Le mot du Concierge" / "Conseil du Concierge" (cf. ADR-0011 + bloc 16 fiche hôtel)**.

### Inputs

- Minimalist. Labels **always visible** (never placeholder-only) using `label-caps`.
- Focus state: 1px solid `charcoal` border (no glow, no thick outline).
- Error state: 1px solid `error #BA1A1A` border, error message in Inter 12px directly under.
- Search and booking inputs: same convention. Date pickers: native or minimal custom.

### Trust signals (CRITICAL for IATA / APST credibility)

- **IATA + APST logos**: rendered in monochrome (charcoal) at reduced opacity (60%).
- Grouped in a "Trust Bar" at the top of pages or integrated into the footer and booking summary.
- **High-precision alignment** — equal vertical baseline, equal horizontal spacing.
- Never colorized. Never inflated in size. They earn trust by their understated presence.

### Editorial features

- **"Le mot du Concierge"** / **"Conseil du Concierge"** block (CDC §2 bloc 16, ADR-0011): drop-cap, wide margins, italic pull-quotes optional. Renders as `<aside role="note">`. 50-110 words FR/EN.
- **Magazine asymmetric photo grids**: e.g. fiche Crillon hero — 6 photos in mosaic 3-column varying heights. Use sparingly for high-emotion sections.
- **Pull-quotes**: Noto Serif italic 28px, charcoal at 70% opacity, wide margins on both sides.

## 8. Photography

- **Atmospheric over generic**: capture "the feeling of being there" rather than stock travel imagery.
- Always alt-tagged with hotel name + context (cf. CDC §2 hard rule on enriched alt).
- Hero photos: 16:9 desktop, 4:5 mobile portrait crop.
- Gallery photos: minimum 30 per hotel, 10 categories covered (CDC §2 hard rule).
- Optimization: Cloudinary `f_auto,q_auto`, AVIF preferred, fallback WebP, fallback JPEG.
- **Prohibited**: auto-playing video (WCAG 2.2 AA), motion-heavy carousels, parallax that breaks scroll.

## 9. Animation & Motion

- **Subtle, intentional, never decorative**.
- Transitions: 200-300ms ease-out maximum. Never bouncy.
- Hover states: 150ms color shift. Never scale-up cards (jarring).
- Page transitions: respect `prefers-reduced-motion`.
- Image loading: blur-to-focus is the **only** allowed visual flourish.

## 10. Anti-patterns

The following are **rejected** by code review or design review:

| Anti-pattern                                                    | Why                                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Heavy `box-shadow` (e.g. `0 4px 20px rgba(0,0,0,0.2)`)          | Breaks "Sober Luxury", feels SaaS-y                                                 |
| Pure white `#FFFFFF` as background                              | Use `#FAFAF8` off-white for warmth                                                  |
| Pure black `#000000` text                                       | Use `#1A1A1A` charcoal for warmth                                                   |
| Filled gold buttons for primary CTAs                            | Gold is reserved for loyalty/premium                                                |
| Lucide icons larger than 20px in body content                   | They become visually loud                                                           |
| Decorative emojis in copy                                       | Concierge voice is not casual                                                       |
| Auto-playing video                                              | WCAG 2.2 AA violation                                                               |
| Urgency indicators ("X personnes consultent", stock countdowns) | EU DSA art. 25 violation. **Banned** unless backed by Amadeus `LimitedAvailability` |
| Star ratings displayed `/10` in JSON-LD `AggregateRating`       | Schema.org requires `bestRating: '5'`                                               |
| Affiliate-style logos / Booking-Expedia mentions                | We're an IATA agency, not a metasearch                                              |
| Hover scale on cards                                            | Jarring at scroll                                                                   |
| Parallax that breaks scroll-depth tracking                      | Hurts analytics + readability                                                       |
| Stock travel photos (Unsplash genericness)                      | We need atmospheric, not generic                                                    |

## 11. Stitch design system

This DS is mirrored in Stitch as **`assets/5552533c32214a9b977d438e80eb455c`** ("Concierge Travel Visual Language"), in the project [`10099065051001187678`](https://stitch.withgoogle.com/projects/10099065051001187678) ("ConciergeTravel.fr").

```yaml
stitch_theme:
  colorMode: LIGHT
  colorVariant: FIDELITY
  customColor: '#1A1A1A'
  overridePrimaryColor: '#1A1A1A'
  overrideSecondaryColor: '#C9A96E'
  overrideTertiaryColor: '#8C9681'
  headlineFont: NOTO_SERIF
  bodyFont: INTER
  labelFont: INTER
  roundness: ROUND_FOUR # 0.25rem (4px)
  spacingScale: 2
  font: NOTO_SERIF
```

When generating new screens via `generate_screen_from_text`, **always** pass:

```json
{
  "designSystem": "assets/5552533c32214a9b977d438e80eb455c",
  "deviceType": "DESKTOP" | "MOBILE",
  ...
}
```

Existing reference screens (project 10099065051001187678) ready to translate to TSX:

| Screen                              | Type              | Local mirror                                                                    |
| ----------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| Homepage Desktop                    | Desktop 2560×7498 | `docs/design/stitch-screens/REF-conciergetravel/03-homepage-desktop/`           |
| Homepage Mobile                     | Mobile 780×8332   | `docs/design/stitch-screens/REF-conciergetravel/04-homepage-mobile/`            |
| Fiche Hôtel de Crillon Desktop      | Desktop 2560×3730 | `docs/design/stitch-screens/REF-conciergetravel/01-fiche-crillon-desktop/`      |
| Fiche Hôtel de Crillon Mobile       | Mobile 780×5580   | `docs/design/stitch-screens/REF-conciergetravel/02-fiche-crillon-mobile/`       |
| Tunnel Paiement Sécurisé Mobile     | Mobile 780×2662   | `docs/design/stitch-screens/REF-conciergetravel/05-tunnel-paiement-mobile/`     |
| Tunnel Informations Voyageur Mobile | Mobile 780×1810   | `docs/design/stitch-screens/REF-conciergetravel/06-tunnel-voyageur-mobile/`     |
| Tunnel Confirmation Mobile          | Mobile 780×3740   | `docs/design/stitch-screens/REF-conciergetravel/07-tunnel-confirmation-mobile/` |

## 12. Tailwind / shadcn integration

The DS tokens map onto Tailwind config in `apps/web/tailwind.config.ts`:

```ts
// Excerpt — full file lives in apps/web/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        charcoal: '#1A1A1A',
        'off-white': '#FAFAF8',
        gold: '#C9A96E',
        sage: '#8C9681',
        // Material Design 3 named tokens (cf. §2)
        surface: '#FDF8F8',
        'surface-container': '#F1EDEC',
        'surface-container-high': '#EBE7E6',
        outline: '#747878',
        'outline-variant': '#C4C7C7',
      },
      fontFamily: {
        serif: ['"Noto Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '1.2', fontWeight: '400' }],
        'headline-md': ['24px', { lineHeight: '1.3', fontWeight: '400' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'label-caps': [
          '12px',
          {
            lineHeight: '1.0',
            letterSpacing: '0.1em',
            fontWeight: '600',
            textTransform: 'uppercase',
          },
        ],
        interactive: ['14px', { lineHeight: '1.0', fontWeight: '500' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      spacing: {
        gutter: '24px',
        'margin-mobile': '20px',
        'margin-desktop': '80px',
        'section-gap': '120px',
        'touch-target': '44px',
      },
    },
  },
};
```

shadcn/ui components in `packages/ui/` use these tokens via CSS variables.

## 13. Mapping CDC §2 — fiche hôtel (15 blocks + bloc 16 Concierge)

The 15 blocks defined in [`.cursor/rules/hotel-detail-page.mdc`](../../.cursor/rules/hotel-detail-page.mdc) map to component skeletons:

| #   | Bloc                                    | Stitch reference (Crillon)                 | Component target             |
| --- | --------------------------------------- | ------------------------------------------ | ---------------------------- |
| 1   | Header (H1, breadcrumb, étoiles, share) | Crillon top section                        | `<HotelHeader>`              |
| 2   | Galerie (≥30 photos)                    | Crillon mosaic 6-photo grid                | `<HotelGallery>`             |
| 3   | Factual summary                         | (à créer)                                  | `<FactualSummary>`           |
| 4   | Description longue                      | "Le mot du Concierge" Crillon (à étendre)  | `<LongDescription>`          |
| 5   | Chambres → sous-pages                   | Crillon "Suites & Chambres" mobile         | `<RoomCardList>`             |
| 6   | Équipements                             | (à créer)                                  | `<AmenityGrid>`              |
| 7   | Localisation                            | Crillon POI sidebar                        | `<HotelMap>` + `<HotelPois>` |
| 8   | Booking widget                          | Tunnel Paiement Mobile                     | `<BookingWidget>`            |
| 9   | Politiques                              | (à créer)                                  | `<HotelPolicies>`            |
| 10  | Avis                                    | (à créer)                                  | `<ReviewsBlock>`             |
| 11  | FAQ                                     | (à créer)                                  | `<FaqBlock>`                 |
| 12  | Guide local teaser                      | (à créer)                                  | `<LocalGuideTeaser>`         |
| 13  | Trust signals                           | Crillon footer + IATA/APST                 | `<TrustSignals>`             |
| 14  | MICE                                    | (à créer)                                  | `<MiceBlock>`                |
| 15  | Footer fiche                            | Crillon footer                             | `<HotelFooter>`              |
| 16  | **Conseil du Concierge**                | "Le mot du Concierge" Crillon — drop-cap S | `<ConciergeAdvice>`          |

## 14. Microcopy rules

- **Always TTC** for all prices ("1 570 € TTC" jamais "1 570 €")
- **Always euros** in V1, multilang currencies V2+
- **Sentence ≤ 25 words** (cf. EDITORIAL_VOICE.md §6)
- **No exclamation marks** (Concierge tone)
- **No urgency** ("X personnes consultent" → forbidden)
- **No commercial superlatives** ("incroyable", "magnifique", "exceptionnel" sauf classement Atout France) — cf. style-guide.md §4
- **No machine-translated FR/EN** — native rewriter only

## 15. Accessibility — WCAG 2.2 AA

- Contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text
- Touch target 44×44px minimum
- All interactive elements keyboard-navigable
- Focus indicators 1px charcoal solid, no `outline: none` ever
- `prefers-reduced-motion` respected (transitions → instant)
- Alt text enriched on all images (cf. CDC §2 hard rule)
- Skip-link to main content on every page
- ARIA labels on all icon-only buttons

## 16. Versioning & change management

- This file is the **canonical** spec. Any visual change must be:
  1. Discussed in an ADR if it impacts a layer boundary or rendering strategy
  2. Reflected in the Stitch DS asset (`update_design_system`)
  3. Reflected in `apps/web/tailwind.config.ts` and `packages/ui/`
  4. Validated visually by re-generating at least one reference Stitch screen
  5. Committed atomically (DESIGN.md + Tailwind + UI components in same PR)

- Versioning: this file uses simple `status: active (V1)` in the front-matter. Major changes increment to V2, V3.

---

> Last updated: 2026-05-21 — adopted from Stitch project ConciergeTravel.fr (`10099065051001187678`).
