# GIATA Room Type Mapping (RTM)

Product: [GIATA Room Mapping](https://www.giata.com/en/products-solutions/giata-room-mapping/) — AI grouping of identical room types across suppliers.

**Not** the same as GIATA MultiCodes (property crosswalk). RTM runs at **rate-shop time** to dedupe supplier room labels before picking `min(price)`.

## Staging access

| Item      | Value                                                                          |
| --------- | ------------------------------------------------------------------------------ |
| Base URL  | `https://stagingapi.roommapping.com`                                           |
| Endpoints | `POST /Map`, `POST /MapPlus`                                                   |
| Auth      | HTTP Basic (`GIATA_RTM_USERNAME` / `GIATA_RTM_PASSWORD` in env — never commit) |
| Support   | `support@roommapping.com`                                                      |

Credentials are issued per partner; rotate if exposed in chat or logs.

## Request (JSON)

```json
{
  "Properties": [
    {
      "GiataId": 12345,
      "PropertyName": "Hôtel Example",
      "RoomTypes": [
        "Deluxe King Room - RateHawk",
        "Deluxe King Room",
        "King Deluxe",
        "Twin Standard"
      ]
    }
  ]
}
```

Rules (staging, probed 2026-06-10):

- Top-level `Properties` array is **required**.
- `GiataId` must be numeric (or numeric string).
- `PropertyName` is **required** (empty `RoomTypes` alone is rejected).
- `RoomTypes` is a **string array** of supplier room labels (objects are rejected on input).

## Response

### `/Map` (light)

```json
{
  "properties": [
    {
      "propertyName": "Hôtel Example",
      "giataId": "12345",
      "groups": [
        {
          "groupName": "Deluxe King Room",
          "groupID": 1,
          "roomTypes": ["Deluxe King Room - RateHawk", "Deluxe King Room", "King Deluxe"]
        }
      ]
    }
  ]
}
```

### `/MapPlus` (rich — default in MCH)

Same structure plus `averageRoom` (bed class, `bedDetails`, accessibility flags) and `roomTypes` as objects `{ "roomName", "groupConfidence" }` in the wire format — normalised to strings in `@mch/integrations/giata`.

## Repo wiring

| Layer       | Path                                            |
| ----------- | ----------------------------------------------- |
| Client      | `packages/integrations/src/giata/rtm-client.ts` |
| Rate-shop   | `apps/web/src/server/booking/rate-shopping.ts`  |
| Env         | `GIATA_RTM_*` in `@mch/config/env`              |
| Property id | `hotels.giata_id` (migration `0074`)            |

Grouping order in `shopRates()`:

1. `room_supplier_mappings` → editorial `hotel_rooms.id`
2. GIATA RTM `groupID` when RTM enabled + `giata_id` set
3. Fallback: `unmapped:{supplier}:{label}`

## Env template (local)

```env
GIATA_RTM_ENABLED=1
GIATA_RTM_BASE_URL=https://stagingapi.roommapping.com
GIATA_RTM_USERNAME=...
GIATA_RTM_PASSWORD=...
GIATA_RTM_USE_MAP_PLUS=1
MULTI_SUPPLIER_RATESHOPPING_ENABLED=1
```

## References

- [GIATA MultiCodes](giata-multicodes.md) — property `giataId` required for RTM requests
- [ADR-0026](../adr/0026-multi-supplier-booking-giata.md)
- `@mch/integrations/giata` (MultiCodes + RTM)
