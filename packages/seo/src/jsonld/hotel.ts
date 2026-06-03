import type { Hotel } from 'schema-dts';

import { aggregateRatingJsonLd, type AggregateRatingInput } from './aggregate-rating';
import { type HotelBrandInput } from './affiliations';
import { offerJsonLd, type OfferInput } from './offer';
import {
  buildOpeningHoursSpecification,
  normalisePriceRange,
  osmToSchemaClass,
  osmToSchemaUrl,
  type OpeningHoursSpecificationNode,
} from './place-amenity';

/**
 * Hotel JSON-LD node — `schema-dts`' `Hotel` is overly conservative
 * compared to what Google actually accepts and what the Schema.org
 * spec defines on parent types. We re-open it with two
 * well-documented extensions:
 *
 *   - `dateModified` (Schema.org: defined on `CreativeWork`, but
 *     Google's Hotel rich-result documentation explicitly lists it
 *     as a recommended property on `Hotel` — it's the freshness
 *     signal LLM ingestion pipelines weight most).
 *   - `nearbyAttractions` (Schema.org: defined on `LodgingBusiness`
 *     via the Hotels extension; schema-dts misses it). Carries an
 *     array of `Place` nodes.
 *
 * Re-opening rather than casting keeps the rest of the builder
 * type-safe — we only widen the two specific fields we need.
 */
type HotelBaseNode = Exclude<Hotel, string>;

/**
 * `WebPageElement` with `cssSelector[]` — Schema.org's `SpeakableSpecification`
 * (https://schema.org/SpeakableSpecification). Google Assistant uses this to
 * pick the spoken summary on Hotel queries; we point at the AEO "Réponse
 * rapide" block via a stable selector (`#tldr`).
 */
type SpeakableNode = {
  '@type': 'SpeakableSpecification';
  cssSelector: readonly string[];
};

/** Brand sub-node — `Brand` is one of the union types accepted by
 * Schema.org for `Hotel.brand` (the other being `Organization`). We
 * always emit `Brand` for our affiliation flow; the operational chain
 * is the brand, not the legal entity owning the property. */
type BrandNode = {
  '@type': 'Brand';
  name: string;
  sameAs?: string;
  identifier?: string;
};

/** Hotel without the bare-IRI string union from schema-dts. */
export type HotelNode = HotelBaseNode & {
  dateModified?: string;
  nearbyAttractions?: readonly NearbyAttractionNode[] | NearbyAttractionNode;
  containsPlace?: readonly ContainedPlaceNode[] | ContainedPlaceNode;
  /** Operational chain. See `HotelJsonLdInput.brand`. */
  brand?: BrandNode;
  /**
   * Schema.org defines `tourBookingPage` on `LodgingBusiness` as
   * "A page providing information about how to book a tour of some
   * Place, such as an Accommodation … as well as other kinds of
   * tours as appropriate." schema-dts misses it on the narrower
   * `Hotel` subtype, so we re-open the field here.
   */
  tourBookingPage?: string;
  /**
   * Wikidata-anchored disambiguation. Pointing `additionalType` at
   * `https://www.wikidata.org/wiki/<QID>` is the strongest signal we
   * can send to AI agents (Bing Chat, Perplexity, ChatGPT Search)
   * that *this* specific hotel is the entity behind the QID — without
   * it, "Cheval Blanc" could be the chain, the Saint-Tropez fiche or
   * the Courchevel fiche.
   */
  additionalType?: string;
  /** Schema.org `sameAs[]` — knowledge-graph anchors. */
  sameAs?: readonly string[];
  /** `subjectOf[]` — Articles/CreativeWorks ABOUT this hotel (Wikipedia, Commons gallery). */
  subjectOf?: readonly SubjectOfNode[];
  /** Hotel marketing slogan (Schema.org `slogan`, inherited from `Organization`). */
  slogan?: string;
  /** Canonical page URL for the JSON-LD payload. */
  mainEntityOfPage?: string;
  /** Speakable specification — surfaces the AEO TL;DR block to voice assistants. */
  speakable?: SpeakableNode;
  /** Currencies the hotel accepts (always "EUR" for our French catalog). */
  currenciesAccepted?: string;
  /** Payment methods accepted (comma-separated per Schema.org convention). */
  paymentAccepted?: string;
  /** `smokingAllowed` — boolean. Palaces are non-smoking by regulation. */
  smokingAllowed?: boolean;
  /** Reservation email — surfaces as `email` (Organization inheritance). */
  email?: string;
  /** Founders, named architects, etc. (Schema.org `founder` on Organization). */
  founder?: readonly { '@type': 'Person'; name: string }[];
};

/** Inner node for `subjectOf[]`. */
type SubjectOfNode = {
  '@type': 'Article' | 'CreativeWork' | 'WebPage';
  url: string;
  name?: string;
  inLanguage?: string;
};

/**
 * `HotelRoom` sub-place exposed under the parent hotel's
 * `containsPlace`. Carries `@type`, `name` and `url` so search
 * engines and LLM ingestion pipelines can follow the link to the
 * indexable room sub-page without having to re-crawl the parent
 * fiche. We deliberately keep the shape small (no `floorSize`,
 * `bed`, etc.) — those facts already live in the *room* JSON-LD
 * at the sub-page URL and duplicating them inside the parent
 * graph would bloat the envelope without changing Google's
 * indexing outcome.
 */
