---
name: user-acceptance-loop
description: >-
  Walk every user-visible change as a real user before commit / push /
  deploy. Use when shipping a new public route, a UI block, a form, a
  nav entry, copy that the user reads, or any "is it visible?" doubt.
  Use also when reporting "it's live" — the message must include the
  walk-through evidence. Hard rule (see `.cursor/rules/user-acceptance-
  before-commit.mdc`) — failure to walk is a CI-equivalent blocker.
---

# User acceptance loop — MyConciergeHotel.com

> Sister document to [`.cursor/rules/user-acceptance-before-commit.mdc`]
> (../../rules/user-acceptance-before-commit.mdc) — the rule states the
> hard policy; this skill is the operating manual (tools, prompts,
> screenshots, scoring rubric).

## Why this skill exists

2026-05-26 — the agent shipped Le Concierge Club (5 pages, 2 endpoints,
50+ files), reported "it's deployed", and the PO landed on the home and
saw nothing. The pages were in production; the nav had no link to them.
Every minute the user spent searching the site for the work is a cost
the agent should have absorbed before pushing.

This skill exists so the agent **always** walks the change first. No
exceptions on user-visible work.

## Triggers

Invoke this skill — and the rule it implements — whenever the agent is
about to:

- `git commit` a change that adds/modifies any of:
  - public route (`apps/web/src/app/**`)
  - UI component (`apps/web/src/components/**`)
  - copy / i18n key (`apps/web/src/i18n/messages/**`)
  - nav, header, footer, mobile menu, breadcrumb
  - form, button, link, modal, dialog
  - JSON-LD / metadata / canonical / hreflang
- `git push`
- Say "it's live", "deployed", "merged", "shipped" in a chat message
- Close a non-trivial task

Skip ONLY for: pure refactor (zero rendered delta), DB migration not yet
wired, vendor adapter not wired to a route, CI/tooling, docs/ADRs/skills.

## The 5-step walk-through

### 1 — Identify the surfaces a real user touches

For every change, list explicitly:

| Surface                      | URL                                                        | Locale  | Viewport         |
| ---------------------------- | ---------------------------------------------------------- | ------- | ---------------- |
| Where the user lands first   | `/`                                                        | fr + en | desktop + mobile |
| Where the change is rendered | `/le-concierge-club`                                       | fr + en | desktop + mobile |
| Where the user discovers it  | header mega-menu, footer, home ribbon                      | fr      | desktop          |
| Failure mode                 | same URL with `MCH_E2E_FAKE_HOTEL_ID=...` or Supabase down | fr      | desktop          |

If the table is empty, the change is back-office only — skip the walk
but justify it explicitly.

### 2 — Get a runnable surface

Two paths, pick the cheapest:

**A. Local dev server** (fastest iteration):

```powershell
cd apps/web
$env:SKIP_ENV_VALIDATION="true"; $env:NEXT_PUBLIC_SKIP_ENV_VALIDATION="true"
npx next dev --port 3000
# First compile = 15-19s. HMR after = sub-second.
```

Caveat: `--turbopack` is incompatible with `experimental.typedRoutes`
(see `.cursor/skills/windows-dev-environment/SKILL.md`).

**B. Vercel preview URL** (canonical truth for catalogue/SEO):

```text
1. Use the `plugin-vercel-vercel` MCP → `list_deployments` filtered on
   the current branch.
2. Pick the latest "READY" deployment.
3. Walk the preview URL with the browser MCP below.
```

