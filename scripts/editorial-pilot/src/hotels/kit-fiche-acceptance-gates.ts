/**
 * Kit fiche PO acceptance gates — every wave-5 PO remark → automated blocker.
 *
 * Registry: `kit-po-remark-registry.ts` (remark ↔ gate matrix).
 * Skill: `.cursor/skills/hotel-kit-rollout/SKILL.md` §D7–D19 + Rule 6.
 *
 * Keep HOTEL_KIT_SLUGS in sync with:
 * `apps/web/src/server/hotels/kit/is-hotel-kit-slug.ts`
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compareGoogleReviewsByRecency,
  GOOGLE_REVIEW_MIN_COMMENT_CHARS,
} from '@mch/domain/reviews';
import {
  evaluateGalleryAltCategoryCorrespondence,
  evaluatePoiStructuralCorrespondence,
} from '@mch/domain/photos';

import {
  evaluateFaqKitRowEnrichment,
  evaluateKitConciergeMandatoryGates,
} from './faq-kit-row-enrichment.js';
import {
  CONCIERGE_QUESTIONS_MIN,
  FAQ_KIT_MIN_ITEMS,
  FAQ_PROMOTE_MIN_ITEMS,
} from './faq-perplexity-taxonomy.js';
/** CDC §2.2 categories — duplicated here to avoid circular import with hotel-fiche-cdc-gates. */
const KIT_REQUIRED_GALLERY_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');

/** Reference pilots — exempt from per-slug room batch/display modules (D16). */
export const KIT_REFERENCE_PILOT_SLUGS = ['les-airelles-gordes', 'prince-de-galles-paris'] as const;

/** Published kit slugs (exclude locale alias `*-en` — DB canonical slug only). */
export const HOTEL_KIT_SLUGS = [
  'les-airelles-gordes',
  'prince-de-galles-paris',
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-airelles-courchevel',
  'les-pres-deugenie',
  'shangri-la-paris',
] as const;

export type HotelKitSlug = (typeof HOTEL_KIT_SLUGS)[number];

export function isHotelKitSlug(slug: string): slug is HotelKitSlug {
  return (HOTEL_KIT_SLUGS as readonly string[]).includes(slug);
}

export interface KitRoomAuditRow {
  readonly slug: string;
  readonly imageCount: number;
}

export interface KitAcceptanceInput {
  readonly slug: string;
  readonly name: string;
  readonly hero_image: string | null;
  readonly concierge_pick: unknown;
  readonly gallery_images: unknown;
  readonly google_reviews: unknown;
  readonly last_reviews_sync: string | null;
  readonly faq_content_kit: unknown;
  readonly faq_content: unknown;
  readonly concierge_questions: unknown;
  readonly signature_experiences: unknown;
  readonly points_of_interest: unknown;
  /** Room slugs in render order (post `order*KitRoomCards`). Falls back to DB order. */
  readonly orderedRoomSlugs?: readonly string[];
  readonly rooms: readonly KitRoomAuditRow[];
}

export interface KitAcceptanceCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
}

const KIT_VISIBLE_ROOM_COUNT = 3;
const KIT_GALLERY_MIN = 30;
const GMB_MIN_DISPLAY_REVIEWS = 3;
const GMB_RECENCY_MAX_DAYS = 90;
const GMB_SYNC_MAX_DAYS = 30;
const SIG_EXP_MIN_COUNT = 4;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function jsonLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function repoFile(relPath: string): string {
  return resolve(REPO_ROOT, relPath);
}

function readConciergePickSlug(concierge_pick: unknown): string | null {
  if (!isRecord(concierge_pick)) return null;
  const slug = concierge_pick['slug'];
  return typeof slug === 'string' && slug.trim().length > 0 ? slug.trim() : null;
}

function hasConciergePickNote(concierge_pick: unknown): boolean {
  if (!isRecord(concierge_pick)) return false;
  const note = concierge_pick['note'];
  if (!isRecord(note)) return false;
  const fr = note['fr'];
  const en = note['en'];
  return (
    (typeof fr === 'string' && fr.trim().length > 0) ||
    (typeof en === 'string' && en.trim().length > 0)
  );
}

export function visibleKitRoomSlugs(roomSlugs: readonly string[]): readonly string[] {
  return roomSlugs.slice(0, KIT_VISIBLE_ROOM_COUNT);
}