type ContainedRoomNode = {
  '@type': 'HotelRoom';
  name: string;
  url: string;
};

/**
 * `MeetingRoom` sub-place exposed under the parent hotel's
 * `containsPlace` (Schema.org: `MeetingRoom` is a `Place` subtype
 * under the broader Hotels extension, intended for event venues
 * embedded inside a hotel).
 *
 * Carries the three facts MICE planners use to pre-qualify a venue
 * before requesting a quote:
 *
 *   - `name` — the editorial label ("Salon Kléber").
 *   - `floorSize` — surface as a `QuantitativeValue` in m² (UN/ECE
 *     unit code `MTK`, Google-recognised). We always emit m² as we
 *     never store imperial.
 *   - `maximumAttendeeCapacity` — single integer for the biggest
 *     supported layout (theatre by default). Schema.org defines
 *     this on `Event` and `Place`; Google's structured-data tooling
 *     accepts it on `MeetingRoom` since 2023.
 *
 * `description` is optional and carries the localised editorial
 * notes (e.g. "Salle de bal principale, plafond 5,5 m").
 *
 * No `containedInPlace` back-pointer to the parent hotel — the
 * graph is already nested under the Hotel node so the relation is
 * implicit. Inlining the back-pointer would only bloat the envelope.
 */
type MeetingRoomNode = {
  '@type': 'MeetingRoom';
  name: string;
  floorSize: { '@type': 'QuantitativeValue'; value: number; unitCode: 'MTK' };
  maximumAttendeeCapacity: number;
  description?: string;
};

type ContainedPlaceNode = ContainedRoomNode | MeetingRoomNode;

/**
 * `Place` subtype emitted under `nearbyAttractions`. We keep it as
 * a structural type (not a discriminated union) because the set of
 * `@type` strings is open-ended and depends on the editorial taxonomy.
 */
/**
 * `Place` subtype emitted under `nearbyAttractions`. We keep it as a
 * structural type (not a discriminated union) because the set of
 * `@type` strings is open-ended and depends on the editorial taxonomy.
 *
 * Optional enrichment fields (WS5 extensions):
 *   - `description` — short LLM-generated 1-2 sentence narrative.
 *   - `openingHoursSpecification` — parsed from the raw OSM `opening_hours`
 *     tag; cleanly indexed by Google's hotel + local-business test.
 *   - `priceRange` — `'€'..'€€€€'` or `'À partir de N €'` etc.
 *   - `additionalType` — Schema.org URL form, used to disambiguate
 *     narrow shop subtypes (`https://schema.org/Pharmacy` etc.) when
 *     the `@type` is the broader `Store` for compatibility.
 *   - `address` — for utility shops, a postal address strengthens the
 *     `LocalBusiness` shape that Google's Pharmacy/Bakery rich result
 *     expects.
 */
type NearbyAttractionNode = {
  '@type': string;
  name: string;
  geo?: { '@type': 'GeoCoordinates'; latitude: number; longitude: number };
  sameAs?: string;
  description?: string;
  openingHoursSpecification?: readonly OpeningHoursSpecificationNode[];
  priceRange?: string;
  additionalType?: string;
  address?: { '@type': 'PostalAddress'; streetAddress?: string; addressLocality?: string };
};

export interface HotelAddressInput {
  readonly streetAddress: string;
  readonly addressLocality: string;
  readonly postalCode: string;
  /** ISO 3166-1 alpha-2 country code, defaults to `FR`. */
  readonly addressCountry?: string;
  readonly addressRegion?: string;
}

