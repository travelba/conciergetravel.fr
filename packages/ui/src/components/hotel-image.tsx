/**
 * HotelImage — `next/image` wrapper specialised for MyConciergeHotel hotel media.
 *
 * Skill: performance-engineering, responsive-ui-architecture.
 *
 * - Accepts either a Cloudinary `publicId` (preferred — eligible to
 *   `f_auto,q_auto,c_fill,g_auto` transformations) or a raw `src` (used as
 *   a fallback for legacy media).
 * - Defaults are tuned for hotel hero and card placements:
 *     - `sizes` is responsive-aware (`(max-width: 768px) 100vw, 50vw`).
 *     - LCP candidates pass `priority` to opt in to high-fetch-priority.
 *     - All other instances are `loading="lazy"` and `decoding="async"`.
 * - The `cloudName` is **passed in by the consumer**, not read from `env`,
 *   so `@mch/ui` stays env-free and the build doesn't need Cloudinary
 *   credentials to render Storybook / tests.
 *
 * Usage:
 *   ```tsx
 *   <HotelImage
 *     cloudName="myconciergehotel"
 *     publicId="hotels/ritz-paris/hero"
 *     alt="Façade de l'hôtel Ritz Paris"
 *     width={1600}
 *     height={900}
 *     priority
 *   />
 *   ```
 */
import NextImage, { type ImageProps as NextImageProps } from 'next/image';
import * as React from 'react';

import { SIGNATURE_TRANSFORM } from '../cloudinary-presets';
import { cn } from '../lib/cn';

const CLOUDINARY_BASE = 'https://res.cloudinary.com';

// Locked 2026-05-31 by ADR-0024. Edit `cloudinary-presets.ts`, never here.
const DEFAULT_TRANSFORMS = SIGNATURE_TRANSFORM;

export type HotelImageVariant = 'hero' | 'card' | 'thumbnail';

interface HotelImageBaseProps {
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly variant?: HotelImageVariant;
  readonly priority?: boolean;
  readonly className?: string;
  readonly sizes?: string;
  readonly transforms?: string;
}

interface HotelImagePublicIdProps extends HotelImageBaseProps {
  readonly cloudName: string;
  readonly publicId: string;
  readonly src?: never;
}

interface HotelImageRawSrcProps extends HotelImageBaseProps {
  readonly src: string;
  readonly cloudName?: never;
  readonly publicId?: never;
}

export type HotelImageProps = HotelImagePublicIdProps | HotelImageRawSrcProps;

const DEFAULT_SIZES: Record<HotelImageVariant, string> = {
  hero: '(max-width: 768px) 100vw, 75vw',
  card: '(max-width: 768px) 100vw, 33vw',
  thumbnail: '96px',
};

/**
 * Build the Cloudinary delivery URL. Exposed for unit testing.
 *
 * @example
 *   buildCloudinarySrc({
 *     cloudName: 'myconciergehotel',
 *     publicId: 'hotels/ritz-paris/hero',
 *   })
 *   // → https://res.cloudinary.com/myconciergehotel/image/upload/f_auto,q_auto,c_fill,g_auto/hotels/ritz-paris/hero
 */
/**
 * Returns true when the input looks like a fully-qualified HTTP(S) URL.
 * Used by `<HotelImage>` to detect legacy `hotels.hero_image` rows that
 * still point at external sources instead of a Cloudinary public_id.
 * Exposed for unit testing.
 */
export function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function buildCloudinarySrc(input: {
  readonly cloudName: string;
  readonly publicId: string;
  readonly transforms?: string;
}): string {
  const transforms = input.transforms ?? DEFAULT_TRANSFORMS;
  const cloudName = encodeURIComponent(input.cloudName);
  // The public ID may contain slashes (e.g. `hotels/ritz-paris/hero`) —
  // these are path segments in the Cloudinary URL and must be preserved.
  const publicIdSafe = input.publicId.split('/').map(encodeURIComponent).join('/');
  return `${CLOUDINARY_BASE}/${cloudName}/image/upload/${transforms}/${publicIdSafe}`;
}

