/**
 * DataForSEO v3 integration — keyword research, SERP People-Also-Ask, search
 * intent and AI-Optimization grounding for the editorial pipelines
 * (FAQ questions, titles/H2/meta, GEO/AEO, internal-link clusters).
 *
 * Skills: api-integration, seo-technical, geo-llm-optimization.
 */
export const DATAFORSEO_INTEGRATION_VERSION = '0.0.1' as const;

export type { DataForSeoError } from './errors';
export { dfsLive, dataForSeoConfigFromSharedEnv, type DataForSeoClientConfig } from './client';
export {
  fetchRelatedKeywords,
  fetchKeywordSuggestions,
  fetchSearchVolume,
  fetchSearchIntent,
  fetchSerpQuestions,
  fetchAiKeywordVolume,
  DATAFORSEO_PATHS,
  type KeywordResearchLocale,
  type SerpQuestions,
} from './keyword-research';
export { dfsCacheKey, DFS_CACHE_TTL_SEC } from './cache-keys';
export type { KeywordMetric, KeywordIntent } from './types';
