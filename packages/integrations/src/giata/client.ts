/**
 * GIATA MultiCodes HTTP client (REST XML).
 * Spec: https://multicodes.giatamedia.com/webservice/specs/
 */
import { err, ok, type Result } from '@mch/domain/shared';

import { retryingTextRequest } from '../http/retry-request';

import type { GiataError } from './errors';
import {
  parseGiataMulticodesPropertiesXml,
  parseGiataMulticodesPropertyListXml,
  type GiataMulticodesCodeValue,
  type GiataMulticodesPropertyXml,
} from './multicodes-xml';
import {
  GIATA_PROVIDER_TO_SUPPLIER,
  type GiataHotelMatchInput,
  type GiataPropertyLookupInput,
  type GiataPropertyResult,
  type GiataSupplier,
  type GiataSupplierPropertyRow,
} from './types';

export interface GiataMulticodesClientConfig {
  /** Host only, e.g. `https://multicodes.giatamedia.com`. */
  readonly baseUrl: string;
  /** Format `user|company` per GIATA spec (email local-part + pipe + company). */
  readonly username: string;
  readonly password: string;
  /** REST version segment, default `1.latest`. */
  readonly apiVersion?: string;
}

/** @deprecated Prefer `GiataMulticodesClientConfig`. */
export type GiataClientConfig = GiataMulticodesClientConfig;

function basicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function restPrefix(config: GiataMulticodesClientConfig): string {
  const version = config.apiVersion ?? '1.latest';
  return `/webservice/rest/${version}`;
}

function codeValuesToRaw(values: readonly GiataMulticodesCodeValue[]): string {
  return values.map((v) => (v.name !== null ? `${v.name}=${v.value}` : v.value)).join('/');
}

function buildSupplierPropertyKey(
  supplier: GiataSupplier,
  values: readonly GiataMulticodesCodeValue[],
  providerCode: string,
): Record<string, string> | null {
  if (supplier === 'ratehawk') {
    const single = values.find((v) => v.name === null)?.value ?? values[0]?.value;
    if (single === undefined) return null;
    return { hotelId: single };
  }
  if (supplier === 'little_emperors') {
    const single = values.find((v) => v.name === null)?.value ?? values[0]?.value;
    if (single === undefined) return null;
    return { propertyRef: single };
  }

  const byName = new Map<string, string>();
  for (const v of values) {
    if (v.name !== null) byName.set(v.name.toLowerCase(), v.value);
  }

  const hotelCode =
    byName.get('hotel code') ??
    byName.get('property code') ??
    values.find((v) => v.name === null)?.value;
  const chainCode =
    byName.get('chain code') ??
    byName.get('city code') ??
    byName.get('hotel chain') ??
    providerCode;

  if (hotelCode === undefined) return null;
  return {
    chainCode,
    propertyCode: hotelCode,
  };
}

/** Normalise parsed MultiCodes XML → stable crosswalk rows for MCH suppliers. */
export function parseGiataMulticodesProperty(
  property: GiataMulticodesPropertyXml,
): GiataPropertyResult {
  const supplierRows: GiataSupplierPropertyRow[] = [];

  for (const provider of property.providers) {
    const supplier = GIATA_PROVIDER_TO_SUPPLIER[provider.providerCode.toLowerCase()];
    if (supplier === undefined) continue;

    for (const codeValues of provider.codes) {
      const propertyKey = buildSupplierPropertyKey(supplier, codeValues, provider.providerCode);
      if (propertyKey === null) continue;
      supplierRows.push({
        giataId: property.giataId,
        supplier,
        supplierPropertyKey: propertyKey,
        providerCodeRaw: codeValuesToRaw(codeValues),
      });
    }
  }

  return {
    giataId: property.giataId,
    name: property.name,
    city: property.city,
    countryCode: property.countryCode,
    supplierRows,
  };
}

/**
 * Legacy JSON stub adapter — kept for unit tests. Production path is XML via
 * `parseGiataMulticodesProperty`.
 */
export function parseGiataPropertyPayload(
  giataId: string,
  payload: unknown,
): Result<GiataPropertyResult, GiataError> {
  if (payload === null || typeof payload !== 'object') {
    return err({ kind: 'parse_failure', details: 'GIATA response is not an object' });
  }

  const root = payload as Record<string, unknown>;
  const name = typeof root['name'] === 'string' ? root['name'] : null;
  const city = typeof root['city'] === 'string' ? root['city'] : null;
  const countryCode = typeof root['countryCode'] === 'string' ? root['countryCode'] : null;

  const providersRaw = root['providers'] ?? root['supplierCodes'] ?? root['properties'];
  if (!Array.isArray(providersRaw)) {
    return ok({
      giataId,
      name,
      city,
      countryCode,
      supplierRows: [],
    });
  }

  const fakeProviders = providersRaw.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const providerCode = String(row['provider'] ?? row['supplier'] ?? '');
    const chainCode = row['chainCode'] ?? row['chain'];
    const propertyCode = row['propertyCode'] ?? row['code'] ?? row['hotelId'] ?? row['propertyRef'];
    if (propertyCode === null || propertyCode === undefined) return [];

    const values: GiataMulticodesCodeValue[] = [];
    if (chainCode !== null && chainCode !== undefined) {
      values.push({ name: 'Chain Code', value: String(chainCode) });
    }
    values.push({ name: 'Hotel Code', value: String(propertyCode) });

    return [
      {
        providerCode,
        providerType: 'gds',
        codes: [values],
      },
    ];
  });

  return ok(
    parseGiataMulticodesProperty({
      giataId,
      name,
      city,
      cityId: null,
      countryCode,
      providers: fakeProviders,
    }),
  );
}

