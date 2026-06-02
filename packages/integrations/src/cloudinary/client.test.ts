import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Cloudinary SDK before importing the client under test.
const resourcesMock = vi.fn();
vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    api: { resources: (...args: unknown[]) => resourcesMock(...args) },
    uploader: { upload: vi.fn() },
  },
}));

import { listUploadedDimensions } from './client';

describe('listUploadedDimensions', () => {
  beforeEach(() => {
    resourcesMock.mockReset();
  });

  it('paginates and builds a public_id → dimensions map', async () => {
    resourcesMock
      .mockResolvedValueOnce({
        resources: [
          { public_id: 'cct/hotels/a/commons-1', width: 2400, height: 1600 },
          { public_id: 'cct/hotels/a/commons-2', width: 1800, height: 1200 },
        ],
        next_cursor: 'CURSOR_2',
      })
      .mockResolvedValueOnce({
        resources: [{ public_id: 'cct/hotels/b/places-1', width: 1600, height: 1067 }],
      });

    const res = await listUploadedDimensions('cct/hotels/');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.size).toBe(3);
    expect(res.value.get('cct/hotels/a/commons-1')).toEqual({ width: 2400, height: 1600 });
    expect(res.value.get('cct/hotels/b/places-1')).toEqual({ width: 1600, height: 1067 });
    // Second call must have forwarded the cursor.
    expect(resourcesMock).toHaveBeenCalledTimes(2);
    expect(resourcesMock.mock.calls[1]?.[0]).toMatchObject({ next_cursor: 'CURSOR_2' });
  });

  it('skips resources with missing or non-positive dimensions', async () => {
    resourcesMock.mockResolvedValueOnce({
      resources: [
        { public_id: 'cct/hotels/a/commons-1', width: 2400, height: 1600 },
        { public_id: 'cct/hotels/a/broken', width: 0, height: 0 },
        { public_id: 'cct/hotels/a/no-dims' },
      ],
    });

    const res = await listUploadedDimensions('cct/hotels/');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.size).toBe(1);
    expect(res.value.has('cct/hotels/a/broken')).toBe(false);
  });

  it('maps a thrown auth error to auth_failed', async () => {
    resourcesMock.mockRejectedValueOnce({ http_code: 401, message: 'Invalid Signature' });
    const res = await listUploadedDimensions('cct/hotels/');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('auth_failed');
  });
});
