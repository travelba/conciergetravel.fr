/**
 * Dep-free parser for GIATA MultiCodes property XML (REST 1.0 / 1.latest).
 * Spec: https://multicodes.giatamedia.com/webservice/specs/
 */

export interface GiataMulticodesCodeValue {
  readonly name: string | null;
  readonly value: string;
}

export interface GiataMulticodesProviderEntry {
  readonly providerCode: string;
  readonly providerType: string;
  readonly codes: readonly GiataMulticodesCodeValue[][];
}

export interface GiataMulticodesPropertyXml {
  readonly giataId: string;
  readonly name: string | null;
  readonly city: string | null;
  readonly cityId: string | null;
  readonly countryCode: string | null;
  readonly providers: readonly GiataMulticodesProviderEntry[];
}

export interface GiataMulticodesPropertyRef {
  readonly giataId: string;
  readonly lastUpdate: string | null;
  readonly href: string | null;
}

export interface GiataMulticodesPropertyListXml {
  readonly lastUpdate: string | null;
  readonly properties: readonly GiataMulticodesPropertyRef[];
  readonly nextHref: string | null;
}

function decodeXmlText(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function readTagText(block: string, tag: string): string | null {
  const rx = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = rx.exec(block);
  if (match === null || match[1] === undefined) return null;
  const text = decodeXmlText(match[1].replace(/<[^>]+>/g, ''));
  return text.length > 0 ? text : null;
}

function readAttribute(block: string, attribute: string): string | null {
  const rx = new RegExp(`${attribute}="([^"]*)"`, 'i');
  const match = rx.exec(block);
  if (match === null || match[1] === undefined) return null;
  return decodeXmlText(match[1]);
}

function parseCodeValues(codeBlock: string): GiataMulticodesCodeValue[] {
  const values: GiataMulticodesCodeValue[] = [];
  const valueRx = /<value(?:\s+name="([^"]*)")?\s*>([^<]*)<\/value>/gi;
  let match: RegExpExecArray | null = valueRx.exec(codeBlock);
  while (match !== null) {
    const name = match[1] ?? null;
    const value = decodeXmlText(match[2] ?? '');
    if (value.length > 0) values.push({ name, value });
    match = valueRx.exec(codeBlock);
  }
  return values;
}

function parseProviders(propertyBlock: string): GiataMulticodesProviderEntry[] {
  const providers: GiataMulticodesProviderEntry[] = [];
  const providerRx = /<provider\s+([^>]+)>([\s\S]*?)<\/provider>/gi;
  let providerMatch: RegExpExecArray | null = providerRx.exec(propertyBlock);
  while (providerMatch !== null) {
    const attrs = providerMatch[1] ?? '';
    const body = providerMatch[2] ?? '';
    const providerCode = readAttribute(attrs, 'providerCode');
    const providerType = readAttribute(attrs, 'providerType');
    if (providerCode === null || providerType === null) {
      providerMatch = providerRx.exec(propertyBlock);
      continue;
    }

    const codes: GiataMulticodesCodeValue[][] = [];
    const codeRx = /<code>([\s\S]*?)<\/code>/gi;
    let codeMatch: RegExpExecArray | null = codeRx.exec(body);
    while (codeMatch !== null) {
      const codeBlock = codeMatch[1] ?? '';
      const parsed = parseCodeValues(codeBlock);
      if (parsed.length > 0) codes.push(parsed);
      codeMatch = codeRx.exec(body);
    }

    providers.push({ providerCode, providerType, codes });
    providerMatch = providerRx.exec(propertyBlock);
  }
  return providers;
}

function parsePropertyBlock(propertyBlock: string): GiataMulticodesPropertyXml | null {
  const openTagRx = /<property\s+([^>]+)>/i;
  const openMatch = openTagRx.exec(propertyBlock);
  if (openMatch === null) return null;

  const giataId = readAttribute(openMatch[1] ?? '', 'giataId');
  if (giataId === null) return null;

  const cityTagRx = /<city(?:\s+([^>]*))?>([^<]*)<\/city>/i;
  const cityMatch = cityTagRx.exec(propertyBlock);
  const cityId =
    cityMatch !== null && cityMatch[1] !== undefined ? readAttribute(cityMatch[1], 'cityId') : null;
  const city =
    cityMatch !== null && cityMatch[2] !== undefined ? decodeXmlText(cityMatch[2]) : null;

  return {
    giataId,
    name: readTagText(propertyBlock, 'name'),
    city,
    cityId,
    countryCode: readTagText(propertyBlock, 'country'),
    providers: parseProviders(propertyBlock),
  };
}

/** Parse one or more `<property>` nodes from a MultiCodes detail response. */
export function parseGiataMulticodesPropertiesXml(xml: string): GiataMulticodesPropertyXml[] {
  const properties: GiataMulticodesPropertyXml[] = [];
  const propertyRx = /<property\s+[^>]*>[\s\S]*?<\/property>/gi;
  let match: RegExpExecArray | null = propertyRx.exec(xml);
  while (match !== null) {
    const block = match[0];
    const parsed = parsePropertyBlock(block);
    if (parsed !== null) properties.push(parsed);
    match = propertyRx.exec(xml);
  }
  return properties;
}

/** Parse the paginated property index (`/properties/`, filtered lists). */
export function parseGiataMulticodesPropertyListXml(xml: string): GiataMulticodesPropertyListXml {
  const lastUpdate = readAttribute(xml, 'lastUpdate');
  const properties: GiataMulticodesPropertyRef[] = [];

  const selfClosingRx = /<property\s+([^>]+?)(?:\/>|><\/property>)/gi;
  let match: RegExpExecArray | null = selfClosingRx.exec(xml);
  while (match !== null) {
    const attrs = match[1] ?? '';
    const giataId = readAttribute(attrs, 'giataId');
    if (giataId !== null) {
      properties.push({
        giataId,
        lastUpdate: readAttribute(attrs, 'lastUpdate'),
        href: readAttribute(attrs, 'xlink:href') ?? readAttribute(attrs, 'href'),
      });
    }
    match = selfClosingRx.exec(xml);
  }

  const nextHref =
    readAttribute(xml, 'xlink:href') ??
    ((): string | null => {
      const moreRx = /<more\s+[^>]*xlink:href="([^"]*)"/i;
      const moreMatch = moreRx.exec(xml);
      return moreMatch?.[1] ?? null;
    })();

  return { lastUpdate, properties, nextHref };
}
