import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { IntegrationRedis } from '../redis/cache-helpers';

import { cancelReservation, createReservation } from './reservation';
import type { ReservationCardInput, ReservationGuestInput } from './types';
import type { TravelportCredentials } from './travelport-client';

function createMemoryRedis(): IntegrationRedis {
  const store = new Map<string, string>();
  return {
    get: async (key) => store.get(key) ?? null,
    set: async (key, value, opts) => {
      if (opts?.nx === true && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    del: async (...keys) => {
      let removed = 0;
      for (const k of keys) if (store.delete(k)) removed += 1;
      return removed;
    },
  };
}

const AUTH_URL = 'https://oauth.pp.travelport.test/oauth/token';
const API_BASE = 'https://api.pp.travelport.test';

function creds(): TravelportCredentials {
  return {
    authUrl: AUTH_URL,
    apiBaseUrl: API_BASE,
    clientId: 'cid',
    clientSecret: 'secret',
    username: 'user',
    password: 'pass',
    accessGroup: 'AG123',
    pcc: 'PCC1',
    redis: createMemoryRedis(),
  };
}

const guest: ReservationGuestInput = {
  given: 'Test',
  surname: 'Concierge',
  email: 'sandbox@example.com',
  phone: { countryAccessCode: '33', areaCityCode: '01', number: '40000000' },
};

const card: ReservationCardInput = {
  cardCode: 'VI',
  cardType: 'Credit',
  cardHolderName: 'Test Concierge',
  number: '4444333322221111',
  expireDate: '1130',
  seriesCode: '343',
};

const oauthHandler = http.post(AUTH_URL, () =>
  HttpResponse.json({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
);

const reservationResponse = {
  ReservationResponse: {
    Reservation: {
      Offer: [
        {
          id: 'O1',
          Identifier: { value: 'RATEKEY-123', authority: 'TVPT' },
          Price: { CurrencyCode: { value: 'EUR' }, TotalPrice: 1500 },
        },
      ],
      Receipt: [
        {
          Confirmation: {
            Locator: {
              value: '80073065',
              locatorType: 'Confirmation Number',
              sourceContext: 'Supplier',
            },
            OfferStatus: { Status: 'Confirmed' },
          },
        },
        {
          Confirmation: {
            Locator: { value: '96120603', locatorType: 'IATA Number', sourceContext: 'Agency' },
            OfferStatus: { Status: 'Confirmed' },
          },
        },
        {
          Confirmation: {
            Locator: { value: 'D6VBHL', locatorType: 'PNR Locator', sourceContext: 'Travelport' },
            OfferStatus: { Status: 'Confirmed' },
          },
        },
      ],
    },
    traceId: 'trace-1',
  },
};

const server = setupServer(oauthHandler);
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers(oauthHandler);
});
afterAll(() => {
  server.close();
});

describe('createReservation', () => {
  it('construit le payload référence et extrait les 3 locators', async () => {
    let capturedBody: any;
    server.use(
      http.post(`${API_BASE}/11/hotel/book/reservations/build`, async ({ request }) => {
        capturedBody = await request.json();
        expect(request.headers.get('Accept-Version')).toBe('11');
        expect(request.headers.get('XAUTH_TRAVELPORT_ACCESSGROUP')).toBe('AG123');
        return HttpResponse.json(reservationResponse);
      }),
    );

    const res = await createReservation(
      creds(),
      {
        rateKey: 'RATEKEY-123',
        rooms: 1,
        currency: 'EUR',
        amount: 1500,
        guaranteeType: 'GuaranteeRequired',
        acceptPriceChange: false,
        acceptGuaranteeChange: false,
      },
      guest,
      card,
      { idempotencyKey: 'idem-1' },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('Confirmed');
    expect(res.value.supplierConfirmation).toBe('80073065');
    expect(res.value.aggregatorLocator).toBe('D6VBHL');
    expect(res.value.agencyLocator).toBe('96120603');
    expect(res.value.offerId).toBe('RATEKEY-123');
    expect(res.value.totalPrice).toEqual({ amount: 1500, currency: 'EUR' });

    const build = capturedBody.ReservationQueryBuild.ReservationBuild;
    expect(build.BuildFromCatalogOfferingHospitality.CatalogOfferingIdentifier.value).toBe(
      'RATEKEY-123',
    );
    // GuaranteeRequired → garantie à l'arrivée (rien débité au booking).
    expect(build.Payment[0].guaranteeInd).toBe(true);
    expect(build.Payment[0].depositInd).toBe(false);
    expect(build.Payment[0].Amount).toEqual({ code: 'EUR', value: 1500 });
  });

  it('positionne depositInd=true pour un tarif PrepayRequired', async () => {
    let capturedBody: any;
    server.use(
      http.post(`${API_BASE}/11/hotel/book/reservations/build`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(reservationResponse);
      }),
    );

    await createReservation(
      creds(),
      {
        rateKey: 'RK',
        rooms: 1,
        currency: 'EUR',
        amount: 900,
        guaranteeType: 'PrepayRequired',
        acceptPriceChange: false,
        acceptGuaranteeChange: false,
      },
      guest,
      card,
      { idempotencyKey: 'idem-2' },
    );

    const payment = capturedBody.ReservationQueryBuild.ReservationBuild.Payment[0];
    expect(payment.depositInd).toBe(true);
    expect(payment.guaranteeInd).toBe(false);
  });

  it('passe les query params accept* lors d’un rejeu', async () => {
    let capturedUrl = '';
    server.use(
      http.post(`${API_BASE}/11/hotel/book/reservations/build`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(reservationResponse);
      }),
    );

    await createReservation(
      creds(),
      {
        rateKey: 'RK',
        rooms: 1,
        currency: 'EUR',
        amount: 900,
        acceptPriceChange: false,
        acceptGuaranteeChange: false,
      },
      guest,
      card,
      { idempotencyKey: 'idem-3', acceptPriceChange: true, acceptGuaranteeChange: true },
    );

    expect(capturedUrl).toContain('acceptPriceChangeInd=true');
    expect(capturedUrl).toContain('acceptGuaranteeChangeInd=true');
  });
});

describe('cancelReservation', () => {
  it('PUT canceloffer avec le locator agrégateur et renvoie un statut', async () => {
    let capturedUrl = '';
    server.use(
      http.put(`${API_BASE}/11/hotel/book/reservations/:loc/canceloffer`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          ReservationResponse: {
            Reservation: { Receipt: [{ Confirmation: { OfferStatus: { Status: 'Cancelled' } } }] },
          },
        });
      }),
    );

    const res = await cancelReservation(creds(), 'D6VBHL', {
      idempotencyKey: 'cancel-1',
      supplierLocator: '69089349',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('Cancelled');
    expect(capturedUrl).toContain('/11/hotel/book/reservations/D6VBHL/canceloffer');
    expect(capturedUrl).toContain('supplierLocator=69089349');
  });
});