**C. Production URL** (when the gap is an already-deployed feature that
isn't surfaced — exactly the 2026-05-26 case):

```text
Walk https://myconciergehotel.com/<locale>/<path> as a real user, screenshot
the gap, then fix in a follow-up commit. The walk is mandatory regardless
of whether the deploy is local, preview, or prod.
```

### 3 — Walk it with the browser MCP

Standard sequence (use the `cursor-ide-browser` MCP):

```text
1. browser_navigate                            → entry URL (home /)
2. browser_snapshot                            → confirm change in DOM
3. browser_take_screenshot                     → above-the-fold proof
4. browser_click  on the discoverability path  → menu > submenu > link
5. browser_take_screenshot                     → confirm landing
6. (repeat for mobile viewport via CDP setDeviceMetricsOverride)
7. (repeat for `/en/...`)
8. browser_lock unlock                         → release the tab
```

For long sequences, delegate to the `browser-use` subagent with a clear
prompt:

```text
Walk https://myconciergehotel.com/fr (and /en) as a first-time visitor
looking for Le Concierge Club. Expected path: homepage → either a hero
ribbon CTA or "Le Concierge" mega-menu → Le Concierge Club landing.
Then go to /fr/le-concierge-club/prestige and confirm the waitlist form
renders for an anonymous user.

For each step report: (a) what was visible above-the-fold, (b) how many
clicks from the home, (c) any console error in DevTools. Screenshot each
landing.

Stop after 6 steps OR if a blocker (auth wall, 500, missing link) needs
operator attention.
```

### 4 — Score visibility

After the walk, score the change on a 4-point rubric:

| Score            | Criterion                                                       |
| ---------------- | --------------------------------------------------------------- |
| ✅ Discoverable  | User reaches it in ≤ 2 clicks from `/` without knowing the URL. |
| ✅ Visible       | Change is above-the-fold OR clearly anchored in the layout.     |
| ✅ Mobile parity | Burger menu, footer, hero strip all reflect the change.         |
| ✅ Both locales  | `fr` and `en` render the change (no missing i18n key).          |

**4/4 = ship.** Anything below = fix the gap BEFORE the commit, not in
a follow-up "I'll do it later" tracker.

### 5 — Report in the chat

The agent's "I'm done" message MUST include:

```markdown
## Walk-through (skill: user-acceptance-loop)

- `/fr/` — Le Concierge Club ribbon visible above-the-fold (eyebrow
  "Notre programme" + 2 CTAs). [screenshot]
- `/en/` — same. [screenshot]
- Discoverability: `/` → Le Concierge mega-menu → "Le Concierge Club"
  (1 click), or hero ribbon CTA (0 clicks). [screenshot]
- Mobile: burger menu → Le Concierge accordion → "Le Concierge Club"
  visible. [screenshot]
- `/fr/le-concierge-club/prestige` — waitlist form rendered for the
  anonymous case. [screenshot]
- Known gaps left unfixed: none.

Score: 4/4 ✅
```

Commit message footer:

```
Tested: walked /fr/, /en/, /fr/le-concierge-club, /fr/le-concierge-club/
  prestige via cursor-ide-browser MCP. Confirmed discoverability via
  header mega-menu + home ribbon (1 click). Mobile burger menu validated.
  Score 4/4.
```

## Tools cheat-sheet

| Tool                                             | When                    | Notes                                                |
| ------------------------------------------------ | ----------------------- | ---------------------------------------------------- |
| `mcp_cursor-ide-browser` browser_navigate        | Open URL                | Use `position` omitted to keep focus on chat         |
| `mcp_cursor-ide-browser` browser_snapshot        | Cheap DOM check         | Accessibility tree; refs are short-lived             |
| `mcp_cursor-ide-browser` browser_take_screenshot | Visual proof            | Attaches image to chat — the model can read it back  |
| `mcp_cursor-ide-browser` browser_click           | Follow links            | Use the `ref` from the last snapshot                 |
| `mcp_cursor-ide-browser` browser_lock / unlock   | Multi-step automation   | Lock BEFORE the loop, unlock at the end              |
| `mcp_cursor-ide-browser` browser_cdp             | Mobile emulation        | `Emulation.setDeviceMetricsOverride` + `Page.reload` |
| `browser-use` subagent                           | Long flows (≥ 5 clicks) | Delegate with explicit start URL + success criterion |
| `mcp_plugin-vercel-vercel` list_deployments      | Preview URL lookup      | Filter on branch + state=READY                       |

## Hotel kit fiche closure (`HOTEL_KIT_SLUGS`)

**Mandatory in addition to steps 1–5** when shipping or claiming « livré » on a kit
hotel page. Skill detail : [`hotel-kit-rollout`](../hotel-kit-rollout/SKILL.md) Rule 6.

Before browser walk, run:

```powershell
pnpm --filter @mch/editorial-pilot audit:hotel-fiches-cdc -- --slug=<slug>
```

**Exit code must be 0** — any failed `kit.*` gate blocks ship (D19). A score CDC ≥ 95 %
with red `kit.*` gates is **not** acceptance.

Browser compare vs `/hotel/les-airelles-gordes` (same locale):

| Section                         | Pass criterion                                               |
| ------------------------------- | ------------------------------------------------------------ |
| `#chambres`                     | Badge Concierge on **card 1** ; photo on all 3 visible cards |
| `#hotel-en-bref`                | Spa + restaurant photos match labels                         |
| `#acces`                        | ≥ 3 Google reviews with author + date (no press)             |
| `#faq` + `#concierge-questions` | Depth comparable to reference (not 5 FAQ stub)               |
| `#autour`                       | Dedicated POI thumbnail per item                             |

Report `Tested:` must cite audit exit 0 + screenshots of the 5 sections FR+EN.

## Common walk recipes

### Recipe A — new public route

```text
1. /fr/<new-route> → screenshot above-the-fold
2. /en/<new-route> → screenshot above-the-fold
3. /fr/ → can the user discover it? screenshot the click path
4. mobile viewport (375x812) → repeat 3
5. view-source: check canonical / hreflang / robots tags
```

### Recipe B — new nav entry

```text
1. /fr/ → mega-menu hover/open → screenshot
2. /fr/ → burger → accordion → screenshot
3. /fr/<destination of the link> → confirm landing
4. /en/ → repeat 1+2 (different label, same path)
```

### Recipe C — new form / signup

```text
1. Navigate to the form page
2. browser_fill all required fields with realistic data
3. Submit → screenshot the result page
4. Submit again → confirm idempotency / error UX
5. Trigger honeypot path manually → confirm no spam reaches the inbox
```

### Recipe D — copy / i18n change

```text
1. /fr/<route> → screenshot the section with the new copy
2. /en/<route> → screenshot the section with the new copy
3. Grep for missing key warnings in the browser console (no `<missing key>`)
```

### Recipe E — JSON-LD / SEO

```text
1. browser_navigate to the route
2. browser_cdp method=Runtime.evaluate with expression="document.querySelectorAll('script[type=\"application/ld+json\"]').length"
3. browser_cdp method=Runtime.evaluate with expression="[...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s=>JSON.parse(s.textContent))"
4. Assert: every expected @type is present (Hotel, FAQPage, BreadcrumbList…)
5. Paste a single payload into the Google Rich Results validator (manual)
```

## Anti-patterns

| Anti-pattern                                          | Symptom                                                | Fix                                             |
| ----------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| "tsc + lint passed → shipping"                        | Invisible features in production                       | Add the walk                                    |
| Walking only the new route, not the entry path        | User can't find the page from `/`                      | Walk the home + click path                      |
| Skipping the mobile viewport                          | Burger menu out-of-sync with desktop mega-menu         | Always test 375x812                             |
| Walking only `fr`                                     | EN locale ships with raw i18n keys                     | Walk both locales                               |
| "I'll add the nav entry in a follow-up"               | The follow-up never lands; users are confused for days | Block the original commit, ship both at once    |
| Screenshot taken at the wrong viewport / browser size | False positive: looks fine but real users see overflow | Match user viewports (desktop 1280, mobile 375) |
| Confirming the page renders, not that it's reachable  | Reachability gap                                       | Score 4/4 includes Discoverability              |

## Reference cases (capitalised lessons)

- **2026-05-26 — Concierge Club invisibility** — `af4dc50` shipped
  5 routes + 2 endpoints; nav, footer, mobile, homepage had zero
  references to them. Follow-up `87caf8b` added the entries. The rule
  this skill enforces would have caught it at step 4 (Score) of the
  walk-through.

## References

- Hard rule: `.cursor/rules/user-acceptance-before-commit.mdc`
- E2E regression net: [`test-strategy`](../test-strategy/SKILL.md) —
  Vitest + Playwright + axe + Lighthouse; this skill is the manual
  pre-commit step that complements the automated regression suite.
- Vercel preview lookup: [`cicd-release-management`](../cicd-release-management/SKILL.md).
- Windows-specific shell quirks (when running `pnpm dev` or browser MCP
  on Windows): [`windows-dev-environment`](../windows-dev-environment/SKILL.md).
- Membership funnel context (the 2026-05-26 case study above):
  [`membership-program`](../membership-program/SKILL.md).
- Cursor browser MCP descriptors: `mcps/cursor-ide-browser/` folder.
- Browser-use subagent: see the Task tool prompt at session start.
