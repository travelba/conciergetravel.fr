import type { ReactElement } from 'react';

interface JsonLdScriptProps {
  readonly data: unknown;
}

/** SSR JSON-LD script — inert data, no CSP nonce required (ADR-0031). */
export function JsonLdScript({ data }: JsonLdScriptProps): ReactElement {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export type SeoJsonLdNode = object;

interface SeoJsonLdProps {
  readonly nodes: SeoJsonLdNode | ReadonlyArray<SeoJsonLdNode | null | undefined>;
}

export function SeoJsonLd({ nodes }: SeoJsonLdProps): ReactElement {
  const list = (Array.isArray(nodes) ? nodes : [nodes]).filter(
    (node): node is SeoJsonLdNode => node !== null && node !== undefined,
  );
  return (
    <>
      {list.map((data, index) => (
        <JsonLdScript key={index} data={data} />
      ))}
    </>
  );
}
