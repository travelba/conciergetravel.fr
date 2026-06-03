import 'server-only';

import { getCityDirectory } from '@/server/annuaire/get-city-directory';
import { getCountryDirectory } from '@/server/annuaire/get-country-directory';

import { type AgentLocale, type BuilderResponse, errorResponse, okResponse } from './types';

/**
 * Geolocated directory result builders (ADR-0026) shared by the
 * `/api/agent/directory/*` routes and the MCP tools (Lot 4, ADR-0029).
 * No pricing / availability — Phase 6 freeze (AGENTS.md §4ter).
 */

const DIRECTORY_CACHE = 'private, max-age=1800, stale-while-revalidate=3600';

export interface DirectoryCountryParams {
  readonly pays: string;
  readonly locale: AgentLocale;
}

export async function buildDirectoryCountryResult(
  params: DirectoryCountryParams,
): Promise<BuilderResponse> {
  const { pays, locale } = params;
  const directory = await getCountryDirectory(pays, locale).catch(() => null);
  if (directory === null) {
    return errorResponse(404, { error: 'not_found', pays });
  }

  const prefix = locale === 'en' ? '/en/hotel/' : '/fr/hotel/';
  let located = 0;
  const cities = directory.cities.map((c) => {
    const hotels = c.hotels.map((h) => {
      if (h.lat !== null && h.lng !== null) located += 1;
      return {
        name: h.name,
        slug: h.slug,
        url: `${prefix}${h.slug}`,
        lat: h.lat,
        lng: h.lng,
        isPalace: h.isPalace,
      };
    });
    return { city: c.name, citySlug: c.slug, hotels };
  });

  return okResponse(
    {
      pays: directory.slug,
      countryName: directory.name,
      cities,
      count: directory.totalCount,
      located,
      canonicalUrl:
        locale === 'en' ? `/en/hotels/${directory.slug}` : `/fr/hotels/${directory.slug}`,
    },
    DIRECTORY_CACHE,
  );
}

export interface DirectoryCityParams {
  readonly pays: string;
  readonly ville: string;
  readonly locale: AgentLocale;
}

export async function buildDirectoryCityResult(
  params: DirectoryCityParams,
): Promise<BuilderResponse> {
  const { pays, ville, locale } = params;
  const directory = await getCityDirectory(pays, ville, locale).catch(() => null);
  if (directory === null) {
    return errorResponse(404, { error: 'not_found', pays, ville });
  }

  const prefix = locale === 'en' ? '/en/hotel/' : '/fr/hotel/';
  const hotels = directory.hotels.map((h) => ({
    name: h.name,
    slug: h.slug,
    url: `${prefix}${h.slug}`,
    lat: h.lat,
    lng: h.lng,
    isPalace: h.isPalace,
  }));
  const located = hotels.filter((h) => h.lat !== null && h.lng !== null).length;

  return okResponse(
    {
      pays: directory.countrySlug,
      ville: directory.citySlug,
      countryName: directory.countryName,
      cityName: directory.cityName,
      hotels,
      count: hotels.length,
      located,
      canonicalUrl:
        locale === 'en'
          ? `/en/hotels/${directory.countrySlug}/${directory.citySlug}`
          : `/fr/hotels/${directory.countrySlug}/${directory.citySlug}`,
    },
    DIRECTORY_CACHE,
  );
}
