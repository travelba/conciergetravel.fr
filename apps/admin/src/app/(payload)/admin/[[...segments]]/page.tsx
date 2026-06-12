import type { Metadata } from 'next';
import { generatePageMetadata, RootPage } from '@payloadcms/next/views';
import config from '@payload-config';

import { payloadAdminImportMap } from '../../payload-import-map';

type Args = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

/**
 * Forward `segments` untouched: Payload distinguishes `undefined`
 * (dashboard root, `/admin`) from an array. Coercing to `[]` makes it
 * compute the route as `/admin/` and 404 on the dashboard.
 */
async function normalizedParams(paramsPromise: Args['params']) {
  const p = await paramsPromise;
  // Payload types `segments` as `string[]`, but its RootPage explicitly
  // handles `undefined` at runtime (`Array.isArray` guard), so the cast
  // is safe — and required to keep the dashboard route working.
  return { segments: p.segments as string[] };
}

export const generateMetadata = async ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({
    config: Promise.resolve(config),
    params: normalizedParams(params),
    searchParams,
  });

const Page = async ({ params, searchParams }: Args) =>
  RootPage({
    config: Promise.resolve(config),
    importMap: payloadAdminImportMap,
    params: normalizedParams(params),
    searchParams,
  });

export default Page;
