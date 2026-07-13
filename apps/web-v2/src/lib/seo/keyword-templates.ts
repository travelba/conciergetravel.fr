/**
 * Modèle de ciblage requêtes par gabarit — SOURCE DE VÉRITÉ UNIQUE.
 * see docs/adr/0034-v2-keyword-targeting-model.md
 *
 * Chaque gabarit possède une famille de requêtes exclusive :
 * - Fiche hôtel  → « Hôtel {Nom} » · « Hôtel {Nom} tarif » · « Hôtel {Nom} promo »
 * - Annuaire     → « Hôtel {Ville} » · « Hôtel {Pays} » · « Hôtel {Région} »
 * - Classement   → « Meilleur hôtel de luxe à {Ville} » · « Meilleur hôtel
 *                  5 étoiles en {Pays} » · « Les plus beaux hôtels {Pays} »
 *
 * Interdiction de hard-coder un title/H1 SEO dans une page — tout passe ici.
 * Le phrasé définitif par entité est validé par DataForSEO (groundKeywords).
 */

export type SeoLocale = 'fr' | 'en';

export type SeoText = {
  readonly title: string;
  readonly h1: string;
  readonly description: string;
};

// NB : le branding est ajouté par le template du root layout
// (`%s · MyConciergeHotel`) — ne jamais suffixer les titles ici.

/* ------------------------------------------------------------------ */
/* Gabarit 1 — Fiche hôtel : « Hôtel {Nom} » + tarif + promo           */
/* ------------------------------------------------------------------ */

export function hotelDetailSeo(input: {
  readonly name: string;
  readonly city: string;
  readonly locale: SeoLocale;
}): SeoText {
  const { name, city, locale } = input;
  // Le nom contient parfois déjà « Hôtel » (Hôtel du Cap…) — ne pas doubler.
  const prefixed = /h[oô]tel/i.test(name)
    ? name
    : locale === 'fr'
      ? `Hôtel ${name}`
      : `${name} Hotel`;

  if (locale === 'fr') {
    return {
      title: `${prefixed} ${city} : tarifs, promos & avis`,
      h1: prefixed,
      description: `${prefixed} à ${city} — tarifs par chambre, promos membres jusqu'à -20 %, avis vérifiés et conseil du Concierge. Prix TTC en euros.`,
    };
  }
  return {
    title: `${prefixed} ${city}: rates, deals & reviews`,
    h1: prefixed,
    description: `${prefixed} in ${city} — room rates, member deals up to -20%, verified reviews and the Concierge's tip.`,
  };
}

/** Ancres obligatoires de la fiche (capture « tarif » / « promo »). */
export const HOTEL_DETAIL_ANCHORS = {
  rates: 'tarifs',
  deals: 'promos',
} as const;

export function hotelRatesSectionTitle(name: string, locale: SeoLocale): string {
  return locale === 'fr' ? `Tarifs ${name}` : `${name} rates`;
}

export function hotelDealsSectionTitle(name: string, locale: SeoLocale): string {
  return locale === 'fr' ? `Promos & offres ${name}` : `${name} deals & offers`;
}

/* ------------------------------------------------------------------ */
/* Gabarit 2 — Annuaire : « Hôtel {Ville|Pays|Région} »                 */
/* ------------------------------------------------------------------ */

export type DirectoryZoneKind = 'ville' | 'region' | 'pays';