export function orderKitVisibleRoomSlugs(
  roomSlugs: readonly string[],
  pickSlug: string | null,
): readonly string[] {
  const ordered = [...roomSlugs];
  if (pickSlug !== null) {
    const idx = ordered.indexOf(pickSlug);
    if (idx > 0) {
      ordered.splice(idx, 1);
      ordered.unshift(pickSlug);
    }
  }
  return ordered.slice(0, KIT_VISIBLE_ROOM_COUNT);
}

function roomImageCountBySlug(rooms: readonly KitRoomAuditRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const room of rooms) {
    map.set(room.slug, room.imageCount);
  }
  return map;
}

function readPublicId(item: Record<string, unknown>): string | null {
  const publicId = item['public_id'];
  if (typeof publicId === 'string' && publicId.trim().length > 0) return publicId.trim();
  return null;
}

function readSourceUrl(item: Record<string, unknown>): string | null {
  const url = item['url'] ?? item['source_url'];
  if (typeof url !== 'string' || url.trim().length < 12) return null;
  return url.trim();
}

function galleryPublicIds(gallery_images: unknown): readonly string[] {
  if (!Array.isArray(gallery_images)) return [];
  const ids: string[] = [];
  for (const item of gallery_images) {
    if (!isRecord(item)) continue;
    const publicId = readPublicId(item);
    if (publicId !== null) ids.push(publicId);
  }
  return ids;
}

function countDuplicateGalleryPublicIds(gallery_images: unknown): number {
  if (!Array.isArray(gallery_images)) return 0;
  const counts = new Map<string, number>();
  for (const item of gallery_images) {
    if (!isRecord(item)) continue;
    const publicId = readPublicId(item);
    if (publicId === null) continue;
    counts.set(publicId, (counts.get(publicId) ?? 0) + 1);
  }
  let dupSlots = 0;
  for (const n of counts.values()) {
    if (n > 1) dupSlots += n - 1;
  }
  return dupSlots;
}

function countDuplicateGallerySourceUrls(gallery_images: unknown): number {
  if (!Array.isArray(gallery_images)) return 0;
  const counts = new Map<string, number>();
  for (const item of gallery_images) {
    if (!isRecord(item)) continue;
    const url = readSourceUrl(item);
    if (url === null) continue;
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }
  let dupSlots = 0;
  for (const n of counts.values()) {
    if (n > 1) dupSlots += n - 1;
  }
  return dupSlots;
}

function countGalleryMissingSourceUrls(gallery_images: unknown): number {
  if (!Array.isArray(gallery_images)) return KIT_GALLERY_MIN;
  let missing = 0;
  for (const item of gallery_images) {
    if (!isRecord(item)) {
      missing += 1;
      continue;
    }
    if (readSourceUrl(item) === null) missing += 1;
  }
  return missing;
}

function galleryCategoryForPublicId(gallery_images: unknown, publicId: string): string | null {
  if (!Array.isArray(gallery_images)) return null;
  for (const item of gallery_images) {
    if (!isRecord(item)) continue;
    if (readPublicId(item) !== publicId) continue;
    const cat = item['category'];
    return typeof cat === 'string' && cat.length > 0 ? cat.toLowerCase() : null;
  }
  return null;
}

function galleryCategorySet(gallery_images: unknown): Set<string> {
  const cats = new Set<string>();
  if (!Array.isArray(gallery_images)) return cats;
  for (const item of gallery_images) {
    if (!isRecord(item)) continue;
    const cat = item['category'];
    if (typeof cat === 'string' && cat.length > 0) cats.add(cat.toLowerCase());
  }
  return cats;
}

function faqKitIsPromoteStub(faq_content_kit: unknown, faq_content: unknown): boolean {
  const kitLen = jsonLen(faq_content_kit);
  const promoteLen = jsonLen(faq_content);
  if (kitLen === 0) return true;
  if (kitLen < FAQ_KIT_MIN_ITEMS && kitLen === promoteLen) return true;
  if (kitLen < FAQ_KIT_MIN_ITEMS && kitLen <= promoteLen) return true;
  return false;
}

function faqKitMissingGroups(faq_content_kit: unknown): number {
  if (!Array.isArray(faq_content_kit)) return 0;
  let missing = 0;
  for (const item of faq_content_kit) {
    if (!isRecord(item)) continue;
    const groupFr = item['group_fr'];
    if (typeof groupFr !== 'string' || groupFr.trim().length === 0) missing += 1;
  }
  return missing;
}

