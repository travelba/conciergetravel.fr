import { describe, expect, it } from 'vitest';

import { buildGiataRtmLabelIndex, parseGiataRtmMapResponse } from './rtm-client';

const INPUT = {
  giataId: '12345',
  propertyName: 'Hotel Test',
  roomTypes: ['Deluxe King Room - RateHawk', 'King Deluxe', 'Twin Standard'],
} as const;

describe('parseGiataRtmMapResponse', () => {
  it('parses /Map groups with string roomTypes', () => {
    const result = parseGiataRtmMapResponse(INPUT, {
      properties: [
        {
          propertyName: 'Hotel Test',
          giataId: '12345',
          groups: [
            {
              groupName: 'Deluxe King Room',
              groupID: 1,
              roomTypes: ['Deluxe King Room - RateHawk', 'King Deluxe'],
            },
            {
              groupName: 'Standard Twin Room',
              groupID: 2,
              roomTypes: ['Twin Standard'],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.groups).toHaveLength(2);
    expect(result.value.groups[0]?.groupName).toBe('Deluxe King Room');
    expect(result.value.groups[0]?.roomTypes).toEqual([
      'Deluxe King Room - RateHawk',
      'King Deluxe',
    ]);
  });

  it('parses /MapPlus groups with object roomTypes and averageRoom', () => {
    const result = parseGiataRtmMapResponse(INPUT, {
      properties: [
        {
          propertyName: 'Hotel Test',
          giataId: '12345',
          groups: [
            {
              groupName: 'Deluxe King Room',
              groupID: 1,
              averageRoom: {
                type: 'Room',
                classes: ['Deluxe'],
                bedDetailDescription: 'King',
                bedDetails: [{ id: 2, single: 0, semiDouble: 0, double: 0, queen: 0, king: 1 }],
                accessible: false,
                nonRefundable: false,
              },
              roomTypes: [
                { roomName: 'Deluxe King Room - RateHawk', groupConfidence: 100 },
                { roomName: 'King Deluxe', groupConfidence: 100 },
              ],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const group = result.value.groups[0];
    expect(group?.averageRoom?.bedDetailDescription).toBe('King');
    expect(group?.roomTypes).toEqual(['Deluxe King Room - RateHawk', 'King Deluxe']);
  });

  it('surfaces validation errors from modelState', () => {
    const result = parseGiataRtmMapResponse(INPUT, {
      message: 'The request is invalid.',
      modelState: { 'request.Properties': ['An error has occurred.'] },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_failure');
  });
});

describe('buildGiataRtmLabelIndex', () => {
  it('indexes every supplier label to its GIATA group', () => {
    const parsed = parseGiataRtmMapResponse(INPUT, {
      properties: [
        {
          giataId: '12345',
          propertyName: 'Hotel Test',
          groups: [{ groupName: 'Deluxe King Room', groupID: 1, roomTypes: ['King Deluxe'] }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const index = buildGiataRtmLabelIndex(parsed.value);
    expect(index.get('King Deluxe')?.groupName).toBe('Deluxe King Room');
    expect(index.get('King Deluxe')?.groupId).toBe(1);
  });
});
