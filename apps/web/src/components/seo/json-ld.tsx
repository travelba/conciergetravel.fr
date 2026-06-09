import type { ReactElement } from 'react';

/**
 * Server Component that emits a `<script type="application/ld+json">` tag.
 *
 * # No CSP nonce on JSON-LD (corrected 2026-06-09)
 *
 * A `type="application/ld+json"` block is a *data island*, not executable
 * JavaScript: the browser never runs it, so the CSP `script-src` directive
 * does not apply and **no nonce is required** (CSP only gates scripts that
 * would execute). Stamping the per-request nonce onto these tags was both
 * unnecessary AND harmful: React strips `nonce` from the client hydration
 * payload for security, so server HTML shipped `nonce="…"` while the client
 * tree saw `nonce=""` → a hydration mismatch that forced React to re-render
 * the surrounding subtree on the client (surfacing as a misleading
 * `useTranslations` "NextIntlClientProvider not found" error in the first
 * client island it hit).
 *
 * The `nonce` prop is kept in the interface (callers still pass it without
 * change) but intentionally NOT applied to the tag — removing the attribute
 * from both server and client output eliminates the mismatch at the source.
 * Executable inline scripts (Next.js runtime, analytics) carry their nonce
 * through their own mechanisms and are unaffected.
 *
 * Skill: structured-data-schema-org §JSON-LD + security-engineering §CSP.
 */
interface JsonLdScriptProps {
  readonly data: unknown;
  /**
   * Accepted for backward compatibility with callers that still forward the
   * per-request `x-nonce` value, but intentionally ignored — JSON-LD is a
   * non-executable data block and needs no CSP nonce (see component doc).
   *
   * @deprecated JSON-LD scripts do not require a nonce; the prop is a no-op.
   */
  readonly nonce?: string | undefined;
}

export function JsonLdScript({ data }: JsonLdScriptProps): ReactElement {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/** A single Schema.org node — the typed objects returned by the `@mch/seo` builders. */
export type SeoJsonLdNode = object;

interface SeoJsonLdProps {
  /**
   * One node, or an array of nodes. `null` / `undefined` entries are skipped,
   * so callers can pass conditional blocks inline (e.g. an optional video
   * node) without pre-filtering:
   *
   * ```tsx
   * <SeoJsonLd nonce={nonce} nodes={[hotelJsonLd, faqJsonLd, videoJsonLd, ...eventNodes]} />
   * ```
   */
  readonly nodes: SeoJsonLdNode | ReadonlyArray<SeoJsonLdNode | null | undefined>;
  /** Per-request CSP nonce, read once at the page boundary (see {@link JsonLdScript}). */
  readonly nonce: string | undefined;
}

/**
 * Dedicated, SSR-only component that emits every JSON-LD block of a page
 * through a single, strongly-typed entry point. It renders one
 * `<script type="application/ld+json">` per node (each self-contained with its
 * own `@context`), forwarding the CSP nonce so the markup ships in the initial
 * server HTML — present from the very first crawl/index.
 *
 * Common root nodes (Organization, WebSite) are factored into
 * `components/seo/site-json-ld.tsx` + `lib/jsonld/brand-organization.ts`;
 * page-specific nodes (Hotel/LocalBusiness, Event, FAQPage, ItemList, …) are
 * passed in by the page that owns them.
 */
export function SeoJsonLd({ nodes, nonce }: SeoJsonLdProps): ReactElement {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(
    (node): node is SeoJsonLdNode => node !== null && node !== undefined,
  );
  return (
    <>
      {list.map((data, index) => (
        <JsonLdScript key={index} data={data} nonce={nonce} />
      ))}
    </>
  );
}
