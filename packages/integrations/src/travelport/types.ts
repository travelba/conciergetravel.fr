import { z } from 'zod';

export const TravelportOAuthTokenSchema = z
  .object({
    access_token: z.string(),
    expires_in: z.number(),
    token_type: z.string(),
    scope: z.string().optional(),
    id_token: z.string().optional(),
  })
  .passthrough();

const GuestsSchema = z.object({
  adults: z.number().int().min(1),
  children: z.array(z.object({ age: z.number().int().min(0).max(17) })).optional(),
});

const StayDetailsSchema = z.object({
  checkInDateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDateLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z.number().int().min(1).max(9).optional(),
  guests: GuestsSchema,
});

export const PropertyKeySchema = z.object({
  chainCode: z.string().min(1),
  propertyCode: z.string().min(1),
});
export type PropertyKey = z.infer<typeof PropertyKeySchema>;

export const SearchByCoordinatesInputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  radius: z.number().min(1).default(1),
  unit: z.enum(['mi', 'km']).default('mi'),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).default(1),
  childAges: z.array(z.number().int().min(0).max(17)).optional(),
  currency: z.string().length(3).default('EUR'),
});
export type SearchByCoordinatesInput = z.infer<typeof SearchByCoordinatesInputSchema>;

export const SearchByPropertyInputSchema = z.object({
  propertyKeys: z.array(PropertyKeySchema).min(1).max(50),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z.number().int().min(1).max(9).default(1),
  adults: z.number().int().min(1).default(1),
  childAges: z.array(z.number().int().min(0).max(17)).optional(),
  currency: z.string().length(3).default('EUR'),
});
export type SearchByPropertyInput = z.infer<typeof SearchByPropertyInputSchema>;

export { StayDetailsSchema };

const GeoCenterSchema = z.object({ latitude: z.number(), longitude: z.number() });

const AddressSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    countryCode: z.string().optional(),
    postalCode: z.string().optional(),
  })
  .passthrough();

const PropertyInfoSchema = z
  .object({
    geolocation: z.object({ center: GeoCenterSchema }).optional(),
    distanceFromSearchPoint: z.object({ unitOfDistance: z.string(), value: z.number() }).optional(),
    address: AddressSchema.optional(),
  })
  .passthrough();

const MoneyAmountSchema = z.object({ amount: z.number().optional() }).passthrough();

const RateKeySchema = z
  .object({ value: z.string(), authority: z.string().optional() })
  .passthrough();

