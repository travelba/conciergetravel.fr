---
name: stitch-mcp-pipeline
description: Google Stitch MCP pipeline for MyConciergeHotel.com — generate UI screens via Gemini from text prompts, with the project's "Parisian Concierge" design system uploaded as DESIGN.md. Use when generating, editing, or downloading Stitch screens (per-block hotel page, search results, booking widget, room sub-page), when uploading or updating the design system, or when troubleshooting Stitch caching, encoding, or HTTP MCP connectivity.
---

# Stitch MCP pipeline — MyConciergeHotel.com

Stitch is Google Labs' UI-from-text generator (Gemini-powered). The repo uses it to scaffold the visual layer (15 blocks of the hotel detail page, search, room sub-pages, etc.) before translating the output into shadcn/Tailwind components.

## Triggers

Invoke when:

- Creating or editing a screen in the Stitch project `MCH — Hotel Detail Page V1` (id `4942013958735480664`).
- Uploading or refreshing the design system from [`docs/design/DESIGN.md`](../../../docs/design/DESIGN.md).
- Translating a Stitch HTML export into a `.tsx` component under `apps/web/src/components/`.
- Debugging "Invalid argument", encoding glitches, or stale `get_screen` results.

## Architectural anchor

| Resource            | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| MCP endpoint        | `https://stitch.googleapis.com/mcp`                                                           |
| Auth header         | `X-Goog-Api-Key: <key>` (Stitch settings, doesn't expire)                                     |
| Cursor MCP entry    | `~/.cursor/mcp.json` `mcpServers.stitch`                                                      |
| Project ID (V1)     | `4942013958735480664` ("MCH — Hotel Detail Page V1")                                          |
| Design system asset | `assets/08017b60a76f45aab3e39ff3e603fa32` ("The Parisian Concierge")                          |
| Source DESIGN.md    | [`docs/design/DESIGN.md`](../../../docs/design/DESIGN.md) (16 KB, 265 lines, source of truth) |
| Generated screens   | [`docs/design/stitch-screens/<NN-block-name>/`](../../../docs/design/stitch-screens/)         |
| Free tier           | 350 generations / month                                                                       |

## Rule 1 — Three-step bootstrap, not one

The DS upload chain is **non-obvious**. `create_design_system_from_design_md` requires a `selectedScreenInstance` returned by `upload_design_md`. The right sequence:

```
1. create_project(title)
   → returns projects/<id>

2. upload_design_md(projectId, designMdBase64)
   → returns { id, sourceScreen, width, height }   ← keep these!

3. create_design_system_from_design_md(
      projectId,
      selectedScreenInstance: { id, sourceScreen },
      deviceType: "DESKTOP")
   → returns { assetId }
```

Trying to skip step 2 (e.g. calling `create_design_system_from_design_md` with a hand-crafted screen instance) returns `Invalid argument`. The screen instance is what binds the markdown to the project's screens table.

## Rule 2 — `htmlCode` and `screenshot` are file refs, not strings

After `generate_screen_from_text` or `edit_screens`, the screen's `htmlCode` and `screenshot` fields are objects shaped:

```json
{ "downloadUrl": "https://contribution.usercontent.google.com/...",
  "mimeType": "text/html" | "image/png",
  "name": "projects/<id>/files/<fileId>" }
```

**Don't** call `.Substring()` on `htmlCode` — it'll throw `[PSCustomObject] does not contain Substring`. Always download via `curl` from `downloadUrl`. Reference impl: [`docs/design/stitch-screens/01-hotel-header/`](../../../docs/design/stitch-screens/01-hotel-header/) — `screen.html`, `screenshot.png`, `hero-bg.png`.

## Rule 3 — `get_screen` after `edit_screens` returns the **stale** export

When you call `edit_screens`, Stitch enregisters DOM operations (visible in `outputComponents[*].sessionEvent.eventPayload.dom_operations`). The canvas in the Stitch web UI applies the patches live. **But `get_screen` keeps returning the pre-edit `htmlCode` and `screenshot` for several minutes**, possibly hours.

Two ways to obtain a fresh export after edits:

1. **Open the canvas** in `https://stitch.withgoogle.com/projects/<projectId>` — the live render reflects the patches.
2. **Re-generate from scratch** with `generate_screen_from_text` and a corrected prompt — costs 1 generation but produces a clean static export.

Mark this in `metadata.json` `knownIssues` for every block edited via `edit_screens`. Pattern:

```json
"knownIssues": [
  "Stitch caches the screenshot/HTML export. After edit_screens, get_screen returns the pre-edit HTML even though the canvas reflects the patches. Re-generate via generate_screen_from_text for a fresh static export."
]
```

## Rule 4 — Always pass `designSystem: assets/<id>` on every generation

Without an explicit `designSystem` argument, Stitch falls back to a generic Material 3 default — your "Parisian Concierge" tokens (anthracite, bronze, EB Garamond) **will not** be applied. Always pass:

```json
{
  "name": "generate_screen_from_text",
  "arguments": {
    "projectId": "4942013958735480664",
    "prompt": "...",
    "designSystem": "assets/08017b60a76f45aab3e39ff3e603fa32",
    "deviceType": "DESKTOP",
    "modelId": "GEMINI_3_1_PRO"
  }
}
```

`GEMINI_3_PRO` is deprecated — use `GEMINI_3_1_PRO` (quality) or `GEMINI_3_FLASH` (speed). The Pro model takes 30-100 s per block and is the default for fiche-quality output.

## Rule 5 — `Invalid argument` is almost always a payload encoding bug

When Stitch rejects a request in <1 second with `Request contains an invalid argument.`, the cause is typically:

1. **The `prompt` was wrapped as an object** instead of a flat string. Caused by `Get-Content -Raw` on PowerShell 5.1 (returns a decorated PSObject, not a `[string]`). See `windows-dev-environment` skill §Rule 11.
2. **The payload includes `ReadCount` / `PSCredential` / `DisplayRoot` metadata** — same root cause: a PSObject got serialised by `ConvertTo-Json`.
3. **A required field is missing** — most often `selectedScreenInstance` on `create_design_system_from_design_md`, or `selectedScreenIds` on `edit_screens`.

Fix: always read prompt files via `[System.IO.File]::ReadAllText(path, [System.Text.Encoding]::UTF8)` and write JSON via `[System.IO.File]::WriteAllText(path, json, [System.Text.UTF8Encoding]::new($false))`. See `windows-dev-environment` Rule 11 for the canonical PowerShell pattern.

## Rule 6 — Prompt anatomy that gets ~80 % first-shot conformance

A 4 000-7 000 char prompt with these 6 sections gives the best results on `GEMINI_3_1_PRO`:

1. **Mood reference** — name 2 concrete brands ("Booking.com efficiency × Le Bristol Paris aesthetic"). Anti-mood explicit.
2. **Mock data** — exact hotel name, awards (with year), rating ("4,8 / 5"), address, distance to landmark.
3. **Layout** — numbered sections with exact pixel values, padding, max-widths, and inline elements stack order.
4. **Tokens** — repeat the hex codes inline even when `designSystem` is set (Gemini sometimes ignores assets when the prompt is rich).
5. **Anti-patterns** — bulleted "strictly forbidden" list (no red CTAs, no urgency, no glassmorphism, no filled icons, no auto-play).
6. **Microcopy + A11y** — every visible string in the target language (FR by default), WCAG 2.2 AA constraints (focus-visible bronze 2 px, contrast ≥ 4.5:1, touch targets ≥ 44 px).

Reference prompt: the v1 generation of `01-hotel-header/` (6 559 chars, 99 s, ~80 % first-shot conformance — 4 anomalies fixed in a 1 945-char `edit_screens` follow-up). Track every prompt in `metadata.json` `generations[*]`.

## Rule 7 — Edit prompts must be **diff-only**, never re-describe the layout

`edit_screens` works best with a 1 500-2 500 char prompt that lists only the changes. Re-describing the entire layout invites Gemini to re-introduce anomalies you just fixed. Pattern:

```
Make exactly these N corrections to the existing screen.
Do NOT change the rest of the layout, do NOT alter any other content,
do NOT add new sections.

# Correction 1 — <one focused change>
Current: <quote the wrong text/style>
Replace with: <exact new text/style>

# Correction 2 — ...

Strict constraints (do not violate while editing):
- <invariants that must be preserved>
- <anti-patterns still forbidden>
```

Reference: the v1-edit on `01-hotel-header/` (4 corrections, 7 DOM operations, 31 s wall-clock).

## Rule 8 — Cursor MCP is loaded but tools may not be exposed in-session

Cursor connects the Stitch MCP successfully (logs `Successfully connected to streamableHttp server` in `~/AppData/Roaming/Cursor/logs/<date>/window<N>/exthost/anysphere.cursor-mcp/MCP user-stitch.*.log`) but **the 14 tools may not appear in the agent's tool list**. The cause is the per-server "Enable tools" toggle in `Settings → MCP`.

Two paths to unblock:

1. **Manual toggle** : `Ctrl+Shift+J → MCP → stitch → Enable / Approve tools`. No restart needed.
2. **Shell fallback** : invoke the MCP via `curl` directly (works whether or not Cursor exposes the tools to the agent). Pattern:

```powershell
$payload = @{ jsonrpc="2.0"; id=1; method="tools/call"; params=@{
  name="generate_screen_from_text"; arguments=@{...}
} } | ConvertTo-Json -Depth 6 -Compress
[System.IO.File]::WriteAllText("payload.json", $payload, [System.Text.UTF8Encoding]::new($false))
curl.exe -sS -X POST "https://stitch.googleapis.com/mcp" `
  -H "Content-Type: application/json" `
  -H "Accept: application/json, text/event-stream" `
  -H "X-Goog-Api-Key: $env:STITCH_API_KEY" `
  --data-binary "@payload.json" --max-time 360
```

This is the path the v1 + v1-edit of `01-hotel-header/` were generated through.

## Rule 9 — Output traceability is mandatory

Every generated block must have a `metadata.json` next to its `screen.html` + `screenshot.png` capturing:

- `block` (1-16) and `blockName`
- `cdcReference` (path to `.cursor/rules/hotel-detail-page.mdc` row)
- Stitch project ID + URL + DS asset ID
- `screens.main.id` + screen `name` (resource path)
- `generations[]` array — one entry per call, with `tool`, `model`, `promptLength`, `elapsedSeconds`, `sessionId`, `generatedAt`
- `knownIssues[]`

Reference: [`docs/design/stitch-screens/01-hotel-header/metadata.json`](../../../docs/design/stitch-screens/01-hotel-header/metadata.json).

## Rule 10 — Stitch HTML export uses Tailwind via CDN — do **not** ship as-is

Stitch outputs a self-contained HTML with `<script src="https://cdn.tailwindcss.com">` and inline `tailwind.config = { ... }`. This is fine for review but is **never** what ships to production. The translation pipeline:

1. **Extract tokens** from the inline `tailwind.config` → merge into `apps/web/tailwind.config.ts` (`theme.extend.colors.mch.*`, `fontFamily`, `fontSize`, `borderRadius`, `spacing`).
2. **Replace Material Symbols icons** with `lucide-react` outline (skill `responsive-ui-architecture` §Iconography).
3. **Wrap interactive zones in shadcn primitives** (`Button`, `Tooltip`, `DropdownMenu`, `Sheet`).
4. **Hoist H1, JSON-LD, A11y landmarks** into the Server Component (`'use client'` only on genuinely interactive sub-islands).
5. **Translate the hard-coded mock data** into props consumed from Supabase + Payload.

The HTML is a **specification artefact**, not a deliverable.

## Anti-patterns

- ❌ Embedding the API key in committed files (`mcp.json` is fine, it lives in `~/.cursor/`, not in the repo). Never hardcode in `scripts/`.
- ❌ Calling `create_design_system_from_design_md` without the screen instance from `upload_design_md`.
- ❌ Relying on `get_screen` for a fresh post-edit export (use the canvas or re-generate).
- ❌ Skipping the `designSystem` parameter on `generate_screen_from_text` (falls back to a generic Material 3 default).
- ❌ Re-describing the full layout in an `edit_screens` prompt (re-introduces anomalies).
- ❌ Reading prompts via `Get-Content -Raw` and feeding to `ConvertTo-Json` (PSObject wrapping bug — see `windows-dev-environment` Rule 11).
- ❌ Writing payloads with `Out-File -Encoding utf8` (BOM-prefixed JSON breaks Stitch's parser; use `[IO.File]::WriteAllText` with `UTF8Encoding($false)`).
- ❌ Trusting the PowerShell console UTF-8 rendering — `★`, `€`, `é` look like `?`, `‡`, `\t` but the bytes on disk are correct.
- ❌ Shipping the Stitch HTML as a route in `apps/web` (always translate to a Server Component first).

## References

- [`docs/design/DESIGN.md`](../../../docs/design/DESIGN.md) — DS source of truth.
- [`docs/design/stitch-screens/`](../../../docs/design/stitch-screens/) — generated blocks + metadata.
- [`.cursor/skills/windows-dev-environment/SKILL.md`](../windows-dev-environment/SKILL.md) — PowerShell + UTF-8 + JSON traps (Rule 11).
- [`.cursor/skills/responsive-ui-architecture/SKILL.md`](../responsive-ui-architecture/SKILL.md) — token system + shadcn primitives target.
- [`.cursor/skills/accessibility/SKILL.md`](../accessibility/SKILL.md) — WCAG 2.2 AA enforcement on translated components.
- [`.cursor/rules/hotel-detail-page.mdc`](../../rules/hotel-detail-page.mdc) — 15-block CDC §2 contract that Stitch generations must respect.
- [`EDITORIAL_VOICE.md`](../../../EDITORIAL_VOICE.md) — Concierge microcopy injected into every prompt.
- Free tier: 350 generations / month per Google account.
