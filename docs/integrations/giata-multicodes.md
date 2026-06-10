# GIATA MultiCodes (MC)

Product: [GIATA MultiCodes](https://www.giata.com/) — canonical property identity (~1.4 M hotels) and crosswalk to ~500 supplier/GDS codes.

**Distinct from** [GIATA Room Type Mapping](giata-rtm.md) (runtime room dedupe) and **GIATA MHG** (multilingual content).

## Test access (Travelba)

| Item           | Detail                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Spec           | https://multicodes.giatamedia.com/webservice/specs/                            |
| Property index | `GET /webservice/rest/1.latest/properties/`                                    |
| Auth           | HTTP Basic — username `emailLocalPart\|companyName`, password from GIATA email |
| Test scope     | **3 providers** (Restel, GoGlobal, AIC Travelgroup) + **~1 000 properties**    |
| Production     | ~500 providers, full catalogue                                                 |

Credentials arrive **by email only** — never commit. Reset link valid ~24 h after provisioning.

**Portal login ≠ API login.** The GIATA web portal may use `email + password`, but the REST API expects HTTP Basic with username `localPart|companyName` (spec §1), e.g. `benjamin|Travelba` — not `benjamin@travelba.fr`. If all variants return 401, copy the exact username string from Anne's email or ask GIATA support.

## Wire format

- REST + **XML** (not JSON)
- Stable schema `1.0`, evolving `1.latest` (default in MCH)
- Single property: `GET …/properties/{giataId}`
- By supplier code: `GET …/properties/gds/{providerCode}/{code…}`
- Filters: `country/FR`, `since/2016-07-15`, `city/{cityId}`, `gds/restel`, …

Example property excerpt (spec §2.2):

```xml
<property giataId="23051">
  <name>The Westin Grand Berlin</name>
  <city cityId="2791">Berlin</city>
  <country>DE</country>
  <propertyCodes>
    <provider providerCode="gta" providerType="gds">
      <code>
        <value name="Country Code">DE</value>
        <value name="City Code">BER</value>
        <value name="Hotel Code">WES1</value>
      </code>
    </provider>
    <provider providerCode="restel" providerType="gds">
      <code><value>100679</value></code>
    </provider>
  </propertyCodes>
</property>
```

## Repo wiring

| Layer       | Path                                                              |
| ----------- | ----------------------------------------------------------------- |
| XML parser  | `packages/integrations/src/giata/multicodes-xml.ts`               |
| HTTP client | `packages/integrations/src/giata/client.ts`                       |
| Env helper  | `apps/web/src/server/giata/multicodes-config.ts`                  |
| Seed script | `scripts/editorial-pilot/src/booking/sync-giata-hotel.ts`         |
| DB          | `hotels.giata_id`, `giata_supplier_properties` (migration `0074`) |

`GIATA_PROVIDER_TO_SUPPLIER` maps GIATA `providerCode` → MCH suppliers (`travelport`, `ratehawk`, `little_emperors`). **Test-tier providers (Restel, GoGlobal, AIC) do not map** — crosswalk seeding returns 0 connections until production unlocks RateHawk / Travelport / LE codes.

## Env template

```env
GIATA_ENABLED=1
GIATA_MC_BASE_URL=https://multicodes.giatamedia.com
GIATA_MC_USERNAME=you@travelba.fr|Travelba
GIATA_MC_PASSWORD=...
GIATA_MC_API_VERSION=1.latest
```

## CLI smoke test

```bash
pnpm --filter @mch/editorial-pilot giata:sync -- --slug=le-meurice --giata-id=<id-from-mc-index>
```

Pick a `giataId` from the test property list after authenticating against `/properties/`.

## References

- [ADR-0026](../adr/0026-multi-supplier-booking-giata.md)
- Provider statistics: https://content-statistics.giatamedia.com/statistics/latest/#multicodes
