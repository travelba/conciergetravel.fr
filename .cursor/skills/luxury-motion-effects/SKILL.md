---
name: luxury-motion-effects
description: Luxury motion design and visual effects for MyConciergeHotel.com — sober micro-interactions, photo hover effects, scroll reveals, page transitions. CSS-first, GPU-only, RSC-compatible, zero LCP impact. Use when adding any animation, transition, hover effect, image treatment, or "wow" visual polish to the UI.
---

# Luxury motion & visual effects — MyConciergeHotel.com

Luxury is **restraint**. The motion language of a 5-star OTA is sober, precise
and fast — never playful or bouncy. Every effect must pass three gates:
GPU-only, reduced-motion safe, zero impact on Core Web Vitals.

## Triggers

Invoke when:

- Adding any animation, transition or hover state to a component.
- Implementing photo effects (hover zoom, gradient overlays, hero treatments).
- Adding scroll-driven reveals or page transitions.
- Reviewing a PR that introduces an animation library.

## Non-negotiable rules

### Motion tokens (extend `packages/ui/tokens.css`)

All durations and easings are tokens — never literals in components:

```css
--motion-fast: 150ms;      /* hover states, focus rings */
--motion-base: 250ms;      /* card lifts, overlays, dropdowns */
--motion-slow: 400ms;      /* photo zooms, reveals — never above 500ms */
--ease-luxury: cubic-bezier(0.22, 1, 0.36, 1); /* ease-out-quint — fast start, soft landing */
```

- **Never** `ease-in` for entrances (feels sluggish), **never** bounce/elastic
  easings (cheapens the brand), **never** durations > 500ms.
- Stagger lists by 40–60ms per item, capped at 6 items — beyond that, animate
  the container only.

### GPU-only properties

- Animate **only** `transform` and `opacity`. Never `width`, `height`, `top`,
  `left`, `margin`, `box-shadow` (animate a pseudo-element's opacity instead).
- Anything that triggers layout or paint on scroll is a refused PR
  (rule `photo-quality.mdc` logic applies: hard gate).
- `will-change` only on elements that actually animate, removed after
  (or applied via the `:hover` parent to keep it scoped).

### CSS-first, RSC-compatible

Same philosophy as the CSS-only dropdowns in `responsive-ui-architecture`:
effects must not force `'use client'` on a Server Component host.

- Hover/focus effects: pure Tailwind (`transition`, `group-hover:`,
  `focus-visible:`) — no JS.
- Scroll reveals: CSS scroll-driven animations with graceful degradation —
  wrap in `@supports (animation-timeline: view())` so unsupported browsers
  simply show the final state (no broken hidden content):

```css
@supports (animation-timeline: view()) {
  .reveal {
    animation: reveal-up var(--motion-slow) var(--ease-luxury) both;
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
  }
}
@keyframes reveal-up {
  from { opacity: 0; transform: translateY(16px); }
}
```

- **No animation library by default.** `framer-motion` (~30kB gzip) is allowed
  only inside an existing Client Component island, only for orchestration CSS
  cannot express (drag, layout animations), and must be lazy-loaded
  (`next/dynamic`). Adding it to a shared layout is a refused PR.

### Photo effects (the luxury signature)

- **Hover zoom on cards** — scale the `<Image>` inside an `overflow-hidden`
  rounded container; pair with a subtle gradient lift:

```tsx
<div className="group overflow-hidden rounded-lg">
  <Image
    className="transition-transform duration-[var(--motion-slow)] ease-[var(--ease-luxury)] group-hover:scale-[1.04]"
    …
  />
  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent opacity-80 transition-opacity group-hover:opacity-60" />
</div>
```

- Scale cap **1.04** (cards) / **1.06** (gallery lightbox) — beyond that the
  Cloudinary-optimised image shows upscaling blur (presets are dimension-locked,
  ADR-0024: never request a larger rendition to "support" a zoom).
- Gradient overlays for text legibility: `from-black/40` max on photography —
  the photo IS the product, never bury it.
- **Hero: no Ken Burns, no autoplaying motion on the LCP element.** The hero
  image must paint immediately (`priority`, no entry animation, no
  opacity-from-0 wrapper). Animate the headline/CTA after paint if desired
  (CSS `animation-delay`, `both` fill — still reduced-motion safe).
- Duotone/blur-up treatments happen in Cloudinary transforms (see
  `photo-quality-seo-geo-agentique` presets), never via CSS `filter` on large
  images (paint cost on mobile).

### Page transitions

- Use the **View Transitions API** via Next.js support — progressive
  enhancement, zero JS cost where unsupported. Keep cross-page transitions to
  a fast fade (`--motion-fast`); shared-element transitions only for
  hotel card → hotel hero.
- Never block navigation on an exit animation.

### Reduced motion & accessibility

- `packages/ui/src/globals.css` already neutralises all animations under
  `prefers-reduced-motion: reduce` (global `animation-duration: 0.01ms`
  override). **Never bypass it** with inline styles or JS-driven animations
  that ignore the media query — JS animations must check
  `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Content must be readable if an entry animation never runs (no permanent
  `opacity-0` initial states outside `@supports` guards).
- Focus states are instant: never delay or animate `focus-visible` rings
  beyond `--motion-fast`.

### Performance gates (PR checklist)

- [ ] No layout/paint properties animated (transform/opacity only).
- [ ] LCP element (hero image, H1) has **zero** entry animation.
- [ ] No new animation dependency in shared layouts.
- [ ] CLS unchanged — effects never reserve or shift space on trigger.
- [ ] Animations ≤ 500ms, interactive feedback ≤ 200ms (INP budget,
      `responsive-ui-architecture` anti-pattern list).
- [ ] Walked the page with reduced motion enabled (`user-acceptance-loop`).

## Anti-patterns to refuse

- Bounce, elastic, spring-heavy easings; durations > 500ms.
- Ken Burns / autoplay motion on the hero LCP image.
- `'use client'` added to a layout/header just for a hover effect.
- Parallax via scroll listeners (JS `scroll` events) — CSS only, or not at all.
- Skeleton shimmer loops running on visible static content.
- Animating `box-shadow`, `filter: blur()` or `background-position` on photos.
- Hover-only affordances with no `focus-visible` equivalent.

## References

- [`responsive-ui-architecture`](../responsive-ui-architecture/SKILL.md) —
  tokens, CSS-only patterns, RSC boundary, INP/touch rules this skill extends.
- [`performance-engineering`](../performance-engineering/SKILL.md) — CWV
  budgets, image/font rules, third-party script policy.
- [`accessibility`](../accessibility/SKILL.md) — focus management, WCAG 2.2 AA.
- [`photo-quality-seo-geo-agentique`](../photo-quality-seo-geo-agentique/SKILL.md)
  — Cloudinary presets (ADR-0024 locked transforms) that bound zoom factors.
- [`nextjs-app-router`](../nextjs-app-router/SKILL.md) — Server/Client
  component boundary, View Transitions support.
