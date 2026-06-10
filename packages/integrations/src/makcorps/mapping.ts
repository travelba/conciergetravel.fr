import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '@mch/integrations/http';

import type { MakcorpsError } from './errors';
import type { MakcorpsClientConfig } from './client';

interface MakcorpsMappingHit {
  readonly document_id?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
}

function readDocumentId(hit: MakcorpsMappingHit): string | null {
  if (typeof hit.document_id === 'string' && hit.document_id.length > 0) {
    return hit.document_id;
  }
  if (typeof hit.document_id === 'number' && Number.isFinite(hit.document_id)) {
    return String(hit.document_id);
  }
  return null;
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Resolve a Makcorps `document_id` via the Mapping API
 * (`GET /mapping?name=Hotel Name, City`).
 */
export async function resolveMakcorpsHotelId(
  cfg: MakcorpsClientConfig,
  input: { readonly name: string; readonly city: string },
): Promise<Result<string, MakcorpsError>> {
  const url = new URL('/mapping', cfg.baseUrl);
  url.searchParams.set('name', `${input.name}, ${input.city}`);
  url.searchParams.set('api_key', cfg.apiKey);

  const res = await retryingJsonRequest({
    url: url.toString(),
    method: 'GET',
    headers: { Accept: 'application/json' },
    body: { kind: 'none' },
  });
  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined) {
    return err({ kind: 'parse_failure', details: 'empty makcorps mapping response' });
  }

  const raw = res.value.json;
  if (!Array.isArray(raw)) {
    return err({ kind: 'parse_failure', details: 'makcorps mapping response is not an array' });
  }

  const hotels = raw.filter((item): item is MakcorpsMappingHit => {
    if (typeof item !== 'object' || item === null) return false;
    const type = (item as MakcorpsMappingHit).type;
    return type === 'HOTEL' || type === undefined;
  });

  const target = input.name.trim().toLowerCase();
  const exact = hotels.find((h) => normalizeName(h.name) === target);
  if (exact !== undefined) {
    const id = readDocumentId(exact);
    if (id !== null) return ok(id);
  }

  const partial = hotels.find((h) => {
    const n = normalizeName(h.name);
    return n.includes(target) || target.includes(n);
  });
  if (partial !== undefined) {
    const id = readDocumentId(partial);
    if (id !== null) return ok(id);
  }

  const first = hotels[0];
  if (first !== undefined) {
    const id = readDocumentId(first);
    if (id !== null) return ok(id);
  }

  return err({ kind: 'parse_failure', details: 'no makcorps hotel match' });
}
