import { z } from 'zod';

import { formatZodIssues, v2ReadErr, v2ReadOk, type V2ReadResult } from './read-result';

const RankingSlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'ranking slug must be kebab-case');

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const RankingCardV2Schema = z.object({
  id: z.string().uuid(),
  slug: RankingSlugSchema,
  title_fr: z.string().min(1),
  title_en: z.string().min(1).nullable(),
  kind: z.enum(['best_of', 'awarded', 'thematic', 'geographic']),
  hero_image: z.string().min(1).nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  axes: JsonValueSchema,
  entry_count: z.number().int().min(0),
  updated_at: z.string().datetime({ offset: true }),
});

export type RankingCardV2 = z.infer<typeof RankingCardV2Schema>;

export const parseRankingCardV2 = (raw: unknown): V2ReadResult<RankingCardV2> => {
  const parsed = RankingCardV2Schema.safeParse(raw);
  if (!parsed.success) {
    return v2ReadErr({
      kind: 'parse_error',
      issues: formatZodIssues(parsed.error.issues),
    });
  }
  return v2ReadOk(parsed.data);
};
