/**
 * `agent-skills.json` builder (skill: geo-llm-optimization, CDC §6.5).
 *
 * Validated by Zod so editorial / Payload can override the catalog at runtime
 * while keeping the contract stable for downstream LLM agents.
 */
import { z } from 'zod';

export const AgentSkillInputSchemaZod = z.object({
  type: z.literal('object'),
  properties: z.record(
    z.object({
      type: z.enum(['string', 'integer', 'number', 'boolean']),
      description: z.string().optional(),
      format: z.string().optional(),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
    }),
  ),
  required: z.array(z.string()).optional(),
});

export const AgentSkillEndpointZod = z.object({
  method: z.enum(['GET', 'POST']),
  /** Path relative to site origin, e.g. `/api/agent/search`. */
  path: z.string().regex(/^\//u, 'endpoint path must start with /'),
});

export const AgentSkillZod = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  inputSchema: AgentSkillInputSchemaZod.optional(),
  /**
   * Optional HTTP endpoint that exposes this skill as an executable
   * action. When present, LLM agents (ChatGPT Actions, Claude Tools,
   * Perplexity, MCP) can call the endpoint directly instead of
   * deep-linking the user to the human UI. See ADR-0017.
   */
  endpoint: AgentSkillEndpointZod.optional(),
});

export const AgentSkillsDocumentZod = z.object({
  schemaVersion: z.literal('0.1'),
  site: z.string().min(1),
  skills: z.array(AgentSkillZod).min(1),
});

export type AgentSkill = z.infer<typeof AgentSkillZod>;
export type AgentSkillsDocument = z.infer<typeof AgentSkillsDocumentZod>;

