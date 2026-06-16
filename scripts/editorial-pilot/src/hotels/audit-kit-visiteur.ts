/**
 * Rendered HTML visitor audit — cross-block photo reuse, room label drift,
 * missing experience grid, generic dining placeholders (D18 / Rule 6).
 *
 * CLI:
 *   pnpm --filter @mch/editorial-pilot audit:kit-visiteur -- --slug=shangri-la-paris
 *   pnpm --filter @mch/editorial-pilot audit:kit-visiteur -- --wave5
 */

import { isKitWaveSlug, KIT_WAVE_SLUGS } from '@mch/domain/editorial';

/** Kit slugs audited via live HTML visitor pass (wave 5 + Prince de Galles). */
const KIT_VISITEUR_SLUGS = [...KIT_WAVE_SLUGS, 'prince-de-galles-paris'] as const;

function isKitVisiteurSlug(slug: string): boolean {
  return (KIT_VISITEUR_SLUGS as readonly string[]).includes(slug);
}

const MIN_EXP_CARDS = 4;
const MAX_DINING_PLACEHOLDERS = 0;
const MAX_CROSS_BLOCK_DUPES = 0;
const MAX_ROOM_LABEL_MISMATCHES = 0;

export interface KitVisiteurCard {
  readonly label: string;
  readonly publicId: string;
  readonly alt: string;
}

