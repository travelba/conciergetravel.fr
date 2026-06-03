import 'server-only';

import type { ReservationCardInput, TravelportCredentials } from '@mch/integrations/travelport';

import { env } from '@/lib/env';
import { redis } from '@/lib/redis';

let cachedCreds: TravelportCredentials | null | undefined;

/**
 * Vrai uniquement si le pilote sandbox Travelport est explicitement activé.
 * Garde-fou principal : jamais actif en production sans cette variable.
 */
export function isTravelportSandboxEnabled(): boolean {
  return env.TRAVELPORT_SANDBOX_ENABLED === true;
}

/**
 * Construit les credentials Travelport depuis l'env + Redis. Renvoie `null`
 * si le sandbox est désactivé ou si une variable requise manque (l'appelant
 * doit alors retomber sur le mode actuel — Amadeus / display_only).
 */
export function getTravelportCredentials(): TravelportCredentials | null {
  if (cachedCreds !== undefined) return cachedCreds;
  if (!isTravelportSandboxEnabled()) {
    cachedCreds = null;
    return null;
  }

  const authUrl = env.TRAVELPORT_AUTH_URL;
  const apiBaseUrl = env.TRAVELPORT_API_BASE;
  const username = env.TRAVELPORT_USERNAME;
  const password = env.TRAVELPORT_PASSWORD;
  const clientId = env.TRAVELPORT_CLIENT_ID;
  const clientSecret = env.TRAVELPORT_CLIENT_SECRET;
  const pcc = env.TRAVELPORT_PCC;
  const accessGroup = env.TRAVELPORT_ACCESS_GROUP;

  if (
    authUrl === undefined ||
    apiBaseUrl === undefined ||
    username === undefined ||
    password === undefined ||
    clientId === undefined ||
    clientSecret === undefined ||
    pcc === undefined ||
    accessGroup === undefined
  ) {
    cachedCreds = null;
    return null;
  }

  cachedCreds = {
    authUrl,
    apiBaseUrl,
    username,
    password,
    clientId,
    clientSecret,
    pcc,
    accessGroup,
    redis,
  };
  return cachedCreds;
}

/** Devise demandée pour les recherches/réservations Travelport (défaut EUR). */
export function getTravelportCurrency(): string {
  return env.TRAVELPORT_CURRENCY;
}

/**
 * Allow-list des slugs hôtels éligibles au pilote. Vide ⇒ aucun hôtel n'est
 * routé vers Travelport (sécurité : opt-in explicite par slug).
 */
export function getTravelportSampleSlugs(): readonly string[] {
  const raw = env.TRAVELPORT_SAMPLE_SLUGS;
  if (raw === undefined) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isTravelportSampleSlug(slug: string): boolean {
  return getTravelportSampleSlugs().includes(slug);
}

/**
 * Carte de test sandbox pour la garantie/dépôt. Renvoie `null` si non
 * configurée. À n'utiliser qu'en preprod — aucune carte réelle ne doit
 * transiter par cette voie.
 */
export function getTravelportTestCard(): ReservationCardInput | null {
  const cardCode = env.TRAVELPORT_TEST_CARD_CODE;
  const number = env.TRAVELPORT_TEST_CARD_NUMBER;
  const expireDate = env.TRAVELPORT_TEST_CARD_EXPIRE;
  const cardHolderName = env.TRAVELPORT_TEST_CARD_HOLDER;
  if (
    cardCode === undefined ||
    number === undefined ||
    expireDate === undefined ||
    cardHolderName === undefined
  ) {
    return null;
  }
  const cvv = env.TRAVELPORT_TEST_CARD_CVV;
  return {
    cardCode,
    cardType: 'Credit',
    cardHolderName,
    number,
    expireDate,
    ...(cvv !== undefined ? { seriesCode: cvv } : {}),
  };
}
