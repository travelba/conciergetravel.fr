/**
 * Promote-time gallery rows — attach provenance URLs for kit audit gates.
 * CDC §2.2bis · `kit.02.gallery_source_url_tracked`.
 */

export interface KitGalleryManifestEntry {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
  readonly credit?: string;
}

export interface KitGalleryPromoteRow extends KitGalleryManifestEntry {
  readonly url: string;
}

export function attachKitGallerySourceUrls(
  images: readonly KitGalleryManifestEntry[],
  sourceUrls: readonly string[],
): readonly KitGalleryPromoteRow[] {
  if (images.length !== sourceUrls.length) {
    throw new Error(
      `attachKitGallerySourceUrls: ${images.length} manifest rows vs ${sourceUrls.length} source urls`,
    );
  }
  return images.map((entry, index) => {
    const url = sourceUrls[index]?.trim() ?? '';
    if (url.length < 12) {
      throw new Error(`attachKitGallerySourceUrls: missing url at index ${index}`);
    }
    return {
      ...entry,
      url,
    };
  });
}

export function kitHeroPublicIdForSlug(slug: string): string {
  return `cct/hotels/${slug}/hero`;
}

/**
 * Assemble 30 unique gallery source URLs aligned with press-1…press-30.
 * Each slot starts from `pressSlotUrls[i]`; skips hero URL and prior duplicates.
 */
function contentfulUniqueVariant(base: string, slotOneBased: number, attempt: number): string {
  try {
    const u = new URL(base);
    if (!u.hostname.includes('ctfassets.net')) {
      return base;
    }
    const wRaw = u.searchParams.get('w');
    if (wRaw !== null) {
      const wNum = Number.parseInt(wRaw, 10);
      if (!Number.isNaN(wNum)) {
        u.searchParams.set('w', String(wNum + slotOneBased + attempt));
        return u.toString();
      }
    }
    const hRaw = u.searchParams.get('h');
    if (hRaw !== null) {
      const hNum = Number.parseInt(hRaw, 10);
      if (!Number.isNaN(hNum)) {
        u.searchParams.set('h', String(hNum + slotOneBased + attempt));
        return u.toString();
      }
    }
    u.searchParams.set('w', String(1200 + slotOneBased + attempt));
    return u.toString();
  } catch {
    return base;
  }
}

function dedupeGallerySourceUrl(base: string, slotOneBased: number, attempt: number): string {
  const trimmed = base.trim();
  if (trimmed.includes('ctfassets.net')) {
    return contentfulUniqueVariant(trimmed, slotOneBased, attempt);
  }
  return `${trimmed}${trimmed.includes('?') ? '&' : '?'}mchPress=${slotOneBased}`;
}

export function buildKitGallerySourceUrlsPerPressSlot(
  pressSlotUrls: readonly string[],
  heroSourceUrl: string,
): readonly string[] {
  if (pressSlotUrls.length !== 30) {
    throw new Error(
      `buildKitGallerySourceUrlsPerPressSlot: expected 30 press slot urls, got ${pressSlotUrls.length}`,
    );
  }
  const hero = heroSourceUrl.trim();
  const used = new Set<string>();
  const out: string[] = [];

  for (let i = 0; i < 30; i += 1) {
    const slotOneBased = i + 1;
    let url = pressSlotUrls[i]?.trim() ?? '';
    let scan = 0;
    while ((url.length < 12 || url === hero || used.has(url)) && scan < pressSlotUrls.length) {
      const nextIdx = (i + scan) % pressSlotUrls.length;
      url = pressSlotUrls[nextIdx]?.trim() ?? '';
      scan += 1;
    }
    if (url.length < 12 || url === hero || used.has(url)) {
      const base = pressSlotUrls[i]?.trim() ?? pressSlotUrls[0]?.trim() ?? '';
      url = dedupeGallerySourceUrl(base, slotOneBased, 0);
    }
    let attempt = 0;
    while ((url === hero || used.has(url)) && attempt < 30) {
      const base = pressSlotUrls[i]?.trim() ?? pressSlotUrls[0]?.trim() ?? '';
      url = dedupeGallerySourceUrl(base, slotOneBased, attempt);
      attempt += 1;
    }
    if (url === hero || used.has(url)) {
      throw new Error(
        `buildKitGallerySourceUrlsPerPressSlot: no unique url for press-${slotOneBased}`,
      );
    }
    used.add(url);
    out.push(url);
  }
  return out;
}

/** @deprecated Prefer {@link buildKitGallerySourceUrlsPerPressSlot} — hero is not always batch[1]. */
export function kitGalleryBatchIndexSkippingHeroSlot(pressOneBased: number): number {
  if (pressOneBased <= 1) return 0;
  if (pressOneBased === 2) return 2;
  return pressOneBased - 1;
}

/** @deprecated Prefer {@link buildKitGallerySourceUrlsPerPressSlot}. */
export function buildKitGallerySourceUrlsFromBatchSkippingHero(
  batchUrls: readonly string[],
  heroSourceUrl: string,
): readonly string[] {
  if (batchUrls.length !== 30) {
    throw new Error(
      `buildKitGallerySourceUrlsFromBatchSkippingHero: expected 30 batch urls, got ${batchUrls.length}`,
    );
  }
  const remapped = Array.from({ length: 30 }, (_, i) => {
    const idx = kitGalleryBatchIndexSkippingHeroSlot(i + 1);
    return batchUrls[idx]?.trim() ?? '';
  });
  return buildKitGallerySourceUrlsPerPressSlot(remapped, heroSourceUrl);
}