async function giataGetXml(
  config: GiataMulticodesClientConfig,
  path: string,
): Promise<Result<string, GiataError>> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${restPrefix(config)}${path}`;
  const result = await retryingTextRequest({
    url,
    method: 'GET',
    headers: {
      Accept: 'application/xml, text/xml',
      Authorization: basicAuthHeader(config.username, config.password),
    },
    body: { kind: 'none' },
  });
  if (!result.ok) {
    return err({ kind: 'http', error: result.error });
  }
  return ok(result.value.text);
}

function notFoundError(expectedGiataId?: string): GiataError {
  if (expectedGiataId !== undefined) {
    return { kind: 'not_found', giataId: expectedGiataId };
  }
  return { kind: 'not_found' };
}

function firstPropertyFromXml(
  xml: string,
  expectedGiataId?: string,
): Result<GiataMulticodesPropertyXml, GiataError> {
  const properties = parseGiataMulticodesPropertiesXml(xml);
  if (properties.length === 0) {
    return err(notFoundError(expectedGiataId));
  }
  const first = properties[0];
  if (first === undefined) {
    return err(notFoundError(expectedGiataId));
  }
  return ok(first);
}

/** Fetch property + supplier crosswalk by GIATA ID. */
export async function fetchGiataPropertyById(
  config: GiataMulticodesClientConfig,
  input: GiataPropertyLookupInput,
): Promise<Result<GiataPropertyResult, GiataError>> {
  const xml = await giataGetXml(config, `/properties/${encodeURIComponent(input.giataId)}`);
  if (!xml.ok) return xml;
  const property = firstPropertyFromXml(xml.value, input.giataId);
  if (!property.ok) return property;
  return ok(parseGiataMulticodesProperty(property.value));
}

/** Resolve a property via a GIATA provider code (e.g. `/properties/gds/restel/100679`). */
export async function fetchGiataPropertyByProviderCode(
  config: GiataMulticodesClientConfig,
  input: {
    readonly providerCode: string;
    readonly codeParts: readonly string[];
  },
): Promise<Result<GiataPropertyResult, GiataError>> {
  const segments = input.codeParts.map((part) => encodeURIComponent(part)).join('/');
  const path = `/properties/gds/${encodeURIComponent(input.providerCode)}/${segments}`;
  const xml = await giataGetXml(config, path);
  if (!xml.ok) return xml;
  const property = firstPropertyFromXml(xml.value);
  if (!property.ok) return property;
  return ok(parseGiataMulticodesProperty(property.value));
}

export interface GiataPropertyListPage {
  readonly lastUpdate: string | null;
  readonly properties: readonly { readonly giataId: string; readonly href: string | null }[];
  readonly nextHref: string | null;
}

/** List property refs (test tier caps at ~1 000 per page). */
export async function fetchGiataPropertyList(
  config: GiataMulticodesClientConfig,
  input?: {
    readonly countryCode?: string;
    readonly since?: string;
    readonly path?: string;
  },
): Promise<Result<GiataPropertyListPage, GiataError>> {
  let path = input?.path ?? '/properties/';
  if (input?.path === undefined) {
    if (input?.countryCode !== undefined) {
      path = `/properties/country/${encodeURIComponent(input.countryCode)}`;
      if (input.since !== undefined) {
        path = `${path}/since/${encodeURIComponent(input.since)}`;
      }
    } else if (input?.since !== undefined) {
      path = `/properties/since/${encodeURIComponent(input.since)}`;
    }
  }

  const xml = await giataGetXml(config, path);
  if (!xml.ok) return xml;
  const parsed = parseGiataMulticodesPropertyListXml(xml.value);
  return ok({
    lastUpdate: parsed.lastUpdate,
    properties: parsed.properties.map((p) => ({
      giataId: p.giataId,
      href: p.href,
    })),
    nextHref: parsed.nextHref,
  });
}

/**
 * Name search is not a first-class MultiCodes endpoint. This helper lists
 * properties for a country and filters client-side — suitable only for small
 * test catalogues. Prefer `fetchGiataPropertyByProviderCode` in production.
 */
export async function searchGiataProperty(
  config: GiataMulticodesClientConfig,
  input: GiataHotelMatchInput,
): Promise<Result<readonly GiataPropertyResult[], GiataError>> {
  if (input.countryCode === undefined) {
    return err({
      kind: 'parse_failure',
      details: 'GIATA MultiCodes name search requires countryCode (use country filter)',
    });
  }

  const list = await fetchGiataPropertyList(config, { countryCode: input.countryCode });
  if (!list.ok) return list;

  const needleName = input.name.trim().toLowerCase();
  const needleCity = input.city.trim().toLowerCase();
  const results: GiataPropertyResult[] = [];

  for (const ref of list.value.properties) {
    const property = await fetchGiataPropertyById(config, { giataId: ref.giataId });
    if (!property.ok) continue;
    const name = property.value.name?.toLowerCase() ?? '';
    const city = property.value.city?.toLowerCase() ?? '';
    if (name.includes(needleName) && city.includes(needleCity)) {
      results.push(property.value);
    }
    if (results.length >= 10) break;
  }

  return ok(results);
}
