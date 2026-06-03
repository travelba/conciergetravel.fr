import type { Offer } from '@mch/domain/booking';
import { err, ok, type Result } from '@mch/domain/shared';

import type { TravelportError } from './errors';
import { travelportOfferToDomain } from './map-offer';
import { searchByProperty, type TravelportCredentials } from './travelport-client';
import type { PropertyItem } from './types';

/**
 * Marge de fraîcheur de l'offre. Travelport met en cache les offres issues de
 * SearchComplete / Availability pendant ~30 min ; on expose 25 min pour garder
 * une marge avant `createReservation`.
 */
const OFFER_FRESHNESS_MINUTES = 25;

export interface PropertyOfferingInput {
  readonly chainCode: string;
  readonly propertyCode: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly childAges?: readonly number[];
  readonly currency?: string;
  readonly hotelId: string;
}

export interface PropertyOffering {
  readonly item: PropertyItem;
  readonly offer: Offer;
}

/**
 * Recheck disponibilité + re-pricing d'une propriété avant réservation
 * (étape « availability/lock »).
 *
 * Grounding DevKit : la v12 `SearchComplete` remplace les trois appels v11
 * (search + details + availability) et autorise à enchaîner directement sur
 * la réservation v11. On réutilise donc `searchByProperty` (SearchComplete
 * par `propertyKeys`) pour obtenir un `rateKey` frais (valide ~30 min) que
 * `createReservation` consomme tel quel, plutôt que d'appeler séparément
 * `availability/catalogofferingshospitality`.
 */
export async function getPropertyOffering(
  creds: TravelportCredentials,
  input: PropertyOfferingInput,
): Promise<Result<PropertyOffering, TravelportError>> {
  const childAges = input.childAges ?? [];
  const search = await searchByProperty(creds, {
    propertyKeys: [{ chainCode: input.chainCode, propertyCode: input.propertyCode }],
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    rooms: 1,
    adults: input.adults,
    ...(childAges.length > 0 ? { childAges: [...childAges] } : {}),
    currency: input.currency ?? 'EUR',
  });
  if (!search.ok) return err(search.error);

  const items = search.value.hotelsResponse.propertyItems;
  const item =
    items.find((p) => p.chainCode === input.chainCode && p.propertyCode === input.propertyCode) ??
    items[0];
  if (item === undefined) {
    return err({
      kind: 'offer_not_available',
      offerId: `${input.chainCode}/${input.propertyCode}`,
    });
  }

  const expiresAt = new Date(Date.now() + OFFER_FRESHNESS_MINUTES * 60_000).toISOString();
  const offer = travelportOfferToDomain({
    item,
    hotelId: input.hotelId,
    checkIn: input.checkInDate,
    checkOut: input.checkOutDate,
    adults: input.adults,
    children: childAges.length,
    expiresAt,
  });
  if (!offer.ok) return err(offer.error);

  return ok({ item, offer: offer.value });
}
