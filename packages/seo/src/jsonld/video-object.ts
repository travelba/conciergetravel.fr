/**
 * `VideoObject` JSON-LD (Schema.org `VideoObject`).
 *
 * Surface contract — what Google's video rich-result test enforces
 * (https://developers.google.com/search/docs/appearance/structured-data/video):
 *   - `name` (required)
 *   - `description` (required)
 *   - `thumbnailUrl` (required) — single URL or array
 *   - `uploadDate` (required) — ISO 8601
 *   - `contentUrl` OR `embedUrl` (at least one required for indexing)
 *
 * We accept the legacy CDC §2 bloc 2 inputs (`hero_video` Payload
 * field) and emit a strict VideoObject that the rich-result test
 * accepts on first try. No fabrication: if a required field is
 * missing the builder returns `null` and the caller skips the
 * `<JsonLdScript>` emission rather than ship a malformed envelope.
 *
 * Skill: structured-data-schema-org, geo-llm-optimization.
 */

export interface VideoObjectInput {
  readonly name: string;
  readonly description: string;
  readonly thumbnailUrl: string | readonly string[];
  /** ISO 8601 — `YYYY-MM-DD` or full DateTime accepted by Google. */
  readonly uploadDate: string;
  /**
   * Public MP4 (or HLS playlist) URL. Recommended over embed-only.
   *
   * Type-shape note: optional fields explicitly include `undefined` so
   * Zod-parsed payloads (where missing optional properties surface as
   * `undefined`) interoperate without spreading-with-conditionals at
   * every call site. The builder treats `undefined` as "absent" for
   * the purpose of the contentUrl-or-embedUrl requirement.
   */
  readonly contentUrl?: string | undefined;
  /** Embed URL (Cloudinary player, Vimeo, YouTube). */
  readonly embedUrl?: string | undefined;
  /** ISO 8601 duration, e.g. `PT45S` or `PT2M30S`. */
  readonly duration?: string | undefined;
  /** Width / height in pixels — surface the aspect ratio to LLMs. */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  /** Free-form caption text — Google's video transcript surrogate when no `transcript` field exists. */
  readonly caption?: string | undefined;
}

export type VideoObjectNode = {
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl: string | readonly string[];
  uploadDate: string;
  contentUrl?: string;
  embedUrl?: string;
  duration?: string;
  width?: number;
  height?: number;
  caption?: string;
};

function isValidHttpsUrl(value: string): boolean {
  return /^https:\/\/[^\s<>]+$/iu.test(value);
}

function isIsoDate(value: string): boolean {
  // Accept bare `YYYY-MM-DD` or full ISO 8601 DateTime.
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/u.test(value);
}

/**
 * Build a VideoObject node. Returns `null` when any required field is
 * missing or malformed — never throw, never ship a half-formed
 * envelope. The caller checks for null before emitting the JSON-LD
 * script.
 */
export const videoObjectJsonLd = (input: VideoObjectInput): VideoObjectNode | null => {
  const name = input.name.trim();
  const description = input.description.trim();
  if (name.length === 0 || description.length === 0) return null;
  if (input.contentUrl === undefined && input.embedUrl === undefined) return null;
  if (input.contentUrl !== undefined && !isValidHttpsUrl(input.contentUrl)) return null;
  if (input.embedUrl !== undefined && !isValidHttpsUrl(input.embedUrl)) return null;
  if (!isIsoDate(input.uploadDate)) return null;

  const thumbnails =
    typeof input.thumbnailUrl === 'string' ? [input.thumbnailUrl] : input.thumbnailUrl;
  const safeThumbs = thumbnails.filter(isValidHttpsUrl);
  if (safeThumbs.length === 0) return null;

  const node: VideoObjectNode = {
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl: safeThumbs.length === 1 ? (safeThumbs[0] as string) : safeThumbs,
    uploadDate: input.uploadDate,
  };
  if (input.contentUrl !== undefined) node.contentUrl = input.contentUrl;
  if (input.embedUrl !== undefined) node.embedUrl = input.embedUrl;
  if (input.duration !== undefined && /^PT\d+(M\d+S|S|M)$/u.test(input.duration)) {
    node.duration = input.duration;
  }
  if (input.width !== undefined && input.width > 0) node.width = input.width;
  if (input.height !== undefined && input.height > 0) node.height = input.height;
  const caption = input.caption?.trim();
  if (caption !== undefined && caption.length > 0) node.caption = caption;
  return node;
};
