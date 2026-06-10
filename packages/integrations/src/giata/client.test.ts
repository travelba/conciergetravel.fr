import { describe, expect, it } from 'vitest';

import { parseGiataMulticodesProperty, parseGiataPropertyPayload } from './client';
import { parseGiataMulticodesPropertiesXml } from './multicodes-xml';

describe('parseGiataPropertyPayload', () => {
  it('maps provider codes to supplier property keys', () => {
    const result = parseGiataPropertyPayload('12345', {
      name: 'Hôtel Test',
      city: 'Paris',
      countryCode: 'FR',
      providers: [
        { provider: 'ratehawk', hotelId: 'etg_99' },
        { provider: 'little emperors', propertyRef: 'le_42' },
        { provider: 'travelport', chainCode: 'XX', propertyCode: '1234' },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.supplierRows).toHaveLength(3);
    const ratehawk = result.value.supplierRows.find((r) => r.supplier === 'ratehawk');
    expect(ratehawk?.supplierPropertyKey).toEqual({ hotelId: 'etg_99' });
  });

  it('returns empty supplier rows when providers array is absent', () => {
    const result = parseGiataPropertyPayload('99', { name: 'Solo' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.supplierRows).toEqual([]);
  });
});

describe('parseGiataMulticodesProperty', () => {
  it('maps GTA composite codes to Travelport keys', () => {
    const [property] = parseGiataMulticodesPropertiesXml(`<?xml version="1.0"?>
<properties><property giataId="23051">
  <name>Westin</name><city>Berlin</city><country>DE</country>
  <propertyCodes>
    <provider providerCode="gta" providerType="gds">
      <code>
        <value name="City Code">BER</value>
        <value name="Hotel Code">WES1</value>
      </code>
    </provider>
  </propertyCodes>
</property></properties>`);
    if (property === undefined) throw new Error('missing property');
    const result = parseGiataMulticodesProperty(property);
    const travelport = result.supplierRows.find((r) => r.supplier === 'travelport');
    expect(travelport?.supplierPropertyKey).toEqual({ chainCode: 'BER', propertyCode: 'WES1' });
  });
});
