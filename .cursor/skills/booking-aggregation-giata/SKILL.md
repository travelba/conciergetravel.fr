---
name: booking-aggregation-giata
description: Phase 9 multi-supplier booking aggregation for MyConciergeHotel v2 (CDC Q43). GIATA MultiCodes property crosswalk, RateHawk/Travelport/Little Emperors connectors, domain offer dedupe, Makcorps comparator. Replaces amadeus-gds for v2 booking work — Amadeus is out of scope (ADR-0026).
---

# Booking aggregation + GIATA — MyConciergeHotel v2 (Phase 9)

Product decision **Q43** (CDC v2): booking stacks on **GIATA MultiCodes** for
property identity, fans out to **RateHawk, Travelport, Little Emperors** (plus
Expedia / Bedsonline later), and surfaces **one opaque TTC price** — the winning
supplier is never shown. **Amadeus GDS is abandoned**; do not add new Amadeus
dependencies in v2 — use this skill instead of [`amadeus-gds`](../amadeus-gds/SKILL.md).

## Triggers

Invoke when:

- Touching `@mch/domain/booking/supplier-offer` or `aggregate-offers`.
- Touching `@mch/integrations/booking-aggregation/**`.
- Seeding / backfilling `hotels.giata_id`, `giata_supplier_properties`, or `v2.hotel_supplier_codes`.
- Wiring v2 PriceSlot / lock / book paths (Phase 9).
- Agent comparator `/api/agent/compare-prices` (Makcorps / Apify).

## Architecture (Q43)

```mermaid
flowchart TB
  GIATA[GIATA MultiCodes seed] --> MAP[v2.hotel_supplier_codes + giata_supplier_properties]
  MAP --> ORCH[@mch/integrations/booking-aggregation]
  RH[RateHawk connector] --> ORCH
  TP[Travelport connector] --> ORCH
  LE[Little Emperors — TBD] --> ORCH
  ORCH --> DOM[@mch/domain/booking/aggregate-offers]
  DOM --> UI[apps/web-v2 PriceSlot opaque]
  MC[Makcorps / Apify] --> CMP[/api/agent/compare-prices]
```

Runtime rules (ADR-0026):

1. Traveller sees **one TTC EUR price** = `pickBestSupplierOffer` across suppliers.
2. At equal price, **lower `priority` wins** (Little Emperors = 10, others = 100).
3. `priceValidUntil` on public JSON-LD = **vendor TTL**, not a fixed +7d.
4. RateHawk media/descriptions stay **non-indexable** (ETG contract).
5. Payment PSP decision deferred (**Q43-paiement**); sandbox APIs only until PO live handoff (**Q43-accès**).

## Layer map

| Concern                    | Location                                                                      |
| -------------------------- | ----------------------------------------------------------------------------- |
| Normalised offer VO        | `packages/domain/src/booking/supplier-offer.ts`                               |
| Dedupe + best price (pure) | `packages/domain/src/booking/aggregate-offers.ts`                             |
| Connector contract         | `packages/integrations/src/booking-aggregation/types.ts`                      |
| Orchestrator               | `packages/integrations/src/booking-aggregation/index.ts`                      |
| RateHawk stub              | `…/connectors/ratehawk-connector.ts`                                          |
| Travelport stub            | `…/connectors/travelport-connector.ts`                                        |
| GIATA HTTP client          | `packages/integrations/src/giata/`                                            |
| v1 rate-shopping (legacy)  | `apps/web/src/server/booking/rate-shopping.ts` + `@mch/integrations/supplier` |
| GIATA backfill script      | `scripts/editorial-pilot/src/booking/backfill-giata-mapping.ts`               |
| Comparator agent stub      | `apps/web-v2/src/app/api/agent/compare-prices/route.ts`                       |

## GIATA seeding

```bash
# Single hotel (explicit GIATA id)
pnpm --filter @mch/editorial-pilot giata:sync -- --slug=le-meurice --giata-id=<id>

# Batch backfill → hotels.giata_id + v2.hotel_supplier_codes
pnpm --filter @mch/editorial-pilot giata:backfill -- --only-missing --limit=50
pnpm --filter @mch/editorial-pilot giata:backfill -- --slug=ritz-paris --giata-id=<id> --dry-run
```

Env: `GIATA_MC_USERNAME` (`user|company`), `GIATA_MC_PASSWORD`, Supabase service role.

PostgREST writes to `v2.hotel_supplier_codes` require header `Content-Profile: v2`.

## Redis cache — Makcorps comparator

Key pattern (shared with v1):

```
price-cmp:<hotelId>:<checkIn>:<checkOut>:<adults>
```

TTL **15 min**. See [`competitive-pricing-comparison`](../competitive-pricing-comparison/SKILL.md) for legal/UX rules (no affiliate links, TTC disclaimer, hide unavailable rows).

## Anti-patterns

| Anti-pattern                             | Why                                                |
| ---------------------------------------- | -------------------------------------------------- |
| New Amadeus calls in v2                  | Q43 / ADR-0026 — use multi-supplier path           |
| Emitting `Offer` JSON-LD before live ARI | Phase 6 frozen — editorial-only until Phase 9 prod |
| Showing supplier name in DOM / emails    | Opaque pricing contract                            |
| Fixed `priceValidUntil +7d`              | Must mirror vendor lock TTL                        |
| Indexing RateHawk supplier photos        | Contract violation — funnel `noindex` only         |

## References

- [ADR-0026](../../docs/adr/0026-multi-supplier-booking-giata.md) — multi-supplier decision
- [ADR-0033](../../docs/adr/0033-v2-sql-schema-isolation.md) — `v2.hotel_supplier_codes`
- CDC v2 Q42/Q43 — [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../../docs/cdc/cahier-des-charges-v2-booking-like.md)
- [`booking-engine`](../booking-engine/SKILL.md) — tunnel state machine
- [`competitive-pricing-comparison`](../competitive-pricing-comparison/SKILL.md) — Makcorps widget rules
- [`redis-caching`](../redis-caching/SKILL.md) — Upstash patterns
- [`amadeus-gds`](../amadeus-gds/SKILL.md) — **deprecated for v2**; legacy v1 only
