/**
 * GIATA Room Type Mapping (RTM) client.
 *
 * Wire format probed against staging `stagingapi.roommapping.com` (2026-06-10).
 * Request: JSON POST with Basic auth. `RoomTypes` is a string[] of supplier labels.
 * Response: `properties[].groups[]` with optional `averageRoom` on `/MapPlus`.
 */
import { err, ok, type Result } from '@mch/domain/shared';

import { retryingJsonRequest } from '../http/retry-request';

import type { GiataError } from './errors';
import type {
  GiataRtmAverageRoom,
  GiataRtmBedDetail,
  GiataRtmClientConfig,
  GiataRtmLabelIndex,
  GiataRtmMapInput,
  GiataRtmMapResult,
  GiataRtmRoomGroup,
} from './rtm-types';

function basicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function parseBedDetail(raw: unknown): GiataRtmBedDetail | null {
  if (raw === null || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = row['id'];
  if (typeof id !== 'number') return null;
  const num = (key: string): number => (typeof row[key] === 'number' ? row[key] : 0);
  return {
    id,
    single: num('single'),
    semiDouble: num('semiDouble'),
    double: num('double'),
    queen: num('queen'),
    king: num('king'),
  };
}

function parseAverageRoom(raw: unknown): GiataRtmAverageRoom | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const bedDetailsRaw = row['bedDetails'];
  const bedDetails: GiataRtmBedDetail[] = [];
  if (Array.isArray(bedDetailsRaw)) {
    for (const item of bedDetailsRaw) {
      const parsed = parseBedDetail(item);
      if (parsed !== null) bedDetails.push(parsed);
    }
  }
  const classesRaw = row['classes'];
  const classes: string[] = [];
  if (Array.isArray(classesRaw)) {
    for (const item of classesRaw) {
      if (typeof item === 'string') classes.push(item);
    }
  }
  return {
    type: typeof row['type'] === 'string' ? row['type'] : 'Room',
    classes,
    bedDetailDescription:
      typeof row['bedDetailDescription'] === 'string' ? row['bedDetailDescription'] : null,
    bedDetails,
    accessible: row['accessible'] === true,
    nonRefundable: row['nonRefundable'] === true,
  };
}

function parseGroupRoomTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      names.push(item);
      continue;
    }
    if (item !== null && typeof item === 'object') {
      const roomName = (item as Record<string, unknown>)['roomName'];
      if (typeof roomName === 'string') names.push(roomName);
    }
  }
  return names;
}

function parseRoomGroup(raw: unknown): GiataRtmRoomGroup | null {
  if (raw === null || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const groupId = row['groupID'] ?? row['groupId'];
  const groupName = row['groupName'];
  if (typeof groupId !== 'number' || typeof groupName !== 'string') return null;
  const roomTypes = parseGroupRoomTypes(row['roomTypes']);
  const averageRoom = parseAverageRoom(row['averageRoom']);
  return {
    groupId,
    groupName,
    roomTypes,
    ...(averageRoom !== undefined ? { averageRoom } : {}),
  };
}

/**
 * Parse GIATA RTM map response. Returns the first property block when the
 * request carried a single hotel (our normal case).
 */
export function parseGiataRtmMapResponse(
  input: GiataRtmMapInput,
  payload: unknown,
): Result<GiataRtmMapResult, GiataError> {
  if (payload === null || typeof payload !== 'object') {
    return err({ kind: 'parse_failure', details: 'GIATA RTM response is not an object' });
  }

  const root = payload as Record<string, unknown>;
  if (typeof root['message'] === 'string') {
    const modelState = root['modelState'];
    const details =
      modelState !== null && typeof modelState === 'object'
        ? JSON.stringify(modelState).slice(0, 300)
        : root['message'];
    return err({ kind: 'parse_failure', details: `GIATA RTM validation: ${details}` });
  }

  const propertiesRaw = root['properties'] ?? root['Properties'];
  if (!Array.isArray(propertiesRaw)) {
    return err({ kind: 'parse_failure', details: 'GIATA RTM response missing properties[]' });
  }

  const first = propertiesRaw[0];
  if (first === null || typeof first !== 'object') {
    return ok({
      giataId: input.giataId,
      propertyName: input.propertyName,
      groups: [],
    });
  }

  const prop = first as Record<string, unknown>;
  const giataId = String(prop['giataId'] ?? prop['GiataId'] ?? input.giataId);
  const propertyName =
    typeof prop['propertyName'] === 'string' ? prop['propertyName'] : input.propertyName;

  const groupsRaw = prop['groups'] ?? prop['Groups'];
  const groups: GiataRtmRoomGroup[] = [];
  if (Array.isArray(groupsRaw)) {
    for (const item of groupsRaw) {
      const parsed = parseRoomGroup(item);
      if (parsed !== null) groups.push(parsed);
    }
  }

  return ok({ giataId, propertyName, groups });
}

/** Build a label → group lookup from an RTM result (exact roomLabel match). */
export function buildGiataRtmLabelIndex(
  result: GiataRtmMapResult,
): ReadonlyMap<string, GiataRtmLabelIndex> {
  const index = new Map<string, GiataRtmLabelIndex>();
  for (const group of result.groups) {
    const entry: GiataRtmLabelIndex = {
      groupId: group.groupId,
      groupName: group.groupName,
      ...(group.averageRoom !== undefined ? { averageRoom: group.averageRoom } : {}),
    };
    for (const label of group.roomTypes) {
      index.set(label, entry);
    }
  }
  return index;
}

function buildRequestBody(input: GiataRtmMapInput): Record<string, unknown> {
  const giataNumeric = Number.parseInt(input.giataId, 10);
  return {
    Properties: [
      {
        GiataId: Number.isNaN(giataNumeric) ? input.giataId : giataNumeric,
        PropertyName: input.propertyName,
        RoomTypes: [...input.roomTypes],
      },
    ],
  };
}

/** Map supplier room labels to GIATA canonical groups. */
export async function mapGiataRoomTypes(
  config: GiataRtmClientConfig,
  input: GiataRtmMapInput,
): Promise<Result<GiataRtmMapResult, GiataError>> {
  if (input.roomTypes.length === 0) {
    return ok({
      giataId: input.giataId,
      propertyName: input.propertyName,
      groups: [],
    });
  }

  const endpoint = config.useMapPlus === true ? '/MapPlus' : '/Map';
  const url = `${config.baseUrl.replace(/\/$/, '')}${endpoint}`;

  const result = await retryingJsonRequest({
    url,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(config.username, config.password),
    },
    body: { kind: 'json', value: buildRequestBody(input) },
  });

  if (!result.ok) {
    return err({ kind: 'http', error: result.error });
  }
  if (result.value.json === undefined) {
    return err({ kind: 'parse_failure', details: 'GIATA RTM response body is empty' });
  }

  return parseGiataRtmMapResponse(input, result.value.json);
}
