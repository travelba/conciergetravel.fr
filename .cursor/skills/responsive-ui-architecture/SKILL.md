---
name: responsive-ui-architecture
description: Mobile-first responsive UI architecture for MyConciergeHotel.com (Tailwind + shadcn/ui + design tokens). Use when designing layouts, building shared components, defining breakpoints, or any UI change that must remain restylable later without refactor.
---

# Responsive UI architecture — MyConciergeHotel.com

The cahier des charges asks for a **mobile-first, sober, restylable** UI base — no strong artistic direction yet. The design will be reworked later (CDC v3.0 §10), so the system must be **token-driven** so a single CSS file change repaints the product.

## Triggers

Invoke when:

- Adding any component to `packages/ui/`.
- Working on layouts, navigation (burger / bottom-sheet on mobile, sidebar on desktop).
- Touching breakpoints, spacing, typography.
- Implementing any booking tunnel screen (max 3 mobile screens, CDC §9).

## Non-negotiable rules

### Mobile-first

- Every component is designed at **375px** first; Tailwind classes start unprefixed (mobile), then add `sm:`, `md:`, `lg:`, `xl:`.
- Touch targets: minimum **44×44px** for any interactive element.
- Tunnel: max 3 screens on mobile (Search → Tunnel → Confirmation).

### Tokens

- All design decisions live in `packages/ui/tokens.css` as CSS custom properties:
  - `--color-bg` (#FAFAF8), `--color-fg` (#1A1A1A), `--color-accent-gold` (#C9A96E), `--color-sage`, `--color-border`, `--color-muted`.
  - `--font-serif` (e.g. Playfair Display), `--font-sans` (Inter / DM Sans), with `font-display: swap`.
  - `--space-1`..`--space-12` (4px base scale).
  - `--radius-sm`, `--radius-md`, `--radius-lg`.
- Tailwind reads tokens via `tailwind.config.ts` `theme.extend.colors / fontFamily / spacing` referencing CSS vars.
- **No hex literal in components**. Always tokens.

### Components

- Built on shadcn/ui primitives, recomposed in `packages/ui/components/`.
- Strict typing (`Props` interface), accept `className`, support `asChild` where shadcn does.
- Forms use **React Hook Form + Zod resolver**.
- Images use Next.js `<Image>` with `sizes` and explicit width/height to prevent CLS.

### Navigation

- Mobile: top header + burger → bottom-sheet menu. Footer is condensed.
- Desktop: sticky top header with mega-menu (regions/themes/guides), full footer with trust signals (IATA/ASPST badges, secure payment Amadeus, phone, financial guarantee).

### CSS-only dropdowns keep the header as a Server Component

The site header (`apps/web/src/components/layout/site-header.tsx`) is a
Server Component on purpose: pages underneath can opt into ISR because
it never reads `cookies()` (ADR-0007 auth client island pattern). Adding
a "use client" wrapper around a dropdown trigger silently breaks that
contract and forces every page to fall back to `force-dynamic`.

**Pattern** — wrap the trigger + panel in a `group relative` container
and drive the panel's visibility with `group-hover` AND
`group-focus-within`. Both keyboard and pointer users get the same
affordance, no JS required, the host stays RSC.

```tsx
<div className="group relative">
  <Link
    href="/hotels"
    aria-haspopup="menu"
    className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
  >
    {t('primaryNav.hotels')}
    {/* caret SVG */}
  </Link>
  <div
    role="menu"
    aria-label={t('primaryNav.hotelsCategoriesLabel')}
    className="border-border bg-bg invisible absolute left-0 top-full z-50 mt-1 w-72 rounded-md border p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
  >
    <ul>
      {entries.map((e) => (
        <li key={e.slug} role="none">
          <Link role="menuitem" href={…}>{label}</Link>
        </li>
      ))}
    </ul>
  </div>
</div>
```

Five things this pattern enforces:

1. **`invisible opacity-0` + `transition`** instead of `hidden` — the
   panel stays in the DOM so `focus-within` actually fires when a
   keyboard user tabs into the first menu item.
2. **`group-focus-within:` in addition to `group-hover:`** — without it,
   Tab + Enter cannot reach the panel items on desktop; the dropdown
   becomes mouse-only and fails WCAG 2.1.1 (Keyboard).
3. **`aria-haspopup="menu"`** on the trigger and **`role="menu"` +
   `role="menuitem"`** inside, with `role="none"` on the `<li>`
   wrappers — APG menu pattern.
4. **The trigger itself is a real link** (`/hotels`), not a `<button>`
   that does nothing. Mouse users who don't hover-and-click on a child
   still land on a useful page.
5. **Mobile counterpart uses `<details>`** — never reuse the same
   `group-hover` panel on touch, where there is no hover. `<details>`
   gives APG disclosure semantics for free and degrades without JS.
   See `apps/web/src/components/layout/mobile-nav.tsx`.

**When to escape to a Client Component instead** — only when the menu
needs typeahead, complex roving-tabindex (full APG menubar), or a
controlled-open state that survives clicks outside. For a static list
of links the CSS-only path is correct.

Reference implementation: `apps/web/src/components/layout/site-header.tsx`

- `apps/web/src/components/layout/nav-data.ts` (shared category source
  between RSC header and Client mobile-nav — the data module avoids
  `server-only` so both consumers can import it).

### Trust signals (CDC §10.2) on every page

- Header: phone number visible, IATA + ASPST badges with link to official registers.
- Footer: APST financial guarantee, secure Amadeus payment with lock icon, "agence française, conseillers francophones".

### Snap carousels (mobile carousel ↔ desktop grid)

Long vertical scrolls on mobile (homepage grids of 4–8 cards stacked
1-col) are the #1 perceived-bloat complaint on this site (PO feedback
2026-05-28). The fix is a **CSS-only horizontal snap carousel on
mobile** that collapses back to the desktop grid at `sm:` and above.
No JS, no third-party carousel lib, **RSC-compatible**.

