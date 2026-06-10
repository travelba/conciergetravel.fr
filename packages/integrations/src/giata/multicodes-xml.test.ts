import { describe, expect, it } from 'vitest';

import {
  parseGiataMulticodesPropertiesXml,
  parseGiataMulticodesPropertyListXml,
} from './multicodes-xml';

const WESTIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<properties xmlns:xlink="http://www.w3.org/1999/xlink">
  <property giataId="23051" lastUpdate="2016-07-10T02:10:08+02:00">
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
        <code>
          <value>100679</value>
        </code>
      </provider>
    </propertyCodes>
  </property>
</properties>`;

const LIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<properties xmlns:xlink="http://www.w3.org/1999/xlink" lastUpdate="2016-07-15">
  <property giataId="3" lastUpdate="2016-07-10T02:10:08+02:00"
        xlink:href="https://multicodes.giatamedia.com/webservice/rest/1.0/properties/3"/>
  <property giataId="4" lastUpdate="2016-07-10T02:10:08+02:00"
        xlink:href="https://multicodes.giatamedia.com/webservice/rest/1.0/properties/4"/>
</properties>`;

describe('parseGiataMulticodesPropertiesXml', () => {
  it('parses property detail with composite and simple GDS codes', () => {
    const props = parseGiataMulticodesPropertiesXml(WESTIN_XML);
    expect(props).toHaveLength(1);
    const p = props[0];
    expect(p?.giataId).toBe('23051');
    expect(p?.name).toBe('The Westin Grand Berlin');
    expect(p?.city).toBe('Berlin');
    expect(p?.cityId).toBe('2791');
    expect(p?.countryCode).toBe('DE');
    expect(p?.providers).toHaveLength(2);

    const gta = p?.providers.find((row) => row.providerCode === 'gta');
    expect(gta?.codes[0]).toEqual([
      { name: 'Country Code', value: 'DE' },
      { name: 'City Code', value: 'BER' },
      { name: 'Hotel Code', value: 'WES1' },
    ]);

    const restel = p?.providers.find((row) => row.providerCode === 'restel');
    expect(restel?.codes[0]).toEqual([{ name: null, value: '100679' }]);
  });
});

describe('parseGiataMulticodesPropertyListXml', () => {
  it('parses property index refs', () => {
    const list = parseGiataMulticodesPropertyListXml(LIST_XML);
    expect(list.lastUpdate).toBe('2016-07-15');
    expect(list.properties).toHaveLength(2);
    expect(list.properties[0]?.giataId).toBe('3');
    expect(list.properties[0]?.href).toContain('/properties/3');
  });
});
