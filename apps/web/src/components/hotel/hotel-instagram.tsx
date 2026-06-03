import { getTranslations } from 'next-intl/server';
import { HotelImage } from '@mch/ui';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedInstagramFeed } from '@/server/hotels/get-hotel-by-slug';

interface HotelInstagramProps {
  readonly locale: SupportedLocale;
  readonly cloudName: string;
  readonly feed: LocalisedInstagramFeed | null;
}

// Square thumbnail — Cloudinary fills + auto-gravity so faces / focal points
// survive the crop. Images are our Cloudinary assets (photo-quality rule:
// never hotlink scontent.cdninstagram.com).
const THUMB_TRANSFORMS = 'f_auto,q_auto,c_fill,g_auto,w_640,h_640';

/**
 * Instagram social strip — surfaces the hotel's most recent posts as a
 * 3-up grid that deep-links to each post, plus a "follow" CTA to the
 * profile. CDC §2 social-proof surface.
 *
 * Compliance contract
 * -------------------
 * - **No third-party script** — pure server-rendered links + `<HotelImage>`.
 *   The official IG embed.js would require a CSP `script-src` change; this
 *   block deliberately avoids it (perf + privacy, see `security-csp.mdc`).
 * - **Images live on our Cloudinary** (`photo-quality.mdc`) — `imagePublicId`
 *   is a mirrored asset, never a `scontent.cdninstagram.com` hotlink. Posts
 *   without a mirrored image fall back to a sober text card.
 * - Outbound links carry `rel="nofollow noopener noreferrer"` (we don't
 *   vouch for the live IG destination).
 *
 * Data source: `readInstagram` (`hotels.instagram` jsonb). Today the feed is
 * hydrated by the golden-template override; production wires a Graph-API →
 * Cloudinary sync that refreshes the latest 3 posts. Self-elides when there
 * is no feed.
 */
export async function HotelInstagram({
  locale,
  cloudName,
  feed,
}: HotelInstagramProps): Promise<React.ReactElement | null> {
  if (feed === null || feed.posts.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const followersLabel =
    feed.followers !== null
      ? t('instagram.followers', {
          count: new Intl.NumberFormat(locale, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(feed.followers),
        })
      : null;

  return (
    <section aria-labelledby="instagram-title" className="mb-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="instagram-title" className="text-fg flex items-center gap-2 font-serif text-2xl">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" className="shrink-0">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              d="M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5Z"
            />
            <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
          </svg>
          {t('sections.instagram')}
        </h2>
        <a
          href={feed.profileUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-muted hover:text-fg text-sm"
        >
          @{feed.handle}
          {followersLabel !== null ? <span className="ml-1.5">· {followersLabel}</span> : null}
        </a>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {feed.posts.slice(0, 3).map((post) => (
          <li key={post.permalink}>
            <a
              href={post.permalink}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="focus-visible:ring-ring group block focus-visible:outline-none focus-visible:ring-2"
              aria-label={post.caption ?? t('instagram.viewPost')}
            >
              <div className="bg-muted/10 relative aspect-square w-full overflow-hidden rounded-lg">
                {post.imagePublicId !== null ? (
                  <HotelImage
                    cloudName={cloudName}
                    publicId={post.imagePublicId}
                    alt={post.caption ?? t('instagram.viewPost')}
                    width={640}
                    height={640}
                    transforms={THUMB_TRANSFORMS}
                    sizes="(max-width: 640px) 33vw, 220px"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="text-muted flex h-full w-full items-center justify-center p-3 text-center text-xs">
                    {post.caption ?? t('instagram.viewPost')}
                  </span>
                )}
              </div>
              {post.caption !== null ? (
                <p className="text-muted mt-1.5 line-clamp-2 text-xs leading-snug">
                  {post.caption}
                </p>
              ) : null}
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <a
          href={feed.profileUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="border-border text-fg hover:bg-bg inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium"
        >
          {t('instagram.viewProfile')}
        </a>
      </div>
    </section>
  );
}
