# ADR 0026 — Multi-supplier booking (LE + RateHawk + Travelport, GIATA, Amadeus out)

- Status: accepted
- Date: 2026-06-10
- Supersedes (partially): [ADR-0025](0025-booking-integration-last-brick.md) §Phase 6 vendor list
- Refs:
  - Migration `0071_multi_supplier_bookable_catalog.sql`, `0074_giata_identity.sql`
  - `@mch/integrations/supplier`, `shopRates()` (`apps/web/src/server/booking/rate-shopping.ts`)
  - `@mch/integrations/giata`
  - Seam UI : `apps/web/src/components/hotel/booking-slot.tsx`

## Décision

Phase 6 booking repose sur une architecture **multi-fournisseur opaque** :

| Rôle                          | Fournisseur                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| **Canal principal**           | Little Emperors (API dispo, prix, perks)                            |
| **Couverture complémentaire** | RateHawk (ETG), Travelport                                          |
| **Identité / mapping**        | GIATA MultiCodes (property crosswalk) + **Room Type Mapping** (RTM) |
| **Hors périmètre**            | Amadeus GDS, Little Hotelier, Amadeus Payments                      |

Règles produit :

1. Le voyageur voit **un seul prix** = minimum TTC normalisé cross-fournisseur.
2. Le fournisseur gagnant est **invisible** (DOM, emails, JSON-LD public).
3. À **prix égal**, Little Emperors gagne via `hotel_supplier_connections.priority` (LE = 10, autres = 100).
4. `hotels.booking_mode` (`amadeus` / `little`) est **deprecated** ; la bookabilité se déduit de `hotel_supplier_connections` + mappings.
5. Le **paiement** est branché plus tard via une interface plug-in ; le tunnel peut confirmer en mode agence avant PSP.

## Contexte

Le repo avait anticipé ce modèle (migration 0071, `shopRates`, connecteurs RateHawk/Travelport). La doc Phase 6 et `prepare-hotel-booking-rail` restaient branchés sur Amadeus. Le PO confirme : LE fournira une API complète ; Amadeus est abandonné ; GIATA unifie les identifiants fournisseur.

## Architecture runtime

```
GIATA MultiCodes (seed) → hotel_supplier_connections + giata_id
GIATA RTM (runtime)     → dedupe supplier room labels in shopRates()
room_supplier_mappings  → editorial room join (priority over RTM)
                         ↓
stay query → shopRates() → min(price) per room / global
                         ↓
UI BookingSlot (opaque) → lock(rateToken) → book(winning supplier)
                         ↓
PaymentOrchestrator (TBD)
```

## Conséquences

### Positives

- Couverture catalogue par union de fournisseurs (pas tous les hôtels sur tous les canaux).
- LE comme différenciateur luxe (perks) sans sacrifier le prix minimum affiché.
- Seam UI `BookingSlot` inchangé — flip par flag + connexions DB.

### Négatives / dette

- Mapping chambres = goulot (GIATA + validation manuelle palaces).
- Latence search = fan-out N fournisseurs (cache Redis obligatoire).
- Purge Amadeus progressive (code, env, skills, colonnes).

### Amadeus — décommission

- Ne pas ajouter de nouvelle dépendance Amadeus.
- `getBestOfferForHotel` : legacy fallback jusqu'à suppression tunnel lock Amadeus.
- Skills `amadeus-gds`, `little-hotelier` : marqués deprecated, référencer ADR-0026.

## Implémentation (ordre)

1. `0074_giata_identity` + connecteur `@mch/integrations/giata`
2. `prepare-hotel-booking-rail` → `shopRates` (flag `MULTI_SUPPLIER_RATESHOPPING_ENABLED`)
3. Connecteur LE v1 (dès réception spec API)
4. Tunnel lock opaque multi-supplier
5. Paiement (décision PO)
6. Back-office connexions + montée catalogue

## Open questions

- Modèle merchant of record / facturation LE vs MCH.
- TTL `priceValidUntil` JSON-LD = TTL lock fournisseur (pas +7j fixe).
- Contrat indexabilité contenu RateHawk (tunnel `noindex` uniquement).