export interface KitVisiteurAuditReport {
  readonly slug: string;
  readonly roomCards: readonly KitVisiteurCard[];
  readonly experiences: readonly KitVisiteurCard[];
  readonly restaurants: readonly KitVisiteurCard[];
  readonly spaPublicId: string | null;
  readonly placeholderCount: number;
  readonly issues: readonly string[];
  readonly passed: boolean;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractPublicIdFromSrc(slug: string, src: string): string {
  const hotelMatch = src.match(
    new RegExp(`/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^/?"]+)`),
  );
  if (hotelMatch?.[1] !== undefined) return hotelMatch[1];
  const placeholderMatch = src.match(/\/kit\/img\/([^"?]+)/);
  if (placeholderMatch?.[1] !== undefined) return `PLACEHOLDER:${placeholderMatch[1]}`;
  return 'OTHER';
}

function matchCardsForSlug(
  html: string,
  slug: string,
  articleClass: string,
  headingTag: 'h3' | 'h4',
): KitVisiteurCard[] {
  const articlePattern = new RegExp(
    `<article class="${articleClass}[^"]*"[^>]*>([\\s\\S]*?)</article>`,
    'g',
  );
  const cards: KitVisiteurCard[] = [];
  for (const articleMatch of html.matchAll(articlePattern)) {
    const articleStart = articleMatch.index ?? 0;
    const inner = articleMatch[1];
    if (inner === undefined) continue;

    const prefix = html.slice(Math.max(0, articleStart - 800), articleStart);
    if (
      /id="spa-justified-carousel"/u.test(prefix) ||
      /id="kid-club-justified-carousel"/u.test(prefix)
    ) {
      continue;
    }

    const imgMatch = inner.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"/u);
    const headingMatch = inner.match(new RegExp(`<${headingTag}>([^<]+)</${headingTag}>`, 'u'));
    if (
      imgMatch?.[1] === undefined ||
      imgMatch[2] === undefined ||
      headingMatch?.[1] === undefined
    ) {
      continue;
    }
    cards.push({
      label: headingMatch[1].trim(),
      alt: decodeHtmlEntities(imgMatch[2]),
      publicId: extractPublicIdFromSrc(slug, imgMatch[1]),
    });
  }
  return cards;
}

function detectRoomLabelMismatches(cards: readonly KitVisiteurCard[]): string[] {
  const issues: string[] = [];
  for (const card of cards) {
    const name = card.label.toLowerCase();
    const alt = card.alt.toLowerCase();
    const parts: string[] = [];
    if (name.includes('superior') && (alt.includes('deluxe') || alt.includes('suite'))) {
      parts.push('Superior card but alt mentions Deluxe/Suite');
    }
    if (
      name.includes('deluxe') &&
      !name.includes('suite') &&
      (alt.includes('suite') || alt.includes('superior'))
    ) {
      parts.push('Deluxe card but alt mentions Suite/Superior');
    }
    if (name.includes('suite') && alt.includes('deluxe') && !alt.includes('suite')) {
      parts.push('Suite card but alt mentions Deluxe room');
    }
    if (card.publicId.startsWith('PLACEHOLDER:') || card.publicId === 'OTHER') {
      parts.push('no dedicated hotel photo');
    }
    if (parts.length > 0) {
      issues.push(`room "${card.label}" (${card.publicId}): ${parts.join('; ')}`);
    }
  }
  return issues;
}

function duplicatePubIds(cards: readonly KitVisiteurCard[]): string[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (card.publicId.startsWith('PLACEHOLDER:') || card.publicId === 'OTHER') continue;
    counts.set(card.publicId, (counts.get(card.publicId) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
}

function crossBlockDupes(
  rooms: readonly KitVisiteurCard[],
  exps: readonly KitVisiteurCard[],
  restos: readonly KitVisiteurCard[],
  instagram: readonly KitVisiteurCard[],
  spaPublicId: string | null,
): string[] {
  const usage = new Map<string, string[]>();
  const track = (publicId: string, tag: string): void => {
    if (publicId.startsWith('PLACEHOLDER:') || publicId === 'OTHER') return;
    usage.set(publicId, [...(usage.get(publicId) ?? []), tag]);
  };
  for (const r of rooms) track(r.publicId, `room:${r.label}`);
  for (const e of exps) track(e.publicId, `exp:${e.label}`);
  for (const r of restos) track(r.publicId, `resto:${r.label}`);
  for (const i of instagram) track(i.publicId, `instagram:${i.label}`);
  if (spaPublicId !== null) track(spaPublicId, 'spa:block');

  return [...usage.entries()]
    .filter(([, tags]) => tags.length > 1)
    .map(([id, tags]) => `${id} → ${tags.join(', ')}`);
}

function matchInstagramCards(html: string, slug: string): KitVisiteurCard[] {
  const pattern = new RegExp(`<section aria-labelledby="instagram-title"[\\s\\S]*?</section>`, 'i');
  const section = html.match(pattern)?.[0];
  if (section === undefined) return [];

  const imgPattern = new RegExp(`<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"`, 'g');
  const cards: KitVisiteurCard[] = [];
  let index = 0;
  for (const match of section.matchAll(imgPattern)) {
    const src = match[1];
    const alt = match[2];
    if (src === undefined || alt === undefined) continue;
    index += 1;
    cards.push({
      label: `instagram-${index}`,
      alt: decodeHtmlEntities(alt),
      publicId: extractPublicIdFromSrc(slug, src),
    });
  }
  return cards;
}

function extractSpaPublicId(html: string, slug: string): string | null {
  const spaSection = html.match(
    /<h3>Spa\s*(?:&amp;|&)\s*bien-être<\/h3>[\s\S]*?(?=<h[23]|$)/iu,
  )?.[0];
  if (spaSection === undefined) return null;
  const imgMatch = spaSection.match(/<img[^>]+src="([^"]+)"/iu);
  if (imgMatch?.[1] === undefined) return null;
  return extractPublicIdFromSrc(slug, imgMatch[1]);
}

/** Parse live `/hotel/{slug}` HTML (FR) into a visitor audit report. */
export function auditKitVisiteurHtml(html: string, slug: string): KitVisiteurAuditReport {
  const roomCards = matchCardsForSlug(html, slug, 'room-v2', 'h3');
  const experiences = matchCardsForSlug(html, slug, 'exp-justified-slide', 'h4');
  const restaurants = matchCardsForSlug(html, slug, 'resto-card', 'h4');
  const instagram = matchInstagramCards(html, slug);
  const spaPublicId = extractSpaPublicId(html, slug);

  const placeholderCount = (html.match(/\/kit\/img\/[^"']+\.(jpg|png|webp)/g) ?? []).length;

  const issues: string[] = [];

  if (experiences.length < MIN_EXP_CARDS) {
    issues.push(
      `${experiences.length} exp-card(s) rendered (need ≥${MIN_EXP_CARDS} — check signature_experiences Zod / deploy)`,
    );
  }

  const expDupes = duplicatePubIds(experiences);
  if (expDupes.length > 0) {
    issues.push(`duplicate experience photos: ${expDupes.join(', ')}`);
  }

  const restoDupes = duplicatePubIds(restaurants);
  if (restoDupes.length > 0) {
    issues.push(`duplicate restaurant photos: ${restoDupes.join(', ')}`);
  }

  const restoPlaceholders = restaurants.filter((r) => r.publicId.startsWith('PLACEHOLDER:')).length;
  if (restoPlaceholders > MAX_DINING_PLACEHOLDERS) {
    issues.push(`${restoPlaceholders} restaurant card(s) use generic htl_resto.jpg placeholder`);
  }

  const cross = crossBlockDupes(roomCards, experiences, restaurants, instagram, spaPublicId);
  if (cross.length > MAX_CROSS_BLOCK_DUPES) {
    issues.push(
      `cross-block photo reuse: ${cross.slice(0, 5).join(' | ')}${cross.length > 5 ? ' …' : ''}`,
    );
  }

  const roomIssues = detectRoomLabelMismatches(roomCards);
  if (roomIssues.length > MAX_ROOM_LABEL_MISMATCHES) {
    issues.push(...roomIssues.slice(0, 5));
    if (roomIssues.length > 5) issues.push(`… +${roomIssues.length - 5} room label mismatch(es)`);
  }

  return {
    slug,
    roomCards,
    experiences,
    restaurants,
    spaPublicId,
    placeholderCount,
    issues,
    passed: issues.length === 0,
  };
}

export function resolveKitVisiteurBaseUrl(): string {
  const fromEnv = process.env['KIT_VISITEUR_BASE_URL'] ?? process.env['NEXT_PUBLIC_SITE_URL'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    const trimmed = fromEnv.replace(/\/+$/u, '');
    // Local dev .env often sets localhost — kit HTML audit must hit prod/preview.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/iu.test(trimmed)) {
      return 'https://myconciergehotel.com';
    }
    return trimmed;
  }
  return 'https://myconciergehotel.com';
}

export async function fetchKitVisiteurHtml(slug: string, baseUrl?: string): Promise<string | null> {
  const base = (baseUrl ?? resolveKitVisiteurBaseUrl()).replace(/\/+$/u, '');
  const url = `${base}/hotel/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'mch-kit-visiteur-audit/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function prefetchKitVisiteurHtmlForSlugs(
  slugs: readonly string[],
): Promise<Map<string, string>> {
  if (process.env['MCH_SKIP_KIT_VISITEUR_AUDIT'] === '1') return new Map();

  const targets = slugs.filter((s) => isKitVisiteurSlug(s));
  const base = resolveKitVisiteurBaseUrl();
  const entries = await Promise.all(
    targets.map(async (slug) => {
      const html = await fetchKitVisiteurHtml(slug, base);
      return html !== null ? ([slug, html] as const) : null;
    }),
  );
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry !== null) map.set(entry[0], entry[1]);
  }
  return map;
}

export function formatKitVisiteurGateMessage(report: KitVisiteurAuditReport): string {
  if (report.passed) {
    return `visitor audit OK — ${report.experiences.length} exp, ${report.restaurants.length} resto, ${report.roomCards.length} room cards, ${report.placeholderCount} generic placeholders`;
  }
  return report.issues.join(' · ');
}

export async function runKitVisiteurCli(argv: readonly string[]): Promise<number> {
  const wave5 = argv.includes('--wave5');
  const dryRun = argv.includes('--dry-run');
  const slugArg = argv.find((a) => a.startsWith('--slug='));
  const slugs =
    wave5 || slugArg === undefined
      ? [...KIT_WAVE_SLUGS]
      : slugArg
          .slice('--slug='.length)
          .split(',')
          .map((s) => s.trim());

  let exitCode = 0;
  for (const slug of slugs) {
    if (!isKitVisiteurSlug(slug)) {
      console.warn(`[audit:kit-visiteur] skip non-kit slug ${slug}`);
      continue;
    }
    const html = await fetchKitVisiteurHtml(slug);
    if (html === null) {
      console.error(`[audit:kit-visiteur] ✗ ${slug} — failed to fetch HTML`);
      exitCode = 1;
      continue;
    }
    const report = auditKitVisiteurHtml(html, slug);
    if (report.passed) {
      console.log(`[audit:kit-visiteur] ✓ ${slug} — ${formatKitVisiteurGateMessage(report)}`);
    } else {
      console.error(`[audit:kit-visiteur] ✗ ${slug}`);
      for (const issue of report.issues) console.error(`    · ${issue}`);
      if (!dryRun) exitCode = 1;
    }
  }
  return exitCode;
}

async function main(): Promise<void> {
  const code = await runKitVisiteurCli(process.argv.slice(2));
  process.exit(code);
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('audit-kit-visiteur.ts') ||
    process.argv[1].endsWith('audit-kit-visiteur.js'));

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
