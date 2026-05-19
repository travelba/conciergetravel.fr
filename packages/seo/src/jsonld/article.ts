import type { Article } from 'schema-dts';

export type ArticleNode = Exclude<Article, string>;

export interface ArticleAuthorInput {
  readonly name: string;
  readonly url?: string;
}

export interface ArticleJsonLdInput {
  readonly headline: string;
  readonly url: string;
  readonly description?: string;
  readonly image?: readonly string[];
  /** ISO 8601 timestamp. */
  readonly datePublished: string;
  /** ISO 8601 timestamp; defaults to `datePublished` when omitted. */
  readonly dateModified?: string;
  readonly author: ArticleAuthorInput;
  readonly publisher?: { readonly name: string; readonly logoUrl?: string };
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
 * Article JSON-LD for guides + selections (skill: structured-data-schema-org).
 */
export const articleJsonLd = (input: ArticleJsonLdInput): ArticleNode => {
  const article: ArticleNode = {
    '@type': 'Article',
    headline: input.headline,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      '@type': 'Person',
      name: input.author.name,
      ...(input.author.url !== undefined ? { url: input.author.url } : {}),
    },
    inLanguage: input.inLanguage ?? 'fr-FR',
  };

  if (input.description !== undefined) {
    article.description = input.description;
  }
  if (input.image !== undefined && input.image.length > 0) {
    article.image = [...input.image];
  }
  if (input.publisher !== undefined) {
    article.publisher = {
      '@type': 'Organization',
      name: input.publisher.name,
      ...(input.publisher.logoUrl !== undefined
        ? { logo: { '@type': 'ImageObject', url: input.publisher.logoUrl } }
        : {}),
    };
  }

  return article;
};
