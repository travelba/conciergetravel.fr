import type { Offer } from '@mch/domain/booking';
import { err, ok, type Result } from '@mch/domain/shared';

import type { TravelportError } from './errors';
import type { PropertyItem, TravelportRateTerms } from './types';

/**
 * Construit le texte de politique d'annulation **verbatim** à partir des
 * `terms` Travelport (CDC §6 — toujours afficher le texte fournisseur tel
 * quel avant paiement). On concatène les `cancelShortDescription` de chaque
 * pénalité ; à défaut on retombe sur `cancelNote`, puis sur un libellé
 * « non remboursable » si le tarif l'indique.
 */
function cancellationText(terms: TravelportRateTerms | undefined): string {
  if (terms === undefined) return '';
  const parts: string[] = [];
  for (const p of terms.cancelPenalties ?? []) {
    if (typeof p.cancelShortDescription === 'string' && p.cancelShortDescription.length > 0) {
      parts.push(p.cancelShortDescription);
    }
  }
  if (parts.length === 0 && typeof terms.cancelNote === 'string' && terms.cancelNote.length > 0) {
    parts.push(terms.cancelNote);
  }
  if (parts.length === 0 && terms.refundable === false) {
    parts.push('Non remboursable.');
  }
  return parts.join(' ');
}

/**
 * Transforme un `propertyItems` Travelport (tarif le plus bas issu de
 * `SearchComplete` v12) en `Offer` du domaine. L'identifiant d'offre est le
 * `rateKey.value` (réutilisé tel quel par `createReservation`). Devise limitée
 * à EUR (contrainte `MoneyAmount.currency`), ce qui convient au pilote Paris.
 */
export function travelportOfferToDomain(input: {
  readonly item: PropertyItem;
  readonly hotelId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
  readonly expiresAt: string;
}): Result<Offer, TravelportError> {
  const rate = input.item.lowestPublicAvailableRate;
  if (rate?.rateKey?.value === undefined) {
    return err({
      kind: 'offer_not_available',
      offerId: `${input.item.chainCode}/${input.item.propertyCode}`,
    });
  }

  // Forme réelle DevKit v12 : `totalPrice.amount` + `currencyCode`.
  // Repli sur l'ancienne forme `total.{amount,currency}` par tolérance.
  const amount = rate.totalPrice?.amount ?? rate.total?.amount;
  const currency = rate.currencyCode ?? rate.total?.currency;
  if (amount === undefined || currency === undefined) {
    return err({ kind: 'mapping_failure', details: 'missing rate total' });
  }
  if (currency.toUpperCase() !== 'EUR') {
    return err({ kind: 'mapping_failure', details: `unsupported currency ${currency}` });
  }

  const amountMinor = Math.round(amount * 100);

  const offer: Offer = {
    id: rate.rateKey.value,
    provider: 'travelport',
    hotelId: input.hotelId,
    roomCode: `${input.item.chainCode}/${input.item.propertyCode}`,
    stay: { checkIn: input.checkIn, checkOut: input.checkOut },
    guests: { adults: input.adults, children: input.children },
    totalPrice: { amountMinor, currency: 'EUR' },
    cancellationPolicyText: cancellationText(rate.terms),
    expiresAt: input.expiresAt,
  };

  return ok(offer);
}
