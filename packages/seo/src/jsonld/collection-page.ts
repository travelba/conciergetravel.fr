import type { CollectionPage, ItemList } from 'schema-dts';

import type { ItemListInput } from './item-list';
import { itemListJsonLd } from './item-list';

export type CollectionPageNode = Exclude<CollectionPage, string>;

export interface CollectionPageJsonLdInput {
  readonly name: string;
  readonly url: string;
  readonly description?: string;
  /** ISO 8601 — recommended for editorial collections refreshed on a schedule. */
  readonly dateModified?: string;
  /** Optional embedded ItemList (use this for paginated/filterable hubs). */
  readonly itemList?: ItemListInput;
  /**
   * BCP-47 language tag (e.g. `fr-FR`, `en`, `de`, `es-ES`). Kept as a
   * widened `string` so V2 locales (DE/ES/IT) work without a schema
   * bump — Schema.org `inLanguage` accepts any BCP-47 tag. See
   * `apps/web/src/i18n/runtime.ts#hreflangKey` for the canonical tag
   * per app locale.
   */
  readonly inLanguage?: string;
}

/**
 * `CollectionPage` JSON-LD — used for any hub page that lists a
 * collection of editorial items (rankings hub, guides hub, sub-hubs).
 *
 * The optional `itemList` is embedded directly into `mainEntity` so
 * Google sees a single coherent graph (instead of two separate top-
 * level scripts that may not be reconciled).
 */
export const collectionPageJsonLd = (input: CollectionPageJsonLdInput): CollectionPageNode => {
  const node: CollectionPageNode = {
    '@type': 'CollectionPage',
    name: input.name,
    url: input.url,
    inLanguage: input.inLanguage ?? 'fr-FR',
  };
  if (input.description !== undefined) {
    node.description = input.description;
  }
  if (input.dateModified !== undefined) {
    node.dateModified = input.dateModified;
  }
  if (input.itemList !== undefined) {
    node.mainEntity = itemListJsonLd(input.itemList) satisfies ItemList;
  }
  return node;
};