const CancelPenaltySchema = z
  .object({
    deadlineLocal: z.string().optional(),
    cancelShortDescription: z.string().optional(),
    penalty: z
      .object({
        estimatedAmount: z.boolean().optional(),
        currencyAmount: z
          .object({ amount: z.number().optional(), currency: z.string().optional() })
          .passthrough()
          .optional(),
        originalPenaltyInfo: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const RateTermsSchema = z
  .object({
    ratePaymentInfo: z.string().optional(),
    guaranteeType: z.string().optional(),
    customerLoyaltyIDRequiredAtReservation: z.boolean().optional(),
    rateQualificationIDRequiredAtCheckIn: z.boolean().optional(),
    refundable: z.boolean().optional(),
    freeCancellationWithin24Hours: z.boolean().optional(),
    cancelNote: z.string().optional(),
    cancelPenalties: z.array(CancelPenaltySchema).optional(),
    description: z.array(z.string()).optional(),
  })
  .passthrough();
export type TravelportRateTerms = z.infer<typeof RateTermsSchema>;

/**
 * Forme réelle (DevKit v12) de `lowestPublicAvailableRate` : `totalPrice.amount`
 * + `currencyCode` + `terms` (garantie, remboursable, pénalités d'annulation).
 * On conserve `total` en option pour compat avec une version antérieure du schéma.
 */
const AvailableRateSchema = z
  .object({
    totalPrice: MoneyAmountSchema.optional(),
    base: MoneyAmountSchema.optional(),
    totalTaxes: MoneyAmountSchema.optional(),
    averageNightlyTotalPrice: MoneyAmountSchema.optional(),
    currencyCode: z.string().optional(),
    rateKey: RateKeySchema.optional(),
    shortRoomDescription: z.string().optional(),
    terms: RateTermsSchema.optional(),
    total: z
      .object({ amount: z.number().optional(), currency: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type TravelportAvailableRate = z.infer<typeof AvailableRateSchema>;

const RoomRateSchema = z
  .object({
    rateKey: RateKeySchema.optional(),
    bookingCode: z.string().optional(),
    rateDescription: z.string().optional(),
    roomDescription: z.string().optional(),
    breakfastIncluded: z.boolean().optional(),
    refundable: z.boolean().optional(),
    price: z
      .object({
        currencyCode: z.string().optional(),
        totalPrice: MoneyAmountSchema.optional(),
        base: MoneyAmountSchema.optional(),
        totalTaxes: MoneyAmountSchema.optional(),
      })
      .passthrough()
      .optional(),
    terms: RateTermsSchema.optional(),
  })
  .passthrough();

const RoomTypeSchema = z
  .object({
    shortRoomDescription: z.string().optional(),
    maxOccupancy: z.number().optional(),
    rates: z.array(RoomRateSchema).optional(),
  })
  .passthrough();
export type TravelportRoomType = z.infer<typeof RoomTypeSchema>;

// Interface explicite + annotation `z.ZodType<PropertyItem>` (pattern Amadeus
// `HotelOrderResponseSchema`) : borne l'inférence pour éviter TS7056 sur
// `SearchCompleteResponse`. Les optionnels portent `| undefined` afin de
// coller à la sortie Zod sous `exactOptionalPropertyTypes`.
export interface PropertyItem {
  readonly name: string;
  readonly chainCode: string;
  readonly propertyCode: string;
  readonly estimatedPropertyType?: string | undefined;
  readonly availability?: boolean | undefined;
  readonly propertyInfo?: z.infer<typeof PropertyInfoSchema> | undefined;
  readonly lowestPublicAvailableRate?: TravelportAvailableRate | undefined;
  readonly roomTypes?: readonly TravelportRoomType[] | undefined;
}

export const PropertyItemSchema: z.ZodType<PropertyItem> = z
  .object({
    name: z.string(),
    chainCode: z.string(),
    propertyCode: z.string(),
    estimatedPropertyType: z.string().optional(),
    availability: z.boolean().optional(),
    propertyInfo: PropertyInfoSchema.optional(),
    lowestPublicAvailableRate: AvailableRateSchema.optional(),
    roomTypes: z.array(RoomTypeSchema).optional(),
  })
  .passthrough();

export const PaginationSchema = z
  .object({
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    totalItems: z.number(),
    paginationToken: z.string().optional(),
  })
  .passthrough();

export const SearchCompleteResponseSchema = z
  .object({
    traceId: z.string().optional(),
    transactionId: z.string().optional(),
    pagination: PaginationSchema.optional(),
    hotelsResponse: z
      .object({
        searchPoint: z.unknown().optional(),
        checkInDateLocal: z.string().optional(),
        checkOutDateLocal: z.string().optional(),
        propertyItems: z.array(PropertyItemSchema).default([]),
      })
      .passthrough(),
  })
  .passthrough();
export type SearchCompleteResponse = z.infer<typeof SearchCompleteResponseSchema>;

export const TravelportErrorEnvelopeSchema = z
  .object({
    traceId: z.string().optional(),
    transactionId: z.string().optional(),
    errors: z
      .array(
        z
          .object({
            category: z.string().optional(),
            code: z.number().optional(),
            source: z.string().optional(),
            details: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
export type TravelportErrorEnvelope = z.infer<typeof TravelportErrorEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Reservation (v11 — book/reservations/build) request inputs + response shape
// ---------------------------------------------------------------------------

/** Voyageur principal d'une réservation hôtel. */
export interface ReservationGuestInput {
  readonly given: string;
  readonly surname: string;
  readonly prefix?: string;
  readonly email: string;
  readonly phone: {
    readonly countryAccessCode?: string;
    readonly areaCityCode: string;
    readonly number: string;
  };
}

/** Carte de paiement (garantie / dépôt). En preprod : carte de test sandbox. */
export interface ReservationCardInput {
  readonly cardCode: string; // ex. VI, CA, AX
  readonly cardType: 'Credit' | 'Debit' | 'Gift';
  readonly cardHolderName: string;
  readonly number: string;
  readonly expireDate: string; // MMYY
  readonly seriesCode?: string; // CVV
}

export const CreateReservationInputSchema = z.object({
  rateKey: z.string().min(1),
  rooms: z.number().int().min(1).max(9).default(1),
  currency: z.string().length(3),
  amount: z.number(),
  /** Type de garantie renvoyé en amont (terms.guaranteeType). Pilote les indicateurs Payment. */
  guaranteeType: z.string().optional(),
  acceptPriceChange: z.boolean().default(false),
  acceptGuaranteeChange: z.boolean().default(false),
});
export type CreateReservationInput = z.infer<typeof CreateReservationInputSchema>;

const ReservationLocatorSchema = z
  .object({
    value: z.string().optional(),
    locatorType: z.string().optional(),
    source: z.string().optional(),
    sourceContext: z.string().optional(),
    creationDate: z.string().optional(),
  })
  .passthrough();

const ReservationReceiptSchema = z
  .object({
    Confirmation: z
      .object({
        Locator: ReservationLocatorSchema.optional(),
        OfferStatus: z
          .object({ Status: z.string().optional(), code: z.string().optional() })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const ReservationOfferSchema = z
  .object({
    id: z.string().optional(),
    Identifier: z
      .object({ value: z.string().optional(), authority: z.string().optional() })
      .passthrough()
      .optional(),
    Price: z
      .object({
        CurrencyCode: z.object({ value: z.string().optional() }).passthrough().optional(),
        TotalPrice: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const ReservationResponseSchema = z
  .object({
    ReservationResponse: z
      .object({
        Reservation: z
          .object({
            Offer: z.array(ReservationOfferSchema).optional(),
            Receipt: z.array(ReservationReceiptSchema).optional(),
          })
          .passthrough()
          .optional(),
        traceId: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type ReservationResponse = z.infer<typeof ReservationResponseSchema>;
