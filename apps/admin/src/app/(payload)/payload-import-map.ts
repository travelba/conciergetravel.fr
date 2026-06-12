import type { ImportMap } from 'payload';
import { CollectionCards } from '@payloadcms/next/rsc';

/**
 * Mirror of the map produced by `payload generate:importmap`.
 * Re-run that command and sync this file whenever a plugin or custom
 * admin component registers new component paths.
 */
export const payloadAdminImportMap = {
  '@payloadcms/next/rsc#CollectionCards': CollectionCards,
} satisfies ImportMap;
