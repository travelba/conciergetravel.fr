import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCityDirectoryMock, gateAgentByIpMock } = vi.hoisted(() => ({
  getCityDirectoryMock: vi.fn(),
  gateAgentByIpMock: vi.fn(),
}));

vi.mock('@/server/annuaire/get-city-directory', () => ({
  getCityDirectory: getCityDirectoryMock,
}));

vi.mock('@/server/agent/rate-limit', () => ({
  gateAgentByIp: gateAgentByIpMock,
  readClientIp: () => '127.0.0.1',
}));

import { GET } from './route';

function makeReq(): NextRequest {
  return new NextRequest('http://localhost/api/agent/directory/france/paris');
}

function makeParams(
  pays: string,
  ville: string,
): { params: Promise<{ pays: string; ville: string }> } {
  return { params: Promise.resolve({ pays, ville }) };
}

describe('GET /api/agent/directory/[pays]/[ville]', () => {
  beforeEach(() => {
    getCityDirectoryMock.mockReset();
    gateAgentByIpMock.mockReset();
    gateAgentByIpMock.mockResolvedValue({ ok: true });
  });

  it('returns the geolocated hotel directory shape', async () => {
    getCityDirectoryMock.mockResolvedValue({
      countrySlug: 'france',
      citySlug: 'paris',
      countryName: 'France',
      cityName: 'Paris',
      totalCount: 2,
      hotels: [
        { id: 'a', slug: 'ritz', name: 'Ritz', lat: 48.86, lng: 2.32, isPalace: true },
        { id: 'b', slug: 'meurice', name: 'Le Meurice', lat: null, lng: null, isPalace: true },
      ],
    });

    const res = await GET(makeReq(), makeParams('france', 'paris'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.pays).toBe('france');
    expect(body.ville).toBe('paris');
    expect(body.count).toBe(2);
    expect(body.located).toBe(1);
    expect(body.canonicalUrl).toBe('/fr/hotels/france/paris');
    expect(body.hotels[0]).toMatchObject({
      name: 'Ritz',
      slug: 'ritz',
      url: '/fr/hotel/ritz',
      lat: 48.86,
      lng: 2.32,
      isPalace: true,
    });
    expect(res.headers.get('Cache-Control')).toContain('max-age=1800');
  });

  it('404s when the directory does not exist', async () => {
    getCityDirectoryMock.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams('atlantis', 'nowhere'));
    expect(res.status).toBe(404);
  });

  it('429s when the rate limiter rejects', async () => {
    gateAgentByIpMock.mockResolvedValue({ ok: false, retryAfterSec: 30 });
    const res = await GET(makeReq(), makeParams('france', 'paris'));
    expect(res.status).toBe(429);
    expect(getCityDirectoryMock).not.toHaveBeenCalled();
  });
});