```tsx
<ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
  {items.map((item) => (
    <li key={item.id} className="shrink-0 basis-[82%] snap-start sm:basis-auto">
      <Card />
    </li>
  ))}
</ul>
```

Six things this pattern enforces:

1. **`-mx-4 px-4`** — the carousel "bleeds" to the viewport edge on
   mobile while the first card stays aligned with the page margin.
   Drop it and the first card looks orphaned; double-pad it and the
   peek of card #2 disappears.
2. **`basis-[82%]`** — leaves a ~18 % peek of the next card visible
   so the user **sees the swipe affordance without any "→" arrow**.
   Tune to the card density:
   - Photo-heavy / text-heavy cards (openings, rankings) → `basis-[82%]`.
   - Compact label cards (8 destinations) → `basis-[72%]` (~28 % peek)
     so two short labels are visible at once and 8 cards only take
     4 swipes, not 8.
3. **`snap-x snap-mandatory` + `snap-start` on each `<li>`** — every
   swipe lands precisely on a card boundary. Without `mandatory` the
   carousel free-scrolls and feels broken; without `snap-start` the
   cards drift mid-card.
4. **`.no-scrollbar`** — defined in `packages/ui/src/globals.css`,
   hides the WebKit + Firefox scrollbar on the carousel only. Don't
   apply globally — desktop pages with `overflow-y-auto` containers
   still need a scrollbar.
5. **`sm:overflow-visible` + `sm:snap-none` (implicit via removing
   `snap-x`)** — the desktop grid must fully reset the flex/snap
   behaviour. A common bug is to forget `sm:overflow-visible` →
   sticky elements get clipped by an invisible `overflow` container
   on desktop.
6. **`shrink-0`** — without it Flexbox shrinks each card to `min-
content` on mobile and the layout collapses to invisibly thin
   stripes. Hard to debug visually because the snap behaviour still
   "works".

Reference implementations:

- `apps/web/src/components/home/home-openings-grid.tsx` — photo cards,
  4 items, `basis-[82%]`.
- `apps/web/src/components/home/home-inspiration-grid.tsx` — text
  cards, 6 items, `basis-[82%]`.
- `apps/web/src/components/home/home-destination-grid.tsx` — compact
  label cards, 8 items, `basis-[72%]` (denser).
- `apps/web/src/components/home/home-top-rankings.tsx` — text cards,
  6 items, `basis-[82%]`.

The `.no-scrollbar` utility is whitelisted in `packages/ui/src/globals.
css` — see the `@layer utilities` block. Reuse it for any horizontal
strip (gallery thumbnails, room types, related hotels, …) that needs
swipe without scrollbar noise.

**Accessibility note** — `prefers-reduced-motion` is already handled
globally (`packages/ui/src/globals.css` sets `scroll-behavior: auto`),
so the snap carousel still works for users who disable smooth scroll.
Keyboard navigation works via tab (each `<li>` `<Link>` is focusable);
arrow-key paging would require a Client Component and is out of scope
for the editorial sections — the visual peek + tab focus is enough.

### Editorial typography

- Titles in serif (`--font-serif`), body in sans (`--font-sans`), 16px base minimum.
- Line-height 1.5 body, 1.2 headings.
- Generous whitespace; never crowded layouts.

## Anti-patterns to refuse

- Hard-coded colors or pixel values in components.
- Desktop-first layouts adapted down to mobile.
- Touch targets < 44px.
- Loading custom fonts without `display: swap` and `<link rel="preload">`.
- Forms without `aria-*` and `label` association.
- Animations longer than 200ms blocking input.

## Booking tunnel UI rules (CDC §7, §9)

- Apple Pay / Google Pay buttons displayed prominently in payment recap (CDC §5.3).
- Cancellation policy block visible **before** payment (verbatim from Amadeus, no maison overlay).
- Step indicator with current step highlighted, accessible name `aria-current="step"`.

## References

- CDC v3.0 §9 (mobile-first), §10 (visual identity), §10.2 (trust signals).
- `accessibility` — APG menu / disclosure patterns, focus-visible rules
  consumed by the CSS-only dropdown.
- `nextjs-app-router` — Server Component / Client Component boundary that
  the dropdown pattern is built to preserve (ADR-0007 auth island).
- `performance-engineering`, `booking-engine` skills.