/**
 * Build a Cloudinary `image/fetch` URL — proxies a remote image through
 * Cloudinary's CDN with the same transforms. Used as a bridge for
 * legacy `hotels.hero_image` rows that still hold an external URL
 * (Wikimedia, Tripadvisor, hotel-site CDN) instead of a Cloudinary
 * public_id. This keeps the image rendering through `res.cloudinary.com`
 * (the only remote host allowlisted in `next.config.ts.images
 * .remotePatterns`) while we run Phase 4 of the photo migration
 * (AGENTS.md §4 — sourcing + Cloudinary upload + alt enrichment).
 *
 * Exposed for unit testing.
 *
 * @example
 *   buildCloudinaryFetchSrc({
 *     cloudName: 'dvbjwh5wy',
 *     remoteUrl: 'https://commons.wikimedia.org/foo.jpg',
 *   })
 *   // → https://res.cloudinary.com/dvbjwh5wy/image/fetch/<transforms>/
 *   //   https%3A%2F%2Fcommons.wikimedia.org%2Ffoo.jpg
 */
export function buildCloudinaryFetchSrc(input: {
  readonly cloudName: string;
  readonly remoteUrl: string;
  readonly transforms?: string;
}): string {
  const transforms = input.transforms ?? DEFAULT_TRANSFORMS;
  const cloudName = encodeURIComponent(input.cloudName);
  const encoded = encodeURIComponent(input.remoteUrl);
  return `${CLOUDINARY_BASE}/${cloudName}/image/fetch/${transforms}/${encoded}`;
}

export const HotelImage = React.forwardRef<HTMLImageElement, HotelImageProps>(
  (props, ref): React.ReactElement => {
    const {
      alt,
      width,
      height,
      variant = 'card',
      priority = false,
      className,
      sizes,
      transforms,
    } = props;

    // Resolve the final `src`:
    //   - Caller passed `src` explicitly → use as-is.
    //   - Caller passed `publicId` that looks like a fully-qualified URL
    //     (legacy `hotels.hero_image` data state where the photo pipeline
    //     hasn't migrated the row to Cloudinary yet — see AGENTS.md §4
    //     Phase 4) → proxy it through Cloudinary's `image/fetch` mode so
    //     the image still renders through `res.cloudinary.com` (the only
    //     external host allowlisted in `next.config.ts.images
    //     .remotePatterns`) instead of producing the broken
    //     `cloudinary.com/<cloud>/image/upload/.../https%3A%2F%2F...` URL
    //     that gives `next/image` no allowed host to call.
    //   - Otherwise → build the Cloudinary delivery URL.
    const src =
      'src' in props && props.src !== undefined
        ? props.src
        : isHttpUrl(props.publicId)
          ? buildCloudinaryFetchSrc({
              cloudName: props.cloudName,
              remoteUrl: props.publicId,
              ...(transforms !== undefined ? { transforms } : {}),
            })
          : buildCloudinarySrc({
              cloudName: props.cloudName,
              publicId: props.publicId,
              ...(transforms !== undefined ? { transforms } : {}),
            });

    const finalSizes = sizes ?? DEFAULT_SIZES[variant];

    // Cast through `unknown` is forbidden by lint rules, so we relax the
    // prop spread by listing the exact props we care about. `next/image`
    // accepts both `src: string` and `priority: boolean` directly.
    const nextProps: NextImageProps = {
      src,
      alt,
      width,
      height,
      priority,
      sizes: finalSizes,
      loading: priority ? 'eager' : 'lazy',
      decoding: 'async',
      className: cn('object-cover', className),
    };

    return <NextImage ref={ref} {...nextProps} />;
  },
);

HotelImage.displayName = 'HotelImage';