export function directorySeo(input: {
  readonly zoneLabel: string;
  readonly kind: DirectoryZoneKind;
  readonly hotelCount: number;
  readonly locale: SeoLocale;
}): SeoText {
  const { zoneLabel, kind, hotelCount, locale } = input;

  if (locale === 'fr') {
    const scope =
      kind === 'pays'
        ? `en ${zoneLabel}`
        : kind === 'region'
          ? `en ${zoneLabel}`
          : `à ${zoneLabel}`;
    return {
      title: `Hôtel ${zoneLabel} : ${hotelCount} hôtels d'exception`,
      h1: `Hôtel ${zoneLabel}`,
      description: `Trouvez votre hôtel ${scope} : ${hotelCount} adresses sélectionnées par le Concierge — palaces, Relais & Châteaux, boutique-hôtels. Prix TTC en euros.`,
    };
  }
  return {
    title: `${zoneLabel} hotels: ${hotelCount} exceptional stays`,
    h1: `${zoneLabel} hotels`,
    description: `Find your hotel in ${zoneLabel}: ${hotelCount} addresses curated by the Concierge — palaces, Relais & Châteaux, boutique hotels.`,
  };
}

/* ------------------------------------------------------------------ */
/* Gabarit 3 — Classement : superlatifs (exclusifs à ce gabarit)        */
/* ------------------------------------------------------------------ */

export type RankingPattern = 'luxe-ville' | '5-etoiles-pays' | 'plus-beaux-pays';

export function rankingSeo(input: {
  readonly pattern: RankingPattern;
  readonly zoneLabel: string;
  readonly locale: SeoLocale;
}): SeoText {
  const { pattern, zoneLabel, locale } = input;

  if (locale === 'fr') {
    switch (pattern) {
      case 'luxe-ville':
        return {
          title: `Meilleur hôtel de luxe à ${zoneLabel}`,
          h1: `Meilleur hôtel de luxe à ${zoneLabel}`,
          description: `Le classement des meilleurs hôtels de luxe à ${zoneLabel}, testé par la conciergerie : notes, points forts et conseil du Concierge pour chaque adresse.`,
        };
      case '5-etoiles-pays':
        return {
          title: `Meilleur hôtel 5 étoiles en ${zoneLabel}`,
          h1: `Meilleur hôtel 5 étoiles en ${zoneLabel}`,
          description: `Le classement des meilleurs hôtels 5 étoiles en ${zoneLabel} : sélection Concierge, notes vérifiées et points forts de chaque établissement.`,
        };
      case 'plus-beaux-pays':
        return {
          title: `Les plus beaux hôtels ${zoneLabel}`,
          h1: `Les plus beaux hôtels ${zoneLabel}`,
          description: `Les plus beaux hôtels ${zoneLabel} sélectionnés par le Concierge : architecture, vues, adresses de caractère — le classement complet.`,
        };
    }
  }

  switch (pattern) {
    case 'luxe-ville':
      return {
        title: `Best luxury hotel in ${zoneLabel}`,
        h1: `Best luxury hotel in ${zoneLabel}`,
        description: `The Concierge's ranking of the best luxury hotels in ${zoneLabel}: scores, highlights and the Concierge's tip for each address.`,
      };
    case '5-etoiles-pays':
      return {
        title: `Best 5-star hotel in ${zoneLabel}`,
        h1: `Best 5-star hotel in ${zoneLabel}`,
        description: `The ranking of the best 5-star hotels in ${zoneLabel}: Concierge selection, verified scores and each property's highlights.`,
      };
    case 'plus-beaux-pays':
      return {
        title: `The most beautiful hotels in ${zoneLabel}`,
        h1: `The most beautiful hotels in ${zoneLabel}`,
        description: `The most beautiful hotels in ${zoneLabel}, curated by the Concierge: architecture, views and characterful addresses — the full ranking.`,
      };
  }
}

/**
 * Détecte le patron d'un slug de classement v2.
 * Slugs canoniques (ADR-0034 §3) :
 *   meilleur-hotel-luxe-{ville} · meilleur-hotel-5-etoiles-{pays} ·
 *   plus-beaux-hotels-{pays}
 */
export function detectRankingPattern(slug: string): RankingPattern | null {
  if (slug.startsWith('meilleur-hotel-luxe-')) return 'luxe-ville';
  if (slug.startsWith('meilleur-hotel-5-etoiles-')) return '5-etoiles-pays';
  if (slug.startsWith('plus-beaux-hotels-')) return 'plus-beaux-pays';
  return null;
}