export interface HotelGeoInput {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Rich image input for `Hotel.image[]`. Mirrors Schema.org's
 * `ImageObject` shape (https://schema.org/ImageObject) so we can ship:
 *
 *   - `caption` (mandatory for the rich-result hotel test on hero shots)
 *   - `width` / `height` (Google honours both; LLMs use them to
 *     reconstruct aspect ratios when rendering AI-overview cards)
 *   - `representativeOfPage` (true for the hero shot, false for gallery
 *     extras — keeps "hero vs gallery" semantics intact)
 *
 * The builder accepts either bare string URLs (legacy callers — pre-B8)
 * or full `ImageObjectInput` entries. Mixed arrays are supported and
 * each entry is normalised independently.
 */
export interface ImageObjectInput {
  readonly url: string;
  /**
   * Mandatory free-text caption. Empty captions are silently rejected
   * (rendered as a bare URL string in the JSON-LD) — Schema.org
   * requires `caption` to be meaningful, an empty caption is worse
   * than no `ImageObject` envelope at all.
   */
  readonly caption?: string;
  readonly width?: number;
  readonly height?: number;
  /**
   * `true` when this is the hero image of the page (CDC §2 bloc 2).
   * Google's hotel rich-result documentation honours
   * `representativeOfPage: true` and treats the matching image as the
   * canonical SERP thumbnail.
   */
  readonly representativeOfPage?: boolean;
}

/**
 * Output node for `Hotel.image[]` when emitted as a rich
 * `ImageObject`. The builder picks this shape whenever any caption /
 * dimension is provided; otherwise it falls back to the bare URL
 * string accepted by the legacy contract.
 */
type ImageObjectNode = {
  '@type': 'ImageObject';
  url: string;
  caption?: string;
  width?: number;
  height?: number;
  representativeOfPage?: boolean;
};

export interface HotelJsonLdInput {
  readonly name: string;
  readonly url: string;
  readonly description?: string;
  /** Star rating (1–5). For *Palaces* (Atout France), set `starRating: 5` plus `isPalace: true`. */
  readonly starRating?: 1 | 2 | 3 | 4 | 5;
  /** Marker for the regulated Atout France *Palace* distinction. Surfaces an `award` field. */
  readonly isPalace?: boolean;
  /**
   * Hotel images for `Hotel.image[]`.
   *
   * Accepts:
   *   - `string[]` — bare absolute URLs (legacy contract, pre-B8).
   *   - `ImageObjectInput[]` — rich shape with caption + dimensions +
   *     `representativeOfPage` flag (B8 — CDC §2 bloc 2 contract).
   *
   * The builder normalises each entry independently; mixing is
   * supported (e.g. hero passed as rich object + gallery as bare
   * URLs while editorial captions roll out). Empty arrays are
   * dropped.
   */
  readonly images?: readonly (string | ImageObjectInput)[];
  readonly telephone?: string;
  readonly priceRange?: string;
  readonly address?: HotelAddressInput;
  readonly geo?: HotelGeoInput;
  readonly amenityFeatures?: readonly string[];
  readonly aggregateRating?: AggregateRatingInput;
  readonly offer?: OfferInput;
  /**
   * Optional list of recognitions/awards. Each entry is a free-form text such
   * as `"Forbes Travel Guide 5 Stars — 2024"`. Concatenated with the regulated
   * `Distinction Palace` marker when `isPalace` is also `true`.
   */
  readonly awards?: readonly string[];
  /**
   * Number of bookable units (Schema.org `Hotel.numberOfRooms`). Integer,
   * positive. When provided we surface it both as the rich-result property
   * and let LLMs ground "How many rooms does X have?" queries.
   */
  readonly numberOfRooms?: number;
  /**
   * Time-of-day strings in 24h `HH:MM` form. We do NOT coerce or validate
   * here — the page-level reader already ran them through a Zod regex.
   * Schema.org accepts either bare `Time` or a full `DateTime`; the former
   * is enough for Google's Hotel rich-result test.
   */
  readonly checkinTime?: string;
  readonly checkoutTime?: string;
  /**
   * `true` when pets are accepted (any policy). `false` when explicitly
   * refused. `undefined` leaves the field unset — Google treats absence
   * as "unknown" rather than "no".
   */
  readonly petsAllowed?: boolean;
  /**
   * Editorial pull-quote reviews (Forbes, Condé Nast Traveler, Michelin,
   * etc.). Surfaced as Schema.org `Review[]` items under the Hotel node.
   *
   *   - `reviewBody` ← quote.
   *   - `author.@type = Organization`, `author.name` ← `author ?? source`.
   *   - `publisher.@type = Organization`, `publisher.name` ← `source`.
   *   - `reviewRating` ← `{ratingValue, bestRating, worstRating: 0}` when
   *     `rating` + `maxRating` are both set.
   *   - `datePublished` ← `date`.
   *   - `url` ← `sourceUrl` (HTTPS).
   *
   * Capped at 5 entries before emission to stay within Google's
   * documented Hotel rich-result envelope.
   */
  readonly featuredReviews?: readonly HotelFeaturedReviewInput[];
  /**
   * ISO-8601 timestamp of the last meaningful content update. Surfaces
   * as `dateModified` on the Hotel node — a strong freshness signal
   * for both search engines and LLM ingestion pipelines (Perplexity,
   * SearchGPT) that weight recent content higher.
   *
   * Pass `row.updated_at` from the page reader; the builder accepts
   * either a `YYYY-MM-DDTHH:MM:SSZ` Datetime or a bare `YYYY-MM-DD`.
   */
  readonly dateModified?: string;
  /**
   * Editorial opening year (CDC §2.15 — `foundingDate` on Schema.org's
   * `Organization` parent of `Hotel`). Emitted as a bare `YYYY` string
   * which Google's hotel rich-result test accepts and which LLM
   * pipelines parse correctly for "How old is X?" queries.
   *
   * The reader at the page level (`readHotelHistoryDates`) is the
   * source of truth for the value range — this builder simply forwards
   * what it gets, with a defensive non-empty check.
   */
  readonly foundingDate?: string;
  /**
   * Optional URL of an external immersive 3D / 360° tour of the
   * property (e.g. Matterport, Kuula). Surfaced as Schema.org
   * `LodgingBusiness.tourBookingPage` — Google's Hotel rich-result
   * documentation honours the field, and LLM ingestion pipelines
   * use it to answer "Can I take a virtual tour of X?" queries.
   *
   * The caller is responsible for restricting the URL to a curated
   * allowlist of providers (the reader in
   * `apps/web/src/server/hotels/get-hotel-by-slug.ts:readVirtualTour`
   * enforces Matterport + Kuula and mirrors the CSP `frame-src`
   * directive in `apps/web/src/lib/security/csp.ts`). The builder
   * itself simply forwards the value with a defensive non-empty
   * check; it does NOT re-validate the URL shape.
   */
  readonly tourBookingPage?: string;
  /**
   * Points of interest within walking distance of the hotel, emitted
   * as the `nearbyAttractions` Hotel property (Google-supported
   * extension to Schema.org's `LodgingBusiness`).
   *
   * Capped at 10 entries in the builder. Each entry is rendered as a
   * `TouristAttraction` (or subtype derived from `type`) `Place` with
   * `name` and an optional `geo` block.
   *
   * We intentionally do NOT emit `distance` as Schema.org does not
   * define a `Distance` property on `Place`; the human-visible
   * distance is rendered in `<HotelLocation>` already.
   */
  readonly nearbyAttractions?: readonly NearbyAttractionInput[];
  /**
   * Editorial room sub-pages exposed as Schema.org
   * `Hotel.containsPlace` entries. Each entry surfaces as a
   * `HotelRoom` node carrying `name` + `url` only — the full room
   * graph (`floorSize`, `bed`, `containedInPlace` back to this
   * hotel, …) lives at the room sub-page itself, so duplicating it
   * here would bloat the parent envelope without changing crawl
   * coverage.
   *
   * Capped at 20 entries to keep the JSON envelope tight (Google
   * stops weighting `containsPlace` past the first dozen, and our
   * editorial pipeline already collapses 200-key inventories to
   * 3-5 highlight categories).
   */
  readonly containedRooms?: readonly ContainedRoomInput[];
  /**
   * MICE event spaces exposed as Schema.org `Hotel.containsPlace`
   * entries with `@type: MeetingRoom`. The MICE section on the
   * public page (`<HotelMiceEvents>`) is the human-readable surface
   * for this data; the JSON-LD mirrors it so search engines and
   * LLM ingestion pipelines can answer:
   *
   *   - "What event spaces does X have?"
   *   - "Largest meeting room at X?" (max `maximumAttendeeCapacity`)
   *   - "Hotel in Paris with a 300 m² ballroom?" (faceted retrieval)
   *
   * Capped at 30 entries — even the largest convention hotels in our
   * curated catalogue have fewer than 20 named spaces; 30 is a
   * defensive ceiling against editorial copy-paste of an exhaustive
   * function-sheet that would dilute the structured signal.
   *
   * Mixed with `containedRooms` (HotelRoom) under the same
   * `containsPlace` array, because Schema.org's `containsPlace` is a
   * single property and the `@type` discriminator is what consumers
   * filter on.
   */
  readonly eventSpaces?: readonly MeetingRoomInput[];
  /**
   * Knowledge-graph anchor — Wikidata QID. When set, surfaces as
   * `additionalType: "https://www.wikidata.org/wiki/<QID>"` (Schema.org
   * recommended pattern for entity disambiguation) AND is automatically
   * prepended to `sameAs[]`. AI agents weight Wikidata-anchored entities
   * orders of magnitude higher than free-text matches.
   */
  readonly wikidataId?: string;
  /**
   * Schema.org `sameAs[]` — knowledge-graph anchors. URLs of canonical
   * pages identifying the hotel on third-party platforms (Wikipedia,
   * official site, Commons, TripAdvisor, social handles, Mérimée, etc.).
   * Already de-duped and HTTPS-validated by the page reader; the builder
   * defensively re-filters to HTTPS-only.
   */
  readonly sameAs?: readonly string[];
  /**
   * Schema.org `subjectOf[]` — CreativeWorks ABOUT the hotel.
   * Typically the Wikipedia article(s) and the Commons gallery.
   * Renders as `Article` nodes with `inLanguage` set when known.
   * Strongest EEAT signal we can emit alongside `sameAs`.
   */
  readonly subjectOf?: readonly SubjectOfInput[];
  /** Optional editorial slogan ("L'iconique adresse de la rive gauche"). */
  readonly slogan?: string;
  /** Hotel marketing email (booking-mode=email; never logged). */
  readonly email?: string;
  /**
   * CSS selectors identifying the spoken-summary regions on the page.
   * Defaults to `['#tldr', '#faq']` when omitted but a non-empty
   * `tldr` content hint is given via the `hasTldr` flag.
   */
  readonly speakableSelectors?: readonly string[];
  /**
   * `mainEntityOfPage` — the canonical URL of the page hosting this
   * JSON-LD. Defaults to `input.url` when omitted; explicit override
   * lets the room sub-page emit a different canonical.
   */
  readonly mainEntityOfPage?: string;
  /**
   * Architects / designers — emitted as Schema.org `Person` nodes
   * under `founder` (Organization inheritance on Hotel). Strong
   * grounding signal for "Who designed X?" queries.
   */
  readonly architects?: readonly string[];
  /** Always `true` for our 5★ + Palace catalogue (Palaces are non-smoking by law). */
  readonly smokingAllowed?: boolean;
  /**
   * Operational brand (chain) — emitted as `Hotel.brand` (Schema.org's
   * `Brand` shape). At most one per hotel by definition (see ADR-0023);
   * `mapAffiliationsToBrand` enforces single-brand at the boundary.
   *
   * When provided, surfaces:
   *   - `Hotel.brand.@type: 'Brand'`
   *   - `Hotel.brand.name: <display_name>`
   *   - `Hotel.brand.sameAs: <https URL>` if known
   *   - `Hotel.brand.identifier: <kebab slug>` if known
   *
   * This is a critical agentic + AI-overview signal: knowing that
   * "Hôtel Le Bristol Paris" is operated under the **Oetker Collection**
   * brand lets an LLM disambiguate the property against the chain's
   * own catalogue without re-crawling.
   */
  readonly brand?: HotelBrandInput;
}

export interface SubjectOfInput {
  readonly url: string;
  readonly name?: string;
  /**
   * BCP-47 language tag (e.g. `fr-FR`, `en`, `de`). Widened to `string`
   * for V2 locales — Schema.org accepts any valid BCP-47 tag. See
   * `apps/web/src/i18n/runtime.ts#hreflangKey`.
   */
  readonly inLanguage?: string;
  readonly type?: 'Article' | 'CreativeWork' | 'WebPage';
}

export interface ContainedRoomInput {
  readonly name: string;
  readonly url: string;
}

/**
 * MICE event-space input for the hotel JSON-LD builder. Matches the
 * shape of `LocalisedMiceSpace` produced by `readMiceInfo()` in
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts`. Surface units
 * are always **square metres** (UN/ECE code `MTK`); we never accept
 * imperial because the application never stores it.
 */
export interface MeetingRoomInput {
  readonly name: string;
  readonly surfaceSqm: number;
  readonly maxSeated: number;
  /** Optional editorial note (localised at the call site). */
  readonly description?: string;
}

export interface HotelFeaturedReviewInput {
  readonly source: string;
  readonly sourceUrl?: string;
  readonly author?: string;
  readonly quote: string;
  readonly rating?: number;
  readonly maxRating?: number;
  /** Optional ISO-8601 `YYYY-MM-DD` publication date. */
  readonly date?: string;
}

/**
 * Free-form POI input. `type` maps loosely to a Schema.org Place
 * subtype (see `POI_TYPE_TO_SCHEMA` in this module). Unknown types
 * fall back to the generic `TouristAttraction`.
 */
export interface NearbyAttractionInput {
  readonly name: string;
  readonly type: string;
  readonly latitude?: number;
  readonly longitude?: number;
  /** Optional canonical URL of the attraction (Wikidata, Wikipedia, official site). */
  readonly sameAs?: string;
  /**
   * LLM-generated short narrative (1-2 sentences, EEAT-safe). Surfaces
   * as `description` on the `Place` node — Google + Bing index it for
   * AI-overview snippets.
   */
  readonly description?: string;
  /**
   * Raw OSM `opening_hours` tag. Parsed into
   * `openingHoursSpecification[]` by {@link buildOpeningHoursSpecification}.
   * Unparseable strings are dropped silently — better than emitting a
   * malformed node.
   */
  readonly openingHours?: string;
  /**
   * Free-form `priceRange` (e.g. `'€€'`, `'À partir de 12 €'`). Capped
   * at 32 chars by {@link normalisePriceRange}.
   */
  readonly priceRange?: string;
  /**
   * Pre-resolved Schema.org URL (e.g. `'https://schema.org/Pharmacy'`).
   * When provided, takes precedence over the `type` → class table
   * lookup. The sync script persists it into `points_of_interest[].schema_type`
   * so re-emits stay deterministic.
   */
  readonly schemaTypeUrl?: string;
  /**
   * Optional postal address — adds local-business credibility for
   * utility shops (Pharmacy, BakeryShop, ConvenienceStore). Skipped
   * for cultural / nature POIs where the address adds noise.
   */
  readonly address?: { readonly streetAddress?: string; readonly addressLocality?: string };
}

/**
 * POI editorial type → Schema.org Place subtype.
 *
 * Delegates to {@link osmToSchemaClass} in `place-amenity.ts` — that
 * module owns the canonical taxonomy and is shared with the editorial
 * sync script so a tag mapped here stays consistent end-to-end.
 */
function poiSchemaType(rawType: string): string {
  return osmToSchemaClass(rawType);
}

/**
 * Derives the Schema.org URL form (`https://schema.org/Pharmacy`) for
 * `additionalType`. We prefer the input's `schemaTypeUrl` when the
 * editor explicitly pinned it (e.g. for narrow subtypes that change
 * how Google's local-business panel renders) and fall back to the
 * type-based lookup otherwise.
 *
 * `additionalType` is only emitted when it adds information beyond
 * the bare `@type` (i.e. the narrow URL differs from the broad class
 * already in `@type`) — emitting `additionalType: 'https://schema.org/Museum'`
 * next to `@type: 'Museum'` is pure noise that hurts JSON-LD size
 * without giving Google extra signal.
 */
function additionalTypeFor(input: NearbyAttractionInput, atTypeClass: string): string | undefined {
  if (input.schemaTypeUrl !== undefined && input.schemaTypeUrl.length > 0) {
    const explicit = input.schemaTypeUrl;
    return explicit.endsWith(`/${atTypeClass}`) ? undefined : explicit;
  }
  const inferred = osmToSchemaUrl(input.type);
  return inferred.endsWith(`/${atTypeClass}`) ? undefined : inferred;
}

const PALACE_AWARD = 'Distinction Palace — Atout France';

/**
 * `Hotel` JSON-LD (skill: structured-data-schema-org).
 *
 * Legal note: the *Palace* distinction is regulated by Atout France. When
 * `isPalace` is `true`, expose it via the standard `award` property; never
 * inflate `starRating` beyond 5.
 */
export const hotelJsonLd = (input: HotelJsonLdInput): HotelNode => {
  const out: HotelNode = {
    '@type': 'Hotel',
    name: input.name,
    url: input.url,
  };

  if (input.description !== undefined) {
    out.description = input.description;
  }
  if (input.starRating !== undefined) {
    // `bestRating: 5` is recommended by Google's hotel rich-result
    // documentation even though `ratingValue` is already capped at 5
    // by our discriminated input type. Emitting it explicitly removes
    // any ambiguity for indexers that don't infer the scale.
    out.starRating = { '@type': 'Rating', ratingValue: input.starRating, bestRating: 5 };
  }
  // `award` may carry the regulated Palace distinction and/or editorial
  // recognitions. Schema.org allows multiple values, expressed as a string
  // array when the count is > 1.
  const awardEntries: string[] = [];
  if (input.isPalace === true) {
    awardEntries.push(PALACE_AWARD);
  }
  if (input.awards !== undefined) {
    for (const award of input.awards) {
      const trimmed = award.trim();
      if (trimmed.length > 0) awardEntries.push(trimmed);
    }
  }
  const firstAward = awardEntries[0];
  if (awardEntries.length === 1 && firstAward !== undefined) {
    out.award = firstAward;
  } else if (awardEntries.length > 1) {
    out.award = awardEntries;
  }
  if (input.images !== undefined && input.images.length > 0) {
    // Normalise each entry: strings stay as bare URLs; rich inputs
    // emit a full `ImageObject` node when at least one optional field
    // (caption, dimensions, representativeOfPage) is set. Pure URL
    // values keep the legacy compact shape so we don't bloat the
    // envelope on legacy hotels that haven't been re-captioned yet.
    const nodes: (string | ImageObjectNode)[] = [];
    for (const entry of input.images) {
      if (typeof entry === 'string') {
        nodes.push(entry);
        continue;
      }
      const caption = entry.caption?.trim();
      const hasCaption = caption !== undefined && caption.length > 0;
      const hasDimensions =
        (entry.width !== undefined && entry.width > 0) ||
        (entry.height !== undefined && entry.height > 0);
      const hasRepFlag = entry.representativeOfPage !== undefined;
      if (!hasCaption && !hasDimensions && !hasRepFlag) {
        nodes.push(entry.url);
        continue;
      }
      const node: ImageObjectNode = { '@type': 'ImageObject', url: entry.url };
      if (hasCaption && caption !== undefined) node.caption = caption;
      if (entry.width !== undefined && entry.width > 0) node.width = entry.width;
      if (entry.height !== undefined && entry.height > 0) node.height = entry.height;
      if (entry.representativeOfPage !== undefined) {
        node.representativeOfPage = entry.representativeOfPage;
      }
      nodes.push(node);
    }
    // `Hotel.image` is typed as `string | string[]` in schema-dts; we
    // safely re-open it here because the upstream HotelNode is a
    // structural type that allows array-of-mixed once normalised.
    out.image = nodes as unknown as readonly string[];
  }
  if (input.telephone !== undefined) {
    out.telephone = input.telephone;
  }
  if (input.priceRange !== undefined) {
    out.priceRange = input.priceRange;
  }
  if (input.address !== undefined) {
    out.address = {
      '@type': 'PostalAddress',
      streetAddress: input.address.streetAddress,
      addressLocality: input.address.addressLocality,
      postalCode: input.address.postalCode,
      addressCountry: input.address.addressCountry ?? 'FR',
      ...(input.address.addressRegion !== undefined
        ? { addressRegion: input.address.addressRegion }
        : {}),
    };
  }
  if (input.geo !== undefined) {
    out.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.geo.latitude,
      longitude: input.geo.longitude,
    };
  }
  if (input.amenityFeatures !== undefined && input.amenityFeatures.length > 0) {
    out.amenityFeature = input.amenityFeatures.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    }));
  }
  if (input.aggregateRating !== undefined) {
    out.aggregateRating = aggregateRatingJsonLd(input.aggregateRating);
  }
  if (input.offer !== undefined) {
    out.makesOffer = offerJsonLd(input.offer);
  }
  if (input.numberOfRooms !== undefined && input.numberOfRooms > 0) {
    out.numberOfRooms = input.numberOfRooms;
  }
  if (input.checkinTime !== undefined && input.checkinTime.length > 0) {
    out.checkinTime = input.checkinTime;
  }
  if (input.checkoutTime !== undefined && input.checkoutTime.length > 0) {
    out.checkoutTime = input.checkoutTime;
  }
  if (input.petsAllowed !== undefined) {
    out.petsAllowed = input.petsAllowed;
  }
  if (input.dateModified !== undefined && input.dateModified.length > 0) {
    out.dateModified = input.dateModified;
  }
  if (input.foundingDate !== undefined && input.foundingDate.length > 0) {
    out.foundingDate = input.foundingDate;
  }
  if (input.tourBookingPage !== undefined && input.tourBookingPage.length > 0) {
    out.tourBookingPage = input.tourBookingPage;
  }
  if (input.nearbyAttractions !== undefined && input.nearbyAttractions.length > 0) {
    // Cap at 24 to cover the three editorial buckets (visit / do / shop,
    // typically 6-8 entries each — see CDC §2 bloc 10 + the front-end
    // `<HotelLocation>` 3-section layout). Google ignores anything past
    // ~12 in its rich-result test but the wider set still surfaces in
    // LLM ingestion pipelines (Bing, Perplexity, Anthropic crawlers).
    out.nearbyAttractions = input.nearbyAttractions.slice(0, 24).map((poi) => {
      const atTypeClass = poiSchemaType(poi.type);
      const node: NearbyAttractionNode = {
        '@type': atTypeClass,
        name: poi.name,
      };
      if (poi.latitude !== undefined && poi.longitude !== undefined) {
        node.geo = {
          '@type': 'GeoCoordinates',
          latitude: poi.latitude,
          longitude: poi.longitude,
        };
      }
      if (poi.sameAs !== undefined && poi.sameAs.length > 0) {
        node.sameAs = poi.sameAs;
      }
      if (poi.description !== undefined) {
        const trimmed = poi.description.trim();
        if (trimmed.length > 0) {
          // Cap at 280 chars — same envelope as the DB schema so a
          // single-source-of-truth narrative renders identically in
          // the page body and the JSON-LD.
          node.description = trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed;
        }
      }
      if (poi.openingHours !== undefined) {
        const spec = buildOpeningHoursSpecification(poi.openingHours);
        if (spec.length > 0) {
          node.openingHoursSpecification = spec;
        }
      }
      const price = normalisePriceRange(poi.priceRange);
      if (price !== null) {
        node.priceRange = price;
      }
      const additional = additionalTypeFor(poi, atTypeClass);
      if (additional !== undefined) {
        node.additionalType = additional;
      }
      if (poi.address !== undefined) {
        const street = poi.address.streetAddress?.trim();
        const locality = poi.address.addressLocality?.trim();
        if ((street && street.length > 0) || (locality && locality.length > 0)) {
          node.address = {
            '@type': 'PostalAddress',
            ...(street && street.length > 0 ? { streetAddress: street } : {}),
            ...(locality && locality.length > 0 ? { addressLocality: locality } : {}),
          };
        }
      }
      return node;
    });
  }
  // `containsPlace` aggregates two distinct sub-types: editorial
  // `HotelRoom` sub-pages and `MeetingRoom` MICE spaces. Schema.org
  // exposes a single property; consumers discriminate on the inner
  // `@type`. We build the merged array once at the end so both feeds
  // share the cap budget and the emission order is stable
  // (rooms first, then meeting rooms — mirrors the visible page
  // order: rooms section → MICE section).
  const containedPlaces: ContainedPlaceNode[] = [];
  if (input.containedRooms !== undefined && input.containedRooms.length > 0) {
    // Cap at 20 — editorial pipelines typically curate 3-5 room
    // categories per hotel; the cap is a defensive ceiling, not a hot
    // path.
    for (const room of input.containedRooms.slice(0, 20)) {
      containedPlaces.push({
        '@type': 'HotelRoom',
        name: room.name,
        url: room.url,
      });
    }
  }
  if (input.eventSpaces !== undefined && input.eventSpaces.length > 0) {
    for (const space of input.eventSpaces.slice(0, 30)) {
      // Defensive numeric guards. The reader (`readMiceInfo`)
      // already Zod-validates positives, but the builder accepts
      // raw inputs from other callers too (tests, future seeds).
      if (!Number.isFinite(space.surfaceSqm) || space.surfaceSqm <= 0) continue;
      if (!Number.isFinite(space.maxSeated) || space.maxSeated <= 0) continue;
      const trimmedName = space.name.trim();
      if (trimmedName.length === 0) continue;
      const node: MeetingRoomNode = {
        '@type': 'MeetingRoom',
        name: trimmedName,
        floorSize: {
          '@type': 'QuantitativeValue',
          value: space.surfaceSqm,
          unitCode: 'MTK',
        },
        maximumAttendeeCapacity: space.maxSeated,
      };
      if (space.description !== undefined) {
        const trimmedDescription = space.description.trim();
        if (trimmedDescription.length > 0) {
          node.description = trimmedDescription;
        }
      }
      containedPlaces.push(node);
    }
  }
  if (containedPlaces.length > 0) {
    out.containsPlace = containedPlaces;
  }
  // ── Knowledge-graph anchors (sameAs + subjectOf + additionalType) ─────
  // Built first so the order in the JSON envelope mirrors authority:
  //   additionalType (Wikidata) → sameAs[] (canonical URLs) → subjectOf[]
  if (input.wikidataId !== undefined && /^Q[1-9][0-9]*$/u.test(input.wikidataId)) {
    out.additionalType = `https://www.wikidata.org/wiki/${input.wikidataId}`;
  }
  if (input.sameAs !== undefined && input.sameAs.length > 0) {
    // Defensive re-filter — accept only HTTPS so a corrupt seed can't
    // poison the payload with javascript:/data:/http: URLs.
    const safe = input.sameAs.filter((u) => /^https:\/\/[^\s<>]+$/iu.test(u));
    if (safe.length > 0) {
      // Cap at 25 entries — that's already 3× more than Google's
      // hotel rich-result test acknowledges, and the cap keeps the
      // envelope under the recommended 8 KB JSON-LD soft limit even
      // when paired with a long `nearbyAttractions` list.
      out.sameAs = safe.slice(0, 25);
    }
  }
  if (input.subjectOf !== undefined && input.subjectOf.length > 0) {
    const nodes: SubjectOfNode[] = [];
    for (const subj of input.subjectOf) {
      if (!/^https:\/\/[^\s<>]+$/iu.test(subj.url)) continue;
      const node: SubjectOfNode = {
        '@type': subj.type ?? 'Article',
        url: subj.url,
      };
      if (subj.name !== undefined && subj.name.length > 0) node.name = subj.name;
      if (subj.inLanguage !== undefined) node.inLanguage = subj.inLanguage;
      nodes.push(node);
      if (nodes.length >= 6) break;
    }
    if (nodes.length > 0) out.subjectOf = nodes;
  }
  if (input.slogan !== undefined && input.slogan.trim().length > 0) {
    out.slogan = input.slogan.trim();
  }
  if (input.email !== undefined && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input.email)) {
    out.email = input.email;
  }
  // currenciesAccepted + paymentAccepted — constants for the French
  // luxury catalog, but exposed as inputs so future markets can override.
  out.currenciesAccepted = 'EUR';
  out.paymentAccepted = 'Visa, Mastercard, American Express, Apple Pay, Google Pay';
  // Palaces (regulated 5★ + Atout France distinction) are non-smoking
  // by French law (decree 2006-1386 + extension to luxury hotels). When
  // the caller doesn't specify, default to `false` for `isPalace=true`.
  if (input.smokingAllowed !== undefined) {
    out.smokingAllowed = input.smokingAllowed;
  } else if (input.isPalace === true) {
    out.smokingAllowed = false;
  }
  if (input.architects !== undefined && input.architects.length > 0) {
    const founderNodes = input.architects
      .map((a) => a.trim())
      .filter((a) => a.length > 0 && a.length < 120)
      .slice(0, 4)
      .map((name) => ({ '@type': 'Person' as const, name }));
    if (founderNodes.length > 0) {
      out.founder = founderNodes;
    }
  }
  if (input.brand !== undefined) {
    const trimmedName = input.brand.name.trim();
    if (trimmedName.length > 0) {
      const node: BrandNode = { '@type': 'Brand', name: trimmedName };
      if (input.brand.sameAs !== undefined && /^https:\/\//iu.test(input.brand.sameAs)) {
        node.sameAs = input.brand.sameAs;
      }
      if (input.brand.identifier !== undefined && input.brand.identifier.length > 0) {
        node.identifier = input.brand.identifier;
      }
      out.brand = node;
    }
  }
  // Speakable — surfaces the AEO TL;DR / FAQ / FactualSummary / ConciergeAdvice
  // blocks to voice assistants (B10 / CDC §2.3 + ADR-0011). Order matters: the
  // first matched selector with text content is the one Google Assistant
  // synthesises, so we lead with the dense factual summary, then the TL;DR,
  // then the Concierge advice (Concierge voice differentiator), then the FAQ.
  const speakableCss = input.speakableSelectors ?? [
    '#factual-summary',
    '#tldr',
    '#concierge-advice',
    '#faq',
  ];
  if (speakableCss.length > 0) {
    out.speakable = {
      '@type': 'SpeakableSpecification',
      cssSelector: [...speakableCss],
    };
  }
  // mainEntityOfPage — explicit canonical anchor of the JSON-LD.
  out.mainEntityOfPage = input.mainEntityOfPage ?? input.url;

  if (input.featuredReviews !== undefined && input.featuredReviews.length > 0) {
    // Cap at 5 to mirror Google's documented Hotel rich-result envelope
    // (https://developers.google.com/search/docs/appearance/structured-data/hotel).
    // Editorial workflows that exceed 5 entries should curate down before
    // publication; this is a defensive emission cap, not a hard limit.
    out.review = input.featuredReviews.slice(0, 5).map((review) => ({
      '@type': 'Review',
      reviewBody: review.quote,
      author: {
        '@type': 'Organization',
        name:
          review.author !== undefined && review.author.length > 0 ? review.author : review.source,
      },
      publisher: {
        '@type': 'Organization',
        name: review.source,
      },
      ...(review.sourceUrl !== undefined && review.sourceUrl.length > 0
        ? { url: review.sourceUrl }
        : {}),
      ...(review.date !== undefined && review.date.length > 0
        ? { datePublished: review.date }
        : {}),
      ...(review.rating !== undefined && review.maxRating !== undefined && review.maxRating > 0
        ? {
            reviewRating: {
              '@type': 'Rating',
              // Hard Rule 11: Google's Hotel rich result always renders /5,
              // so we normalise any vendor scale (Forbes /100, /10, etc.) to
              // 0-5 and pin bestRating to 5. Never advertise bestRating > 5.
              ratingValue: Math.round((review.rating / review.maxRating) * 5 * 100) / 100,
              bestRating: 5,
              worstRating: 0,
            },
          }
        : {}),
    }));
  }

  return out;
};