interface ParsedGmbReview {
  readonly publishTime: string | null;
  readonly text: string;
  readonly author: string;
  readonly rating: number;
}

function parseGmbReviews(raw: unknown): readonly ParsedGmbReview[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedGmbReview[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const author = entry['author'];
    const text = entry['text'];
    const rating = entry['rating'];
    const publishTime = entry['publish_time'];
    if (typeof author !== 'string' || author.trim().length === 0) continue;
    if (typeof text !== 'string' || text.trim().length < GOOGLE_REVIEW_MIN_COMMENT_CHARS) {
      continue;
    }
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      continue;
    }
    out.push({
      author: author.trim(),
      text: text.trim(),
      rating,
      publishTime:
        typeof publishTime === 'string' && publishTime.trim().length > 0
          ? publishTime.trim()
          : null,
    });
  }
  return out;
}

function daysSince(iso: string, nowMs: number): number | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return (nowMs - ms) / (1000 * 60 * 60 * 24);
}

function newestPublishTime(reviews: readonly ParsedGmbReview[]): string | null {
  let newest: string | null = null;
  for (const r of reviews) {
    if (r.publishTime === null) continue;
    if (newest === null || r.publishTime.localeCompare(newest) > 0) newest = r.publishTime;
  }
  return newest;
}

function analyzeSignatureExperiences(raw: unknown): {
  readonly count: number;
  readonly withoutImage: number;
} {
  if (!Array.isArray(raw)) return { count: 0, withoutImage: 0 };
  let count = 0;
  let withoutImage = 0;
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (item['kind'] === 'kid_club') continue;
    count += 1;
    const img = item['image_public_id'];
    if (typeof img !== 'string' || img.trim().length === 0) withoutImage += 1;
  }
  return { count, withoutImage };
}

function pushCheck(
  checks: KitAcceptanceCheck[],
  id: string,
  passed: boolean,
  message: string,
): void {
  checks.push({ id, passed, message });
}

