/**
 * Maps supplier-agnostic `NormalizedRate` rows to domain `SupplierOffer`.
 */
import type { BookingSupplierId, SupplierOffer } from '@mch/domain/booking';
import type { NormalizedRate } from '../supplier/types';

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function roomKeyFromNormalized(rate: NormalizedRate): string {
  if (rate.roomKey.supplier === 'ratehawk') {
    const parts = Object.entries(rate.roomKey.rgExt)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`);
    return `rh:${parts.join(',')}`;
  }
  if (rate.roomKey.supplier === 'travelport') {
    const codes = rate.roomKey.bookingCodes?.[0];
    if (codes !== undefined) return `tp:${codes}`;
    const label = rate.roomKey.labels[0];
    return `tp:${label?.trim().toLowerCase() ?? rate.roomLabel}`;
  }
  return `${rate.supplier}:${rate.roomLabel.trim().toLowerCase()}`;
}

function supplierIdFromRate(rate: NormalizedRate): BookingSupplierId {
  if (rate.supplier === 'little_emperors') return 'little_emperors';
  if (rate.supplier === 'travelport') return 'travelport';
  return 'ratehawk';
}

export function normalizedRateToSupplierOffer(
  rate: NormalizedRate,
  input: {
    readonly priority: number;
    readonly priceValidUntil: string;
    readonly idSuffix?: string;
  },
): SupplierOffer {
  const roomKey = roomKeyFromNormalized(rate);
  const suffix = input.idSuffix ?? rate.rateToken.slice(0, 12);
  return {
    id: `${rate.supplier}:${roomKey}:${suffix}`,
    supplierId: supplierIdFromRate(rate),
    rateToken: rate.rateToken,
    roomType: {
      key: roomKey,
      label: rate.roomLabel,
      maxOccupancy: rate.maxOccupancy,
    },
    ratePlanLabel: rate.ratePlanLabel,
    totalPriceTtc: { amountMinor: rate.priceMinor, currency: 'EUR' },
    cancellation: {
      rawText: rate.cancellationText,
      policy: null,
      refundable: rate.refundable,
    },
    priceValidUntil: input.priceValidUntil,
    priority: input.priority,
  };
}

export function defaultPriceValidUntil(nowMs: number): string {
  return new Date(nowMs + DEFAULT_TTL_MS).toISOString();
}