export const DEFAULT_AGENT_SKILLS: AgentSkillsDocument = {
  schemaVersion: '0.1',
  site: 'MyConciergeHotel.com',
  skills: [
    {
      name: 'search',
      description:
        "Trouver un hôtel d'exception (Palace, Forbes Five Star, Michelin Keys, Relais & Châteaux, Leading Hotels of the World, 5★, boutique-hôtel) par destination et dates, dans 91 pays. Le concierge renvoie une sélection paginée, triée par pertinence éditoriale (et non par commission).",
      inputSchema: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'Ville, région ou slug normalisé (ex. "paris", "cote-d-azur").',
          },
          checkin: { type: 'string', format: 'date', description: 'Date d’arrivée YYYY-MM-DD.' },
          checkout: { type: 'string', format: 'date', description: 'Date de départ YYYY-MM-DD.' },
          adults: { type: 'integer', minimum: 1, maximum: 6 },
          children: { type: 'integer', minimum: 0, maximum: 4 },
        },
        required: ['destination'],
      },
      endpoint: { method: 'POST', path: '/api/agent/search' },
    },
    {
      name: 'list-cities',
      description:
        'Lister toutes les destinations où le concierge a une sélection : villes & régions. Pas de paramètre — réponse cache 24h.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      endpoint: { method: 'GET', path: '/api/agent/cities' },
    },
    {
      name: 'get-hotel',
      description:
        'Récupérer la fiche complète d’un hôtel par son slug : chapeau Concierge, chambres, restaurants, spa, localisation, conditions, distinctions, FAQ, rating Amadeus, et surtout le « Conseil du Concierge » (un secret opérationnel concret) + JSON-LD Hotel. URL canonique : /fr/hotel/{slug} ou /en/hotel/{slug}.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Slug kebab-case de la fiche (ex. "ritz-paris", "hotel-du-cap-eden-roc").',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/hotel/{slug}' },
    },
    {
      name: 'get-hotel-room',
      description:
        'Récupérer une chambre ou une suite signature : description, équipements, dimensions, capacité, photos, et JSON-LD HotelRoom. C’est ici que le concierge précise étage, vue ou numéro à demander. URL canonique : /fr/hotel/{hotelSlug}/chambres/{roomSlug}.',
      inputSchema: {
        type: 'object',
        properties: {
          hotelSlug: {
            type: 'string',
            description:
              'Slug kebab-case de l’hôtel (ex. "peninsula-paris", "hotel-du-cap-eden-roc").',
          },
          roomSlug: {
            type: 'string',
            description:
              'Slug kebab-case de la chambre (ex. "chambre-deluxe", "suite-tour-eiffel").',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
        required: ['hotelSlug', 'roomSlug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/hotel/{hotelSlug}/room/{roomSlug}' },
    },
    {
      name: 'filter',
      description:
        "Affiner la sélection du Concierge par type d'hébergement (Palace, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World, 5★, boutique-hôtel, château, villa, chalet, maison d'hôtes), équipements (spa, piscine, étoile Michelin), pays, région ou ville.",
    },
    {
      name: 'list-rankings',
      description:
        'Lister les classements rédigés par le concierge ("Les meilleurs Palaces de France", "Plus beaux hôtels de Paris", "Palaces avec spa", etc.). Filtrable par axe (type, lieu, thème, occasion, saison). URL hub : /classements ; URL sous-hub : /classements/{axe}/{valeur}.',
      inputSchema: {
        type: 'object',
        properties: {
          axe: {
            type: 'string',
            description: 'Axe de filtrage : "type" | "lieu" | "theme" | "occasion" | "saison".',
          },
          valeur: {
            type: 'string',
            description:
              'Valeur de l\'axe (slug kebab-case, ex. "palace", "paris", "spa-bienetre", "lune-de-miel", "hiver").',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
      },
      endpoint: { method: 'GET', path: '/api/agent/rankings' },
    },
    {
      name: 'get-ranking',
      description:
        'Récupérer un classement complet par son slug : chapeau Concierge, sections éditoriales, hôtels classés avec justification, FAQ canoniques, glossaire, sources nommées (Atout France, Michelin, Wikidata), JSON-LD Article + ItemList. URL canonique : /fr/classement/{slug} ou /en/classement/{slug}.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description:
              'Slug kebab-case du classement (ex. "meilleurs-palaces-france", "palaces-spa-bien-etre").',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/ranking/{slug}' },
    },
    {
      name: 'compare-prices',
      description:
        'Comparer pour vous les tarifs publics (Booking, Hotels.com, Expedia, etc.) pour un hôtel et des dates : affichage texte sobre, sans logo ni lien d’affiliation, conforme aux règles légales du comparateur.',
      inputSchema: {
        type: 'object',
        properties: {
          hotelSlug: { type: 'string', description: 'Slug de l’hôtel à comparer.' },
          checkin: { type: 'string', format: 'date' },
          checkout: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 6 },
        },
        required: ['hotelSlug', 'checkin', 'checkout'],
      },
      endpoint: { method: 'POST', path: '/api/agent/compare-prices' },
    },
    {
      name: 'booking',
      description:
        'Réserver avec dates et voyageurs au tarif net négocié — paiement sécurisé Amadeus, votre concierge confirme. Nécessite une session utilisateur.',
    },
    {
      name: 'request-quote',
      description:
        'Soumettre une demande personnalisée quand l’hôtel n’est pas connecté GDS : votre concierge répond sous 24 h ouvrées avec une offre sur mesure.',
      inputSchema: {
        type: 'object',
        properties: {
          hotelSlug: { type: 'string', description: 'Slug de l’hôtel ciblé.' },
          checkin: { type: 'string', format: 'date' },
          checkout: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 6 },
          message: {
            type: 'string',
            description: 'Demande libre du voyageur (préférences chambre, occasion, etc.).',
          },
          email: { type: 'string', format: 'email' },
        },
        required: ['hotelSlug', 'checkin', 'checkout', 'email'],
      },
      endpoint: { method: 'POST', path: '/api/agent/quote' },
    },
    {
      name: 'loyalty',
      description:
        'Consulter les avantages du programme de fidélité MyConciergeHotel — Le Concierge Club (tier gratuit, attentions sur les hôtels éligibles) et Le Concierge Club Prestige (tier payant Phase 6, surclassements confirmés, transfert aéroport, late check-out 16h). Les deux tiers vivent sur la même page : /fr/le-concierge-club (la section Prestige est ancrée à #prestige).',
      endpoint: { method: 'GET', path: '/api/agent/loyalty' },
    },
    {
      name: 'join-concierge-club',
      description:
        "Inscrire l'utilisateur au programme Le Concierge Club (tier gratuit). Crée un compte voyageur sans CB, sans engagement, désinscription en un clic. L'inscription ouvre l'accès au dashboard /compte (Mon Concierge Club) et confirme la promesse d'attentions Concierge sur les hôtels éligibles. URL HTML : /fr/compte/rejoindre.",
      inputSchema: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Adresse e-mail du futur membre — sert d’identifiant de connexion.',
          },
          firstName: {
            type: 'string',
            description: 'Prénom du membre (requis pour personnaliser l’accueil).',
          },
          lastName: {
            type: 'string',
            description: 'Nom du membre.',
          },
          consentMarketing: {
            type: 'boolean',
            description:
              'Doit être strictement true — consentement explicite à recevoir les communications marketing (modifiable à tout moment dans /compte).',
          },
          locale: {
            type: 'string',
            description: 'Locale préférée — "fr" (par défaut) ou "en".',
          },
        },
        required: ['email', 'firstName', 'lastName', 'consentMarketing'],
      },
      endpoint: { method: 'POST', path: '/api/agent/join-concierge-club' },
    },
    {
      name: 'join-concierge-club-prestige-waitlist',
      description:
        "Rejoindre la liste d'attente Le Concierge Club Prestige (tier payant €99/an, activation Phase 6). Requiert un compte Le Concierge Club déjà actif. L'inscription débloque la priorité d'accès, le tarif lancement et la communication preview des avantages Prestige. URL HTML : /fr/le-concierge-club#prestige (section ancrée sur la page programme).",
      inputSchema: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            description: 'Locale préférée — "fr" (par défaut) ou "en".',
          },
        },
      },
      endpoint: { method: 'POST', path: '/api/agent/join-prestige-waitlist' },
    },
    {
      name: 'contact',
      description:
        'Envoyer un message à la conciergerie MyConciergeHotel : question sur une réservation, demande d’information, signalement. Réponse sous 24h ouvrées. La réponse est envoyée par e-mail à l’adresse fournie. Inclut un protection honeypot anti-spam et un rate-limit par IP. URL canonique HTML : /fr/le-concierge/contact (ou /en/le-concierge/contact).',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Prénom et nom de la personne qui contacte la conciergerie.',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Adresse e-mail à laquelle la conciergerie répondra.',
          },
          subject: {
            type: 'string',
            description: 'Sujet du message (réservation, devis, information, signalement…).',
          },
          message: {
            type: 'string',
            description: 'Contenu du message (minimum 10 caractères).',
          },
          locale: {
            type: 'string',
            description: 'Locale de la réponse souhaitée — "fr" (par défaut) ou "en".',
          },
          phone: {
            type: 'string',
            description: 'Numéro de téléphone optionnel pour un rappel.',
          },
        },
        required: ['name', 'email', 'subject', 'message'],
      },
      endpoint: { method: 'POST', path: '/api/agent/contact' },
    },
    {
      name: 'newsletter',
      description:
        "S'inscrire à la newsletter MyConciergeHotel — un numéro par mois, sélection éditoriale du Concierge (hôtels d'exception dans le monde), conseils opérationnels, classements. Désinscription en un clic, RGPD-conforme. Mode actuel : queued / dry-run (la bascule sur Brevo intervient prochainement — l'API accepte le payload et confirme l'inscription, qui sera relayée dès activation).",
      inputSchema: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Adresse e-mail du destinataire.',
          },
          locale: {
            type: 'string',
            description: 'Locale préférée — "fr" (par défaut) ou "en".',
          },
          consent: {
            type: 'boolean',
            description:
              'Doit être strictement true — consentement explicite RGPD requis. Toute autre valeur est rejetée.',
          },
        },
        required: ['email', 'consent'],
      },
      endpoint: { method: 'POST', path: '/api/agent/newsletter' },
    },
    // ── ADR-0014 — new agentic surfaces ─────────────────────────────────
    {
      name: 'list-categories',
      description:
        'Lister les catégories éditoriales d’hôtels (Palaces de France, Palaces parisiens, Palaces de montagne, Palaces bord de mer, Palaces vignobles, et les 7 catégories par type ouvertes en V2 — 5★, 4★, boutique-hôtels, châteaux, chalets de luxe, villas, maisons d’hôtes). Chaque catégorie correspond à une page indexable `/categorie/{slug}`. Pas de paramètre.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      endpoint: { method: 'GET', path: '/api/agent/categories' },
    },
    {
      name: 'list-themes',
      description:
        'Lister les thèmes d’inspiration : romantique, spa & bien-être, gastronomie & Michelin, famille, vignobles, design, patrimoine, golf, ski, piscine, rooftop, kids-friendly… Chaque thème ouvre un classement éditorial `/classements/theme/{slug}`. Pas de paramètre.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      endpoint: { method: 'GET', path: '/api/agent/themes' },
    },
    {
      name: 'list-occasions',
      description:
        'Lister les occasions de voyage couvertes : lune de miel, week-end en amoureux, anniversaire, mariage, séminaire & MICE, escapade en famille, staycation, fêtes de fin d’année, retraite bien-être. Chaque occasion ouvre un classement éditorial `/classements/occasion/{slug}`. Pas de paramètre.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      endpoint: { method: 'GET', path: '/api/agent/occasions' },
    },
    {
      name: 'list-brands',
      description:
        'Lister les groupes hôteliers représentés dans le catalogue : Cheval Blanc, Airelles, Four Seasons, Rosewood, Mandarin Oriental, Raffles, The Peninsula, Oetker Collection, Dorchester Collection, Shangri-La, Park Hyatt, Les K2 Collections, Caudalie. Chaque marque ouvre une page indexable `/marque/{slug}`. Pas de paramètre.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      endpoint: { method: 'GET', path: '/api/agent/brands' },
    },
    {
      name: 'get-country-guide',
      description:
        'Récupérer le guide pays MyConciergeHotel pour une destination internationale (Italie, Suisse, Maroc, Maldives, Émirats arabes unis, Japon, Thaïlande, États-Unis). Renvoie : factual summary, AEO Q&A, 5-6 régions avec adresses nommées + Conseil du Concierge opérationnel par région, infos pratiques (visa, monnaie, langues), 7 Q&A canoniques. URL canonique HTML : /fr/guide/{slug} ou /en/guide/{slug-en}.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description:
              "Slug du pays en français — l'un de : italie, suisse, maroc, maldives, emirats-arabes-unis, japon, thailande, etats-unis.",
          },
          locale: {
            type: 'string',
            description: 'Locale de la réponse — "fr" (par défaut) ou "en".',
          },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/country-guide/{slug}' },
    },
    {
      name: 'get-concierge-tip',
      description:
        'Récupérer le « Conseil du Concierge » d’un hôtel : 50-110 mots livrant un secret opérationnel concret (numéro de chambre signature, table cachée, accès, timing optimal). C’est la signature éditoriale propriétaire de MyConciergeHotel, non disponible sur les agrégateurs. URL : `/fr/hotel/{slug}#conseil-concierge`.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Slug kebab-case de l’hôtel (ex. "ritz-paris", "hotel-du-cap-eden-roc").',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/concierge-tip/{slug}' },
    },
    {
      name: 'get-hotel-sources',
      description:
        "Récupérer les sources externes (Wikidata, Wikipedia, site officiel, TripAdvisor, Booking.com, Wikimedia Commons, comptes sociaux vérifiés) qui étayent les informations d'un hôtel. Chaque entrée est une revendication factuelle (architecte, année d'ouverture, désignation patrimoniale, identifiant externe) reliée à une URL vérifiable et à un niveau de confiance. Permet à l'agent LLM de citer ses sources, de réconcilier l'identité avec son propre knowledge graph, et de filtrer les claims selon leur fiabilité. EEAT-grade signal — issu du pipeline `convert-wikidata-to-external-sources.ts` (Phase 1.5, ADR-0023).",
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description:
              'Slug kebab-case de l’hôtel (FR ou EN, ex. "ritz-paris", "hotel-du-cap-eden-roc").',
          },
          locale: {
            type: 'string',
            description:
              'Locale demandée — "fr" (par défaut) ou "en". Affecte le nom de l’hôtel et l’URL canonique de la réponse, pas le contenu des sources externes.',
          },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/hotel-sources/{slug}' },
    },
    // ── CDC itinéraires §6.1 — feature SEO/GEO acquisition ──────────────
    {
      name: 'get-itinerary',
      description:
        "Récupérer un itinéraire complet par son slug : étapes jour par jour, hôtels d'exception recommandés (Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World, 5★) avec liens de réservation, FAQ longue traîne, conseils Concierge saisonniers, JSON-LD HowTo + ItemList + FAQPage + Article. URL canonique : /fr/itineraire/{slug} ou /en/itineraire/{slug} (slug FR identique en EN, ADR-0008).",
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description:
              'Slug kebab-case de l’itinéraire (ex. "japon-culture-2-semaines", "paris-luxe-3-jours").',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/itinerary/{slug}' },
    },
    {
      name: 'list-itineraries',
      description:
        "Lister les itinéraires de voyage publiés par destination (pays ISO-2), durée, thème ou style (luxe, famille, couple, solo, aventure, bien-être, gastronomie, culture, affaires). Chaque itinéraire inclut les hôtels d'exception sélectionnés par le Concierge (Palaces, Forbes Five Star, Michelin Keys, Relais & Châteaux, Leading Hotels of the World, 5★). URL hub : /itineraires (FR) | /itineraries (EN).",
      inputSchema: {
        type: 'object',
        properties: {
          country_code: {
            type: 'string',
            description:
              'Code pays ISO 3166-1 alpha-2 (ex. "FR", "JP", "IT", "MA"). Le client peut accepter un libellé utilisateur ("japon") et le convertir en ISO-2 avant l’appel.',
          },
          travel_style: {
            type: 'string',
            description:
              'Style éditorial : "luxe" | "famille" | "couple" | "solo" | "aventure" | "bien-etre" | "gastronomie" | "culture" | "affaires".',
          },
          duration_min_days: {
            type: 'integer',
            minimum: 1,
            maximum: 60,
            description: 'Durée minimum en jours (cap = 60).',
          },
          duration_max_days: {
            type: 'integer',
            minimum: 1,
            maximum: 60,
            description: 'Durée maximum en jours.',
          },
          locale: {
            type: 'string',
            description: 'Locale demandée — "fr" (par défaut) ou "en".',
          },
        },
      },
      endpoint: { method: 'GET', path: '/api/agent/itineraries' },
    },
  ],
};