/** All kit acceptance checks for one hotel row + per-room audit rows. */
export function evaluateKitAcceptanceGates(
  input: KitAcceptanceInput,
  nowMs: number = Date.now(),
): readonly KitAcceptanceCheck[] {
  if (!isHotelKitSlug(input.slug)) return [];

  const checks: KitAcceptanceCheck[] = [];
  const pickSlug = readConciergePickSlug(input.concierge_pick);
  const dbRoomSlugs = input.rooms.map((r) => r.slug).filter((s) => s.length > 0);
  const renderOrder =
    input.orderedRoomSlugs !== undefined && input.orderedRoomSlugs.length > 0
      ? [...input.orderedRoomSlugs]
      : dbRoomSlugs;
  const imagesBySlug = roomImageCountBySlug(input.rooms);
  const visibleSlugs = visibleKitRoomSlugs(renderOrder);
  const kitLen = jsonLen(input.faq_content_kit);
  const gmbReviews = parseGmbReviews(input.google_reviews);
  const dupUrls = countDuplicateGallerySourceUrls(input.gallery_images);
  const dupPublicIds = countDuplicateGalleryPublicIds(input.gallery_images);
  const missingSourceUrls = countGalleryMissingSourceUrls(input.gallery_images);
  const heroPublicId =
    typeof input.hero_image === 'string' && input.hero_image.trim().length > 0
      ? input.hero_image.trim()
      : null;
  const heroAppearsInGallery =
    heroPublicId !== null && galleryPublicIds(input.gallery_images).includes(heroPublicId);
  const heroCategory =
    heroPublicId !== null ? galleryCategoryForPublicId(input.gallery_images, heroPublicId) : null;
  const galleryCats = galleryCategorySet(input.gallery_images);
  const galleryCount = jsonLen(input.gallery_images);
  const sigExp = analyzeSignatureExperiences(input.signature_experiences);
  const isReferencePilot = (KIT_REFERENCE_PILOT_SLUGS as readonly string[]).includes(input.slug);

  /* ── D15/D16 — #chambres + modules par slug ── */
  pushCheck(
    checks,
    'kit.02.chambres_pick_slug',
    pickSlug !== null && dbRoomSlugs.includes(pickSlug),
    pickSlug === null
      ? 'concierge_pick.slug missing on kit fiche'
      : `concierge_pick room "${pickSlug}" not found in hotel_rooms`,
  );

  pushCheck(
    checks,
    'kit.02.concierge_pick_note',
    hasConciergePickNote(input.concierge_pick),
    'concierge_pick.note.fr/en missing (Concierge card copy under badge)',
  );

  const pickFirst = visibleSlugs.length > 0 && pickSlug !== null && visibleSlugs[0] === pickSlug;
  pushCheck(
    checks,
    'kit.02.chambres_pick_first_visible',
    pickFirst,
    pickSlug === null
      ? 'cannot verify pick-first — concierge_pick.slug missing'
      : `concierge pick must be card #1 in #chambres (top ${KIT_VISIBLE_ROOM_COUNT}); got first="${visibleSlugs[0] ?? 'none'}" want="${pickSlug}"`,
  );

  const visibleWithoutPhoto = visibleSlugs.filter((s) => (imagesBySlug.get(s) ?? 0) < 1);
  pushCheck(
    checks,
    'kit.02.chambres_visible_have_photo',
    visibleSlugs.length >= 1 && visibleWithoutPhoto.length === 0,
    visibleWithoutPhoto.length === 0
      ? 'all visible room cards have ≥1 photo'
      : `${visibleWithoutPhoto.length}/${visibleSlugs.length} visible room card(s) without photo: ${visibleWithoutPhoto.join(', ')}`,
  );

  pushCheck(
    checks,
    'kit.02.chambres_pick_has_photo',
    pickSlug !== null && (imagesBySlug.get(pickSlug) ?? 0) >= 1,
    pickSlug === null
      ? 'concierge pick room photo missing — no pick slug'
      : `concierge pick "${pickSlug}" needs ≥1 room photo (DB images[] or kit room display map)`,
  );

  if (!isReferencePilot) {
    const roomBatch = repoFile(
      `scripts/editorial-pilot/src/photos/resource-${input.slug}-rooms.ts`,
    );
    pushCheck(
      checks,
      'kit.16.room_batch_script',
      existsSync(roomBatch),
      `missing scripts/editorial-pilot/src/photos/resource-${input.slug}-rooms.ts (D16)`,
    );
    const displayModule = repoFile(`apps/web/src/server/hotels/kit/kit-${input.slug}-display.ts`);
    const catalogModule = repoFile('apps/web/src/server/hotels/kit/kit-catalog-room-display.ts');
    pushCheck(
      checks,
      'kit.16.room_display_module',
      existsSync(displayModule) || existsSync(catalogModule),
      `missing kit-${input.slug}-display.ts or kit-catalog-room-display.ts (D16 — curated room images + ordering)`,
    );
  }

  /* ── D12/D14 — galerie & correspondance sujet ── */
  pushCheck(
    checks,
    'kit.02.gallery_count',
    galleryCount >= KIT_GALLERY_MIN,
    `${galleryCount} gallery_images (CDC kit target ≥ ${KIT_GALLERY_MIN})`,
  );

  pushCheck(
    checks,
    'kit.02.gallery_no_duplicate_source_url',
    dupUrls === 0,
    dupUrls === 0
      ? 'gallery source URLs are unique per slot'
      : `${dupUrls} gallery slot(s) reuse the same source url (D12 — distinct pixels per subject)`,
  );

  pushCheck(
    checks,
    'kit.02.gallery_source_url_tracked',
    galleryCount >= KIT_GALLERY_MIN && missingSourceUrls === 0,
    missingSourceUrls === 0
      ? 'every gallery slot carries source url (enables pixel-level dedup audit)'
      : `${missingSourceUrls}/${galleryCount} gallery slot(s) missing url/source_url — run gallery batch with GALLERY_SOURCES`,
  );

  pushCheck(
    checks,
    'kit.02.gallery_unique_public_id',
    dupPublicIds === 0,
    dupPublicIds === 0
      ? 'gallery public_id values are unique'
      : `${dupPublicIds} gallery slot(s) reuse the same Cloudinary public_id`,
  );

  pushCheck(
    checks,
    'kit.02.hero_not_in_gallery',
    heroPublicId !== null && !heroAppearsInGallery,
    heroPublicId === null
      ? 'hero_image missing'
      : heroAppearsInGallery
        ? `hero_image "${heroPublicId}" must not appear in gallery_images (mosaic duplicate on page)`
        : 'hero_image is separate from the 30 gallery slots',
  );

  pushCheck(
    checks,
    'kit.02.hero_category_exterior_or_view',
    heroPublicId !== null &&
      (!heroAppearsInGallery || heroCategory === 'exterior' || heroCategory === 'view'),
    heroPublicId === null
      ? 'hero_image missing'
      : heroAppearsInGallery && heroCategory !== 'exterior' && heroCategory !== 'view'
        ? `hero slot category="${heroCategory ?? 'unknown'}" — must be exterior or view (full property shot)`
        : 'hero must show the hotel overview (exterior or view)',
  );

  const altCategory = evaluateGalleryAltCategoryCorrespondence(input.gallery_images);
  pushCheck(
    checks,
    'kit.02.gallery_alt_category',
    altCategory.issues.length === 0,
    altCategory.issues.length === 0
      ? 'gallery category/alt_fr correspondence OK'
      : `${altCategory.issues.length} gallery photo(s) with category/alt_fr mismatch`,
  );

  for (const required of ['spa', 'dining'] as const) {
    pushCheck(
      checks,
      `kit.02.gallery_category_${required}`,
      galleryCats.has(required),
      `no gallery_images with category="${required}" (spa/restaurant blocks use gallery resolver)`,
    );
  }

  const missingCats = KIT_REQUIRED_GALLERY_CATEGORIES.filter((c) => !galleryCats.has(c));
  pushCheck(
    checks,
    'kit.02.gallery_required_categories',
    missingCats.length === 0,
    missingCats.length === 0
      ? 'all CDC photo categories represented'
      : `missing gallery categories: ${missingCats.join(', ')}`,
  );

  /* ── D12 — expériences signature (image dédiée, pas fallback galerie) ── */
  pushCheck(
    checks,
    'kit.03.signature_experiences_count',
    sigExp.count >= SIG_EXP_MIN_COUNT,
    `${sigExp.count} signature experiences (kit target ≥ ${SIG_EXP_MIN_COUNT})`,
  );

  pushCheck(
    checks,
    'kit.03.signature_experiences_dedicated_image',
    sigExp.count === 0 || sigExp.withoutImage === 0,
    sigExp.withoutImage === 0
      ? 'all signature experiences carry image_public_id'
      : `${sigExp.withoutImage}/${sigExp.count} experiences without image_public_id (wrong gallery fallback risk)`,
  );

  /* ── D9/D13 — POI ── */
  const poiStructural = evaluatePoiStructuralCorrespondence(input.points_of_interest);
  pushCheck(
    checks,
    'kit.07.poi_structural',
    poiStructural.total === 0 || poiStructural.ok === poiStructural.total,
    poiStructural.ok === poiStructural.total
      ? 'POI photo-subject structural contract OK'
      : `${poiStructural.total - poiStructural.ok}/${poiStructural.total} POIs fail dedicated poi-* contract`,
  );

  /* ── D17 — FAQ kit ── */
  pushCheck(
    checks,
    'kit.11.faq_kit_not_stub',
    !faqKitIsPromoteStub(input.faq_content_kit, input.faq_content),
    `${kitLen} faq_content_kit items — must be Perplexity kit (≥${FAQ_KIT_MIN_ITEMS}), not promote stub`,
  );

  pushCheck(
    checks,
    'kit.11.faq_kit_count',
    kitLen >= FAQ_KIT_MIN_ITEMS,
    `${kitLen} faq_content_kit items (Perplexity target ≥ ${FAQ_KIT_MIN_ITEMS})`,
  );

  const missingGroups = faqKitMissingGroups(input.faq_content_kit);
  pushCheck(
    checks,
    'kit.11.faq_kit_has_groups',
    kitLen < FAQ_KIT_MIN_ITEMS || missingGroups === 0,
    missingGroups === 0
      ? 'all kit FAQ items carry group_fr'
      : `${missingGroups} kit FAQ items missing group_fr (Perplexity taxonomy)`,
  );

  const faqEnrichment = evaluateFaqKitRowEnrichment({
    hotelName: input.name,
    faq_content_kit: input.faq_content_kit,
    faq_content: input.faq_content,
    concierge_questions: input.concierge_questions,
  });
  faqEnrichment.issues.forEach((issue, idx) => {
    if (issue.code.startsWith('kit.') || issue.code.startsWith('promote.')) {
      pushCheck(checks, `kit.11.${issue.code.replace(/\./gu, '_')}_${idx}`, false, issue.message);
    }
  });
  if (faqEnrichment.issues.length === 0 && kitLen >= FAQ_KIT_MIN_ITEMS) {
    pushCheck(checks, 'kit.11.faq_kit_enrichment', true, 'FAQ kit enrichment gates OK');
  }

  /* ── D10 — FAQ Concierge ── */
  const conciergeMandatory = evaluateKitConciergeMandatoryGates(input.concierge_questions);
  const conciergeLen = jsonLen(input.concierge_questions);
  pushCheck(
    checks,
    'kit.11.concierge_questions_count',
    conciergeLen >= CONCIERGE_QUESTIONS_MIN,
    `${conciergeLen} concierge_questions (target ≥ ${CONCIERGE_QUESTIONS_MIN})`,
  );
  conciergeMandatory.forEach((issue, idx) => {
    pushCheck(checks, `kit.11.${issue.code.replace(/\./gu, '_')}_${idx}`, false, issue.message);
  });
  if (conciergeMandatory.length === 0 && conciergeLen >= CONCIERGE_QUESTIONS_MIN) {
    pushCheck(checks, 'kit.11.concierge_mandatory', true, 'concierge_questions mandatory gates OK');
  }

  pushCheck(
    checks,
    'kit.11.faq_promote_count',
    jsonLen(input.faq_content) >= FAQ_PROMOTE_MIN_ITEMS,
    `${jsonLen(input.faq_content)} faq_content promote items (target ≥ ${FAQ_PROMOTE_MIN_ITEMS})`,
  );

  /* ── D8/D18 — GMB #acces ── */
  pushCheck(
    checks,
    'kit.10.gmb_review_count',
    gmbReviews.length >= GMB_MIN_DISPLAY_REVIEWS,
    `${gmbReviews.length} substantive GMB reviews cached (need ≥${GMB_MIN_DISPLAY_REVIEWS} for #acces)`,
  );

  const newest = newestPublishTime(gmbReviews);
  const recencyOk =
    newest !== null &&
    (daysSince(newest, nowMs) ?? Number.POSITIVE_INFINITY) <= GMB_RECENCY_MAX_DAYS;
  pushCheck(
    checks,
    'kit.10.gmb_review_recency',
    recencyOk,
    recencyOk
      ? `newest GMB review within ${GMB_RECENCY_MAX_DAYS} days`
      : `newest cached GMB review stale or undated — run reviews:sync`,
  );

  const syncAge =
    input.last_reviews_sync !== null ? daysSince(input.last_reviews_sync, nowMs) : null;
  const syncOk = syncAge !== null && syncAge <= GMB_SYNC_MAX_DAYS;
  pushCheck(
    checks,
    'kit.10.gmb_sync_fresh',
    syncOk,
    syncOk
      ? `last_reviews_sync within ${GMB_SYNC_MAX_DAYS} days`
      : 'last_reviews_sync missing or older than 30 days — run reviews:sync',
  );

  const sortedDisplay = [...gmbReviews].sort(compareGoogleReviewsByRecency).slice(0, 3);
  const displayTripletFresh =
    sortedDisplay.length >= GMB_MIN_DISPLAY_REVIEWS &&
    sortedDisplay.every(
      (r) =>
        r.publishTime !== null &&
        (daysSince(r.publishTime, nowMs) ?? Number.POSITIVE_INFINITY) <= GMB_RECENCY_MAX_DAYS,
    );
  pushCheck(
    checks,
    'kit.10.gmb_display_triplet_fresh',
    displayTripletFresh,
    displayTripletFresh
      ? 'top 3 GMB reviews shown in #acces are all dated within 90 days'
      : 'top 3 displayable GMB reviews are not all recent (PO: « avis les plus récents »)',
  );

  const allPassed = checks.every((c) => c.passed);
  pushCheck(
    checks,
    'kit.19.closure_audit_exit_zero',
    allPassed,
    allPassed
      ? 'all kit PO gates pass — still require Rule 6 browser walk before « livré »'
      : 'one or more kit.* gates failed — audit must exit 1',
  );

  return checks;
}

/** True when any kit acceptance check failed (used to fail audit CLI exit code). */
export function hasKitAcceptanceFailures(
  slug: string,
  checks: readonly { readonly id: string; readonly passed: boolean }[],
): boolean {
  if (!isHotelKitSlug(slug)) return false;
  return checks.some(
    (c) => c.id.startsWith('kit.') && c.id !== 'kit.19.closure_audit_exit_zero' && !c.passed,
  );
}
