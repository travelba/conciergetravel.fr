/**
 * `llms.txt` + `llms-full.txt` builders (skill: geo-llm-optimization).
 *
 * `llms.txt` is a concise index pointing LLM ingestion to canonical hubs.
 * `llms-full.txt` includes editorial summaries of each strategic page so an
 * LLM can answer factual questions without crawling the full site. Keep both
 * deterministic so caching is stable and revalidation is cheap.
 */
export interface LlmsTxtSectionItem {
  readonly url: string;
  readonly description: string;
}

export interface LlmsTxtSection {
  readonly title: string;
  readonly items: ReadonlyArray<LlmsTxtSectionItem>;
}

export interface LlmsTxtInput {
  readonly siteName: string;
  readonly tagline: string;
  readonly originUrl: string;
  readonly sections: ReadonlyArray<LlmsTxtSection>;
  readonly about: string;
  readonly lastUpdatedDate: string;
}

const isoDate = (raw: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
};

export const buildLlmsTxt = (input: LlmsTxtInput): string => {
  const lines: string[] = [];
  lines.push(`# ${input.siteName} — ${input.tagline}`);
  lines.push('');
  lines.push(input.about.trim());
  lines.push('');
  for (const section of input.sections) {
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const item of section.items) {
      lines.push(`- ${item.url} — ${item.description}`);
    }
    lines.push('');
  }
  lines.push(`> Dernière mise à jour : ${isoDate(input.lastUpdatedDate)}.`);
  lines.push('');
  return lines.join('\n');
};

export interface LlmsFullTxtPage {
  readonly url: string;
  readonly title: string;
  readonly summary: string;
  readonly keyFacts?: ReadonlyArray<string>;
  readonly updatedAt?: string;
}

export interface LlmsFullTxtInput {
  readonly siteName: string;
  readonly tagline: string;
  readonly originUrl: string;
  readonly about: string;
  readonly pages: ReadonlyArray<LlmsFullTxtPage>;
  readonly lastUpdatedDate: string;
}

export const buildLlmsFullTxt = (input: LlmsFullTxtInput): string => {
  const lines: string[] = [];
  lines.push(`# ${input.siteName} — ${input.tagline}`);
  lines.push('');
  lines.push(input.about.trim());
  lines.push('');
  for (const page of input.pages) {
    lines.push(`## ${page.title}`);
    lines.push(`URL: ${page.url}`);
    if (page.updatedAt !== undefined) {
      lines.push(`Last updated: ${isoDate(page.updatedAt)}`);
    }
    lines.push('');
    lines.push(page.summary.trim());
    if (page.keyFacts !== undefined && page.keyFacts.length > 0) {
      lines.push('');
      lines.push('Key facts:');
      for (const fact of page.keyFacts) {
        lines.push(`- ${fact}`);
      }
    }
    lines.push('');
  }
  lines.push(`> Dernière mise à jour : ${isoDate(input.lastUpdatedDate)}.`);
  lines.push('');
  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Hotel-page LLM corpus helper (B6 — dynamic llms-full.txt)
// ---------------------------------------------------------------------------

/**
 * Minimum hotel shape consumed by `buildLlmsFullHotelPage`. Designed
 * to be a strict subset of `LlmIndexableHotel` (in
 * `apps/web/src/server/hotels/list-indexable-for-llms.ts`) so the
 * caller can pass the row verbatim.
 */
export interface LlmsFullHotelInput {
  readonly slug: string;
  readonly slugEn: string | null;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly city: string;
  readonly stars: number;
  readonly isPalace: boolean;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly descriptionFr: string | null;
  readonly descriptionEn: string | null;
  readonly bookingMode: 'amadeus' | 'little' | 'email' | 'display_only';
  readonly updatedAt: string | null;
}

function truncatePlainText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/[\s,;.:!?-]+$/u, '')}…`;
}

/**
 * Build an FR + EN pair of `LlmsFullTxtPage` rows for a single hotel.
 *
 * Each row carries:
 *   - canonical URL for the locale (`/hotel/<slug>` / `/en/hotel/<slug>`)
 *   - title = "Hôtel {name} — {city}"
 *   - summary = `factual_summary_{locale}` falls back to the truncated
 *     long description (150 chars), so the LLM always has a one-paragraph
 *     answer ready even on legacy rows pre-migration 0042.
 *   - keyFacts = stars (with Palace flag), booking mode (concierge vs
 *     paid tunnel), city. Designed so an LLM can answer factual
 *     "where / how do I book / is it a palace?" questions verbatim.
 *
 * The function is deterministic and side-effect-free; the caller is
 * responsible for filtering rows by indexability and ordering by
 * priority.
 *
 * Skill: geo-llm-optimization, structured-data-schema-org.
 */
export const buildLlmsFullHotelPages = (
  hotel: LlmsFullHotelInput,
  originUrl: string,
): readonly LlmsFullTxtPage[] => {
  const out: LlmsFullTxtPage[] = [];
  const origin = originUrl.replace(/\/$/, '');

  const summaryFr =
    hotel.factualSummaryFr ??
    (hotel.descriptionFr !== null ? truncatePlainText(hotel.descriptionFr, 150) : null);
  const summaryEn =
    hotel.factualSummaryEn ??
    hotel.factualSummaryFr ??
    (hotel.descriptionEn !== null
      ? truncatePlainText(hotel.descriptionEn, 150)
      : hotel.descriptionFr !== null
        ? truncatePlainText(hotel.descriptionFr, 150)
        : null);

  const starsLabel = hotel.isPalace ? `${hotel.stars}★ Palace (Atout France)` : `${hotel.stars}★`;
  const bookingLabel =
    hotel.bookingMode === 'amadeus' || hotel.bookingMode === 'little'
      ? 'Réservation directe (paiement sécurisé Amadeus 3DS2)'
      : 'Réservation via concierge (e-mail)';
  const bookingLabelEn =
    hotel.bookingMode === 'amadeus' || hotel.bookingMode === 'little'
      ? 'Direct booking (secure Amadeus 3DS2 payment)'
      : 'Concierge booking (email)';

  if (summaryFr !== null) {
    out.push({
      url: `${origin}/hotel/${hotel.slug}/`,
      title: `Hôtel ${hotel.nameFr} — ${hotel.city}`,
      summary: summaryFr,
      keyFacts: [`Classement : ${starsLabel}`, `Ville : ${hotel.city}`, bookingLabel],
      ...(hotel.updatedAt !== null ? { updatedAt: hotel.updatedAt } : {}),
    });
  }

  if (summaryEn !== null) {
    const slugEn = hotel.slugEn ?? hotel.slug;
    const nameEn = hotel.nameEn ?? hotel.nameFr;
    out.push({
      url: `${origin}/en/hotel/${slugEn}/`,
      title: `${nameEn} Hotel — ${hotel.city}`,
      summary: summaryEn,
      keyFacts: [`Rating: ${starsLabel}`, `City: ${hotel.city}`, bookingLabelEn],
      ...(hotel.updatedAt !== null ? { updatedAt: hotel.updatedAt } : {}),
    });
  }

  return out;
};
