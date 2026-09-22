# MyConciergeHotel — Mobile (Expo)

Native companion app for **MyConciergeHotel v2** (`apps/mobile`). Shares
`@mch/domain` business rules and mirrors `@mch/ui-v2/tokens.css` via
`lib/theme.ts` (native) and a web-only CSS import in `app/_layout.tsx`.

## Stack

- **Expo SDK 52+** (managed workflow)
- **expo-router** — file-based navigation
- **TypeScript strict**
- BFF: `apps/web-v2` at `/api/mobile/v1/*` (no vendor secrets in the bundle)

## Development

```bash
# From repo root — install deps first (pnpm install)
cd apps/mobile
pnpm start

# Point the BFF at local web-v2 (default http://localhost:3001)
export EXPO_PUBLIC_BFF_BASE_URL=http://localhost:3001   # bash
$env:EXPO_PUBLIC_BFF_BASE_URL="http://localhost:3001"   # PowerShell
```

Run `apps/web-v2` on port **3001** (`pnpm --filter @mch/web-v2 dev`) so hotel
fiches and search resolve against the BFF.

## Routes

| App route       | Web canonical URL | Purpose                          |
| --------------- | ----------------- | -------------------------------- |
| `/`             | `/`               | Home + search entry              |
| `/search?q=…`   | `/recherche?q=…`  | Search results                   |
| `/hotel/[slug]` | `/hotel/[slug]`   | Hotel fiche (ADR-0008 flat slug) |

Every share action must emit the **canonical web URL** — the app feeds SEO,
it never competes with it (skill: `mobile-app-expo`).

## Universal links & App Links

Deep links map **1:1** to canonical web URLs so a link opened on device routes
to the app when installed, or to the website otherwise.

### iOS — Associated Domains

Configured in `app.json`:

```json
"associatedDomains": [
  "applinks:myconciergehotel.com",
  "applinks:www.myconciergehotel.com"
]
```

**Apple App Site Association** must be served by `apps/web-v2` (or v1 during
transition) at:

```
https://myconciergehotel.com/.well-known/apple-app-site-association
```

Example paths to delegate (no JSON extension, `Content-Type: application/json`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.myconciergehotel.app",
        "paths": ["/hotel/*", "/recherche", "/recherche/*", "/en/hotel/*"]
      }
    ]
  }
}
```

Replace `TEAMID` with the Apple Developer Team ID before store submission.

### Android — App Links

Configured in `app.json` `intentFilters` with `autoVerify: true` for
`https://myconciergehotel.com/hotel/*` and `/recherche`.

**Digital Asset Links** file:

```
https://myconciergehotel.com/.well-known/assetlinks.json
```

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.myconciergehotel.app",
      "sha256_cert_fingerprints": ["AA:BB:…"]
    }
  }
]
```

Obtain the SHA-256 from the EAS build signing certificate (`eas credentials`).

### Custom URL scheme

Fallback scheme: `myconciergehotel://hotel/le-meurice` — use only for dev /
QA; production traffic should prefer HTTPS universal links.

### expo-router mapping

| Incoming HTTPS path    | expo-router screen                                     |
| ---------------------- | ------------------------------------------------------ |
| `/hotel/le-meurice`    | `/hotel/le-meurice`                                    |
| `/en/hotel/le-meurice` | `/hotel/le-meurice` (locale handled by BFF `?locale=`) |
| `/recherche?q=paris`   | `/search?q=paris`                                      |

Add a linking config in `app/_layout.tsx` or `expo-linking` when locale-prefixed
paths need normalisation (strip `/en` prefix before navigation).

## Security

- **Anon Supabase key only** — never ship service-role or Amadeus secrets.
- Offers/prices: respect server TTL (≤ 5 min staleTime when TanStack Query
  is wired).
- GDPR: same consent surface as web before analytics (Sentry RN with PII scrub).

## References

- `.cursor/skills/mobile-app-expo/SKILL.md`
- `docs/v2/url-mapping-v1-v2.md`
- ADR-0008 — flat hotel URLs
