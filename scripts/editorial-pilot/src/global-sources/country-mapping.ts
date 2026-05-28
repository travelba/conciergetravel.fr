/**
 * Country label → ISO 3166-1 alpha-2 resolver for the catalogue gap
 * closure pipeline.
 *
 * Two source Excels mix English ("USA", "UK", "Italy"), French
 * ("États-Unis", "Royaume-Uni", "Italie") and ambiguous territory
 * names ("Antilles françaises", "Caribbean", "UK Territory") in the
 * same column. The publishing pipeline needs a stable ISO code per
 * row so:
 *   - the URL slug stays stable
 *   - JSON-LD `Hotel.address.addressCountry` resolves
 *   - `country_label_fr/en` columns can be filled from the canonical
 *     pair (no "USA" vs "États-Unis" mismatch downstream)
 *
 * For territory-level entries that map to several ISO codes (Caribbean,
 * UK Territory…), `resolveCountry` returns `null` and the caller is
 * expected to fall back to a city-aware override map (see
 * scaffold-by-chain.ts CITY_TERRITORY_OVERRIDES).
 *
 * Skill: editorial-pilot, content-modeling, seo-technical.
 */

export interface CountryMeta {
  readonly cc: string;
  readonly fr: string;
  readonly en: string;
}

const CANONICAL: Readonly<Record<string, CountryMeta>> = {
  // Europe — V1 priority
  FR: { cc: 'FR', fr: 'France', en: 'France' },
  IT: { cc: 'IT', fr: 'Italie', en: 'Italy' },
  ES: { cc: 'ES', fr: 'Espagne', en: 'Spain' },
  GB: { cc: 'GB', fr: 'Royaume-Uni', en: 'United Kingdom' },
  DE: { cc: 'DE', fr: 'Allemagne', en: 'Germany' },
  CH: { cc: 'CH', fr: 'Suisse', en: 'Switzerland' },
  AT: { cc: 'AT', fr: 'Autriche', en: 'Austria' },
  PT: { cc: 'PT', fr: 'Portugal', en: 'Portugal' },
  GR: { cc: 'GR', fr: 'Grèce', en: 'Greece' },
  HR: { cc: 'HR', fr: 'Croatie', en: 'Croatia' },
  ME: { cc: 'ME', fr: 'Monténégro', en: 'Montenegro' },
  AL: { cc: 'AL', fr: 'Albanie', en: 'Albania' },
  RO: { cc: 'RO', fr: 'Roumanie', en: 'Romania' },
  RS: { cc: 'RS', fr: 'Serbie', en: 'Serbia' },
  TR: { cc: 'TR', fr: 'Turquie', en: 'Turkey' },
  CZ: { cc: 'CZ', fr: 'Tchéquie', en: 'Czechia' },
  HU: { cc: 'HU', fr: 'Hongrie', en: 'Hungary' },
  PL: { cc: 'PL', fr: 'Pologne', en: 'Poland' },
  SK: { cc: 'SK', fr: 'Slovaquie', en: 'Slovakia' },
  SI: { cc: 'SI', fr: 'Slovénie', en: 'Slovenia' },
  BG: { cc: 'BG', fr: 'Bulgarie', en: 'Bulgaria' },
  IE: { cc: 'IE', fr: 'Irlande', en: 'Ireland' },
  NL: { cc: 'NL', fr: 'Pays-Bas', en: 'Netherlands' },
  BE: { cc: 'BE', fr: 'Belgique', en: 'Belgium' },
  LU: { cc: 'LU', fr: 'Luxembourg', en: 'Luxembourg' },
  IS: { cc: 'IS', fr: 'Islande', en: 'Iceland' },
  NO: { cc: 'NO', fr: 'Norvège', en: 'Norway' },
  SE: { cc: 'SE', fr: 'Suède', en: 'Sweden' },
  DK: { cc: 'DK', fr: 'Danemark', en: 'Denmark' },
  FI: { cc: 'FI', fr: 'Finlande', en: 'Finland' },
  LV: { cc: 'LV', fr: 'Lettonie', en: 'Latvia' },
  LT: { cc: 'LT', fr: 'Lituanie', en: 'Lithuania' },
  EE: { cc: 'EE', fr: 'Estonie', en: 'Estonia' },
  RU: { cc: 'RU', fr: 'Russie', en: 'Russia' },
  UA: { cc: 'UA', fr: 'Ukraine', en: 'Ukraine' },
  BY: { cc: 'BY', fr: 'Biélorussie', en: 'Belarus' },
  MT: { cc: 'MT', fr: 'Malte', en: 'Malta' },
  CY: { cc: 'CY', fr: 'Chypre', en: 'Cyprus' },
  MC: { cc: 'MC', fr: 'Monaco', en: 'Monaco' },
  AD: { cc: 'AD', fr: 'Andorre', en: 'Andorra' },
  LI: { cc: 'LI', fr: 'Liechtenstein', en: 'Liechtenstein' },
  SM: { cc: 'SM', fr: 'Saint-Marin', en: 'San Marino' },
  VA: { cc: 'VA', fr: 'Vatican', en: 'Vatican' },
  XK: { cc: 'XK', fr: 'Kosovo', en: 'Kosovo' },
  MK: { cc: 'MK', fr: 'Macédoine du Nord', en: 'North Macedonia' },
  BA: { cc: 'BA', fr: 'Bosnie-Herzégovine', en: 'Bosnia and Herzegovina' },
  MD: { cc: 'MD', fr: 'Moldavie', en: 'Moldova' },
  GE: { cc: 'GE', fr: 'Géorgie', en: 'Georgia' },
  AM: { cc: 'AM', fr: 'Arménie', en: 'Armenia' },
  AZ: { cc: 'AZ', fr: 'Azerbaïdjan', en: 'Azerbaijan' },

  // North America
  US: { cc: 'US', fr: 'États-Unis', en: 'United States' },
  CA: { cc: 'CA', fr: 'Canada', en: 'Canada' },
  MX: { cc: 'MX', fr: 'Mexique', en: 'Mexico' },

  // Caribbean (resolved via city when source is generic)
  CU: { cc: 'CU', fr: 'Cuba', en: 'Cuba' },
  BS: { cc: 'BS', fr: 'Bahamas', en: 'Bahamas' },
  DO: { cc: 'DO', fr: 'République dominicaine', en: 'Dominican Republic' },
  JM: { cc: 'JM', fr: 'Jamaïque', en: 'Jamaica' },
  HT: { cc: 'HT', fr: 'Haïti', en: 'Haiti' },
  PR: { cc: 'PR', fr: 'Porto Rico', en: 'Puerto Rico' },
  KY: { cc: 'KY', fr: 'Îles Caïmans', en: 'Cayman Islands' },
  TC: { cc: 'TC', fr: 'Îles Turques-et-Caïques', en: 'Turks and Caicos' },
  AI: { cc: 'AI', fr: 'Anguilla', en: 'Anguilla' },
  AG: { cc: 'AG', fr: 'Antigua-et-Barbuda', en: 'Antigua and Barbuda' },
  BB: { cc: 'BB', fr: 'Barbade', en: 'Barbados' },
  GD: { cc: 'GD', fr: 'Grenade', en: 'Grenada' },
  LC: { cc: 'LC', fr: 'Sainte-Lucie', en: 'Saint Lucia' },
  VC: { cc: 'VC', fr: 'Saint-Vincent-et-les-Grenadines', en: 'Saint Vincent and the Grenadines' },
  DM: { cc: 'DM', fr: 'Dominique', en: 'Dominica' },
  KN: { cc: 'KN', fr: 'Saint-Christophe-et-Niévès', en: 'Saint Kitts and Nevis' },
  TT: { cc: 'TT', fr: 'Trinité-et-Tobago', en: 'Trinidad and Tobago' },
  AW: { cc: 'AW', fr: 'Aruba', en: 'Aruba' },
  CW: { cc: 'CW', fr: 'Curaçao', en: 'Curaçao' },
  VG: { cc: 'VG', fr: 'Îles Vierges britanniques', en: 'British Virgin Islands' },
  VI: { cc: 'VI', fr: 'Îles Vierges des États-Unis', en: 'US Virgin Islands' },
  // French Caribbean
  MQ: { cc: 'MQ', fr: 'Martinique', en: 'Martinique' },
  GP: { cc: 'GP', fr: 'Guadeloupe', en: 'Guadeloupe' },
  BL: { cc: 'BL', fr: 'Saint-Barthélemy', en: 'Saint Barthélemy' },
  MF: { cc: 'MF', fr: 'Saint-Martin', en: 'Saint Martin' },

  // Central / South America
  BZ: { cc: 'BZ', fr: 'Belize', en: 'Belize' },
  CR: { cc: 'CR', fr: 'Costa Rica', en: 'Costa Rica' },
  PA: { cc: 'PA', fr: 'Panama', en: 'Panama' },
  GT: { cc: 'GT', fr: 'Guatemala', en: 'Guatemala' },
  NI: { cc: 'NI', fr: 'Nicaragua', en: 'Nicaragua' },
  HN: { cc: 'HN', fr: 'Honduras', en: 'Honduras' },
  SV: { cc: 'SV', fr: 'El Salvador', en: 'El Salvador' },
  AR: { cc: 'AR', fr: 'Argentine', en: 'Argentina' },
  BR: { cc: 'BR', fr: 'Brésil', en: 'Brazil' },
  CL: { cc: 'CL', fr: 'Chili', en: 'Chile' },
  PE: { cc: 'PE', fr: 'Pérou', en: 'Peru' },
  CO: { cc: 'CO', fr: 'Colombie', en: 'Colombia' },
  EC: { cc: 'EC', fr: 'Équateur', en: 'Ecuador' },
  UY: { cc: 'UY', fr: 'Uruguay', en: 'Uruguay' },
  PY: { cc: 'PY', fr: 'Paraguay', en: 'Paraguay' },
  BO: { cc: 'BO', fr: 'Bolivie', en: 'Bolivia' },
  VE: { cc: 'VE', fr: 'Venezuela', en: 'Venezuela' },
  GY: { cc: 'GY', fr: 'Guyana', en: 'Guyana' },
  SR: { cc: 'SR', fr: 'Suriname', en: 'Suriname' },

  // Asia
  CN: { cc: 'CN', fr: 'Chine', en: 'China' },
  JP: { cc: 'JP', fr: 'Japon', en: 'Japan' },
  KR: { cc: 'KR', fr: 'Corée du Sud', en: 'South Korea' },
  HK: { cc: 'HK', fr: 'Hong Kong', en: 'Hong Kong' },
  MO: { cc: 'MO', fr: 'Macao', en: 'Macau' },
  TW: { cc: 'TW', fr: 'Taïwan', en: 'Taiwan' },
  TH: { cc: 'TH', fr: 'Thaïlande', en: 'Thailand' },
  VN: { cc: 'VN', fr: 'Vietnam', en: 'Vietnam' },
  ID: { cc: 'ID', fr: 'Indonésie', en: 'Indonesia' },
  MY: { cc: 'MY', fr: 'Malaisie', en: 'Malaysia' },
  SG: { cc: 'SG', fr: 'Singapour', en: 'Singapore' },
  PH: { cc: 'PH', fr: 'Philippines', en: 'Philippines' },
  KH: { cc: 'KH', fr: 'Cambodge', en: 'Cambodia' },
  LA: { cc: 'LA', fr: 'Laos', en: 'Laos' },
  MM: { cc: 'MM', fr: 'Birmanie', en: 'Myanmar' },
  BN: { cc: 'BN', fr: 'Brunei', en: 'Brunei' },
  IN: { cc: 'IN', fr: 'Inde', en: 'India' },
  PK: { cc: 'PK', fr: 'Pakistan', en: 'Pakistan' },
  BD: { cc: 'BD', fr: 'Bangladesh', en: 'Bangladesh' },
  LK: { cc: 'LK', fr: 'Sri Lanka', en: 'Sri Lanka' },
  NP: { cc: 'NP', fr: 'Népal', en: 'Nepal' },
  BT: { cc: 'BT', fr: 'Bhoutan', en: 'Bhutan' },
  MV: { cc: 'MV', fr: 'Maldives', en: 'Maldives' },
  MN: { cc: 'MN', fr: 'Mongolie', en: 'Mongolia' },
  KZ: { cc: 'KZ', fr: 'Kazakhstan', en: 'Kazakhstan' },
  UZ: { cc: 'UZ', fr: 'Ouzbékistan', en: 'Uzbekistan' },
  TM: { cc: 'TM', fr: 'Turkménistan', en: 'Turkmenistan' },
  KG: { cc: 'KG', fr: 'Kirghizistan', en: 'Kyrgyzstan' },
  TJ: { cc: 'TJ', fr: 'Tadjikistan', en: 'Tajikistan' },
  AF: { cc: 'AF', fr: 'Afghanistan', en: 'Afghanistan' },

  // Middle East
  AE: { cc: 'AE', fr: 'Émirats arabes unis', en: 'United Arab Emirates' },
  SA: { cc: 'SA', fr: 'Arabie saoudite', en: 'Saudi Arabia' },
  QA: { cc: 'QA', fr: 'Qatar', en: 'Qatar' },
  BH: { cc: 'BH', fr: 'Bahreïn', en: 'Bahrain' },
  KW: { cc: 'KW', fr: 'Koweït', en: 'Kuwait' },
  OM: { cc: 'OM', fr: 'Oman', en: 'Oman' },
  JO: { cc: 'JO', fr: 'Jordanie', en: 'Jordan' },
  LB: { cc: 'LB', fr: 'Liban', en: 'Lebanon' },
  IL: { cc: 'IL', fr: 'Israël', en: 'Israel' },
  PS: { cc: 'PS', fr: 'Palestine', en: 'Palestine' },
  IR: { cc: 'IR', fr: 'Iran', en: 'Iran' },
  IQ: { cc: 'IQ', fr: 'Irak', en: 'Iraq' },
  SY: { cc: 'SY', fr: 'Syrie', en: 'Syria' },
  YE: { cc: 'YE', fr: 'Yémen', en: 'Yemen' },

  // Africa
  MA: { cc: 'MA', fr: 'Maroc', en: 'Morocco' },
  TN: { cc: 'TN', fr: 'Tunisie', en: 'Tunisia' },
  DZ: { cc: 'DZ', fr: 'Algérie', en: 'Algeria' },
  EG: { cc: 'EG', fr: 'Égypte', en: 'Egypt' },
  LY: { cc: 'LY', fr: 'Libye', en: 'Libya' },
  ZA: { cc: 'ZA', fr: 'Afrique du Sud', en: 'South Africa' },
  KE: { cc: 'KE', fr: 'Kenya', en: 'Kenya' },
  TZ: { cc: 'TZ', fr: 'Tanzanie', en: 'Tanzania' },
  UG: { cc: 'UG', fr: 'Ouganda', en: 'Uganda' },
  RW: { cc: 'RW', fr: 'Rwanda', en: 'Rwanda' },
  ET: { cc: 'ET', fr: 'Éthiopie', en: 'Ethiopia' },
  GH: { cc: 'GH', fr: 'Ghana', en: 'Ghana' },
  NG: { cc: 'NG', fr: 'Nigeria', en: 'Nigeria' },
  SN: { cc: 'SN', fr: 'Sénégal', en: 'Senegal' },
  CI: { cc: 'CI', fr: "Côte d'Ivoire", en: 'Ivory Coast' },
  NA: { cc: 'NA', fr: 'Namibie', en: 'Namibia' },
  BW: { cc: 'BW', fr: 'Botswana', en: 'Botswana' },
  ZW: { cc: 'ZW', fr: 'Zimbabwe', en: 'Zimbabwe' },
  ZM: { cc: 'ZM', fr: 'Zambie', en: 'Zambia' },
  MZ: { cc: 'MZ', fr: 'Mozambique', en: 'Mozambique' },
  MG: { cc: 'MG', fr: 'Madagascar', en: 'Madagascar' },
  MU: { cc: 'MU', fr: 'Maurice', en: 'Mauritius' },
  SC: { cc: 'SC', fr: 'Seychelles', en: 'Seychelles' },
  CV: { cc: 'CV', fr: 'Cap-Vert', en: 'Cape Verde' },
  RE: { cc: 'RE', fr: 'La Réunion', en: 'Réunion' },
  YT: { cc: 'YT', fr: 'Mayotte', en: 'Mayotte' },
  KM: { cc: 'KM', fr: 'Comores', en: 'Comoros' },
  DJ: { cc: 'DJ', fr: 'Djibouti', en: 'Djibouti' },

  // Oceania
  AU: { cc: 'AU', fr: 'Australie', en: 'Australia' },
  NZ: { cc: 'NZ', fr: 'Nouvelle-Zélande', en: 'New Zealand' },
  FJ: { cc: 'FJ', fr: 'Fidji', en: 'Fiji' },
  PF: { cc: 'PF', fr: 'Polynésie française', en: 'French Polynesia' },
  NC: { cc: 'NC', fr: 'Nouvelle-Calédonie', en: 'New Caledonia' },
  VU: { cc: 'VU', fr: 'Vanuatu', en: 'Vanuatu' },
  WS: { cc: 'WS', fr: 'Samoa', en: 'Samoa' },
  TO: { cc: 'TO', fr: 'Tonga', en: 'Tonga' },
  PG: { cc: 'PG', fr: 'Papouasie-Nouvelle-Guinée', en: 'Papua New Guinea' },

  // British overseas territories that ship as "UK Territory" in source
  BM: { cc: 'BM', fr: 'Bermudes', en: 'Bermuda' },
  GI: { cc: 'GI', fr: 'Gibraltar', en: 'Gibraltar' },
};

/**
 * All known label spellings (English, French, common abbreviations)
 * mapped to their canonical ISO code. Lower-cased + accent-stripped
 * keys are matched in `resolveCountry`.
 */
const LABEL_TO_CC: Readonly<Record<string, string>> = {
  // Variants observed in source Excels
  usa: 'US',
  'united states': 'US',
  'etats-unis': 'US',
  us: 'US',
  uk: 'GB',
  'united kingdom': 'GB',
  'royaume-uni': 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  italy: 'IT',
  italie: 'IT',
  france: 'FR',
  spain: 'ES',
  espagne: 'ES',
  germany: 'DE',
  allemagne: 'DE',
  switzerland: 'CH',
  suisse: 'CH',
  austria: 'AT',
  autriche: 'AT',
  portugal: 'PT',
  greece: 'GR',
  grece: 'GR',
  turkey: 'TR',
  turquie: 'TR',
  'czech republic': 'CZ',
  tchequie: 'CZ',
  'rep. tcheque': 'CZ',
  czechia: 'CZ',
  hungary: 'HU',
  hongrie: 'HU',
  poland: 'PL',
  pologne: 'PL',
  croatia: 'HR',
  croatie: 'HR',
  slovenia: 'SI',
  slovenie: 'SI',
  slovakia: 'SK',
  slovaquie: 'SK',
  bulgaria: 'BG',
  bulgarie: 'BG',
  romania: 'RO',
  roumanie: 'RO',
  serbia: 'RS',
  serbie: 'RS',
  montenegro: 'ME',
  albania: 'AL',
  albanie: 'AL',
  ireland: 'IE',
  irlande: 'IE',
  netherlands: 'NL',
  'pays-bas': 'NL',
  belgium: 'BE',
  belgique: 'BE',
  luxembourg: 'LU',
  denmark: 'DK',
  danemark: 'DK',
  norway: 'NO',
  norvege: 'NO',
  sweden: 'SE',
  suede: 'SE',
  finland: 'FI',
  finlande: 'FI',
  iceland: 'IS',
  islande: 'IS',
  latvia: 'LV',
  lettonie: 'LV',
  lithuania: 'LT',
  lituanie: 'LT',
  estonia: 'EE',
  estonie: 'EE',
  russia: 'RU',
  russie: 'RU',
  ukraine: 'UA',
  malta: 'MT',
  malte: 'MT',
  monaco: 'MC',
  liechtenstein: 'LI',
  kazakhstan: 'KZ',
  azerbaijan: 'AZ',
  azerbaidjan: 'AZ',
  andorre: 'AD',
  andorra: 'AD',
  chypre: 'CY',
  cyprus: 'CY',
  'rep. dominicaine': 'DO',
  'rep dominicaine': 'DO',
  georgia: 'GE',
  georgie: 'GE',
  armenia: 'AM',
  armenie: 'AM',

  // North America
  canada: 'CA',
  mexico: 'MX',
  mexique: 'MX',

  // Asia
  china: 'CN',
  chine: 'CN',
  japan: 'JP',
  japon: 'JP',
  'south korea': 'KR',
  'coree du sud': 'KR',
  coree: 'KR',
  'hong kong': 'HK',
  macau: 'MO',
  macao: 'MO',
  taiwan: 'TW',
  'taiwan ': 'TW',
  thailand: 'TH',
  thailande: 'TH',
  vietnam: 'VN',
  'viet nam': 'VN',
  'vietnam ': 'VN',
  indonesia: 'ID',
  indonesie: 'ID',
  malaysia: 'MY',
  malaisie: 'MY',
  singapore: 'SG',
  singapour: 'SG',
  philippines: 'PH',
  cambodia: 'KH',
  cambodge: 'KH',
  laos: 'LA',
  myanmar: 'MM',
  birmanie: 'MM',
  india: 'IN',
  inde: 'IN',
  'sri lanka': 'LK',
  nepal: 'NP',
  bhutan: 'BT',
  bhoutan: 'BT',
  maldives: 'MV',
  mongolia: 'MN',
  mongolie: 'MN',

  // Middle East
  uae: 'AE',
  'united arab emirates': 'AE',
  'emirats arabes unis': 'AE',
  'saudi arabia': 'SA',
  'arabie saoudite': 'SA',
  qatar: 'QA',
  bahrain: 'BH',
  bahrein: 'BH',
  kuwait: 'KW',
  koweit: 'KW',
  oman: 'OM',
  jordan: 'JO',
  jordanie: 'JO',
  lebanon: 'LB',
  liban: 'LB',
  israel: 'IL',
  iran: 'IR',
  iraq: 'IQ',
  irak: 'IQ',

  // Africa
  morocco: 'MA',
  maroc: 'MA',
  tunisia: 'TN',
  tunisie: 'TN',
  algeria: 'DZ',
  algerie: 'DZ',
  egypt: 'EG',
  egypte: 'EG',
  'south africa': 'ZA',
  'afrique du sud': 'ZA',
  kenya: 'KE',
  tanzania: 'TZ',
  tanzanie: 'TZ',
  uganda: 'UG',
  rwanda: 'RW',
  ethiopia: 'ET',
  ethiopie: 'ET',
  ghana: 'GH',
  nigeria: 'NG',
  senegal: 'SN',
  namibia: 'NA',
  namibie: 'NA',
  botswana: 'BW',
  zimbabwe: 'ZW',
  zambia: 'ZM',
  zambie: 'ZM',
  mozambique: 'MZ',
  madagascar: 'MG',
  mauritius: 'MU',
  maurice: 'MU',
  seychelles: 'SC',
  'cape verde': 'CV',
  'cap-vert': 'CV',
  reunion: 'RE',
  'la reunion': 'RE',
  djibouti: 'DJ',

  // Oceania
  australia: 'AU',
  australie: 'AU',
  'new zealand': 'NZ',
  'nouvelle-zelande': 'NZ',
  fiji: 'FJ',
  fidji: 'FJ',
  'french polynesia': 'PF',
  'polynesie francaise': 'PF',
  'new caledonia': 'NC',
  'nouvelle-caledonie': 'NC',
  vanuatu: 'VU',
  samoa: 'WS',
  tonga: 'TO',
  'papua new guinea': 'PG',

  // Caribbean specific
  cuba: 'CU',
  bahamas: 'BS',
  'dominican republic': 'DO',
  'republique dominicaine': 'DO',
  jamaica: 'JM',
  jamaique: 'JM',
  'puerto rico': 'PR',
  'turks & caicos': 'TC',
  'turks and caicos': 'TC',
  'iles turques-et-caiques': 'TC',
  'cayman islands': 'KY',
  'iles caimans': 'KY',
  anguilla: 'AI',
  antigua: 'AG',
  'antigua-et-barbuda': 'AG',
  'antigua and barbuda': 'AG',
  barbados: 'BB',
  barbade: 'BB',
  grenada: 'GD',
  grenade: 'GD',
  'saint lucia': 'LC',
  'sainte-lucie': 'LC',
  'st lucia': 'LC',
  'saint vincent & grenadines': 'VC',
  'saint vincent and the grenadines': 'VC',
  dominica: 'DM',
  dominique: 'DM',
  aruba: 'AW',
  curacao: 'CW',
  'us virgin islands': 'VI',
  'iles vierges des etats-unis': 'VI',
  'british virgin islands': 'VG',
  'iles vierges britanniques': 'VG',
  martinique: 'MQ',
  guadeloupe: 'GP',
  'saint-barthelemy': 'BL',
  'saint barthelemy': 'BL',
  'st barths': 'BL',
  'saint-martin': 'MF',
  'saint martin': 'MF',

  // Central America
  belize: 'BZ',
  'costa rica': 'CR',
  panama: 'PA',
  guatemala: 'GT',
  nicaragua: 'NI',
  honduras: 'HN',
  'el salvador': 'SV',

  // South America
  argentina: 'AR',
  argentine: 'AR',
  brazil: 'BR',
  bresil: 'BR',
  chile: 'CL',
  chili: 'CL',
  peru: 'PE',
  perou: 'PE',
  colombia: 'CO',
  colombie: 'CO',
  ecuador: 'EC',
  equateur: 'EC',
  uruguay: 'UY',
  paraguay: 'PY',
  bolivia: 'BO',
  bolivie: 'BO',
  venezuela: 'VE',
  guyana: 'GY',
  suriname: 'SR',

  // British overseas territories
  bermuda: 'BM',
  bermudes: 'BM',
  gibraltar: 'GI',
};

/**
 * City-aware territory overrides — when the source country label is
 * ambiguous (e.g. "UK Territory", "Caribbean", "Antilles françaises"),
 * we derive the ISO code from the city name.
 */
const CITY_TO_CC: Readonly<Record<string, string>> = {
  // UK Territory mostly = Bermuda or Gibraltar
  hamilton: 'BM',
  southampton: 'BM',
  tucker: 'BM',
  bermuda: 'BM',
  // Caribbean → resolve via island
  havana: 'CU',
  varadero: 'CU',
  nassau: 'BS',
  exuma: 'BS',
  paradise_island: 'BS',
  'paradise island': 'BS',
  'punta cana': 'DO',
  santo_domingo: 'DO',
  'santo domingo': 'DO',
  'la romana': 'DO',
  // French Caribbean
  'saint-barthelemy': 'BL',
  'saint barthelemy': 'BL',
  'st-barth': 'BL',
  'st barth': 'BL',
  'st-barths': 'BL',
  gustavia: 'BL',
  'st-jean': 'BL',
  'fort-de-france': 'MQ',
  'pointe-a-pitre': 'GP',
  'le marigot': 'MF',
  marigot: 'MF',
  // US Virgin Islands
  'saint thomas': 'VI',
  'st. thomas': 'VI',
  'saint john': 'VI',
  // British Virgin
  tortola: 'VG',
  // Cayman
  'grand cayman': 'KY',
  georgetown: 'KY',
  // Turks & Caicos
  providenciales: 'TC',
  'pine cay': 'TC',
  // Aruba / Curaçao
  oranjestad: 'AW',
  willemstad: 'CW',
  // Bermuda specifics
  'tucker town': 'BM',
  'pembroke, bermuda': 'BM',
  'southampton, bermuda': 'BM',
  // Anguilla
  anguilla: 'AI',
  // Turks and Caicos via long-form text
  'turks and caicos': 'TC',
  // Puerto Rico (USA Territory)
  'puerto rico': 'PR',
  'san juan': 'PR',
  // Saint Kitts & Nevis
  nevis: 'KN',
  basseterre: 'KN',
  charlestown: 'KN',
  // Caraïbes — sub-island fallbacks
  'sainte-lucie': 'LC',
  'sainte lucie': 'LC',
  'saint-lucie': 'LC',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function resolveCountry(
  countryLabel: string | null | undefined,
  cityLabel?: string | null,
): CountryMeta | null {
  if (!countryLabel) return null;
  const norm = normalize(countryLabel);
  // Direct hit
  const direct = LABEL_TO_CC[norm];
  if (direct) {
    const meta = CANONICAL[direct];
    return meta ?? null;
  }
  // Already a 2-letter code?
  if (/^[a-z]{2}$/i.test(norm.toUpperCase())) {
    const meta = CANONICAL[norm.toUpperCase()];
    if (meta) return meta;
  }
  // Territory keywords + city fallback
  if (
    /uk territory|us(a)? territory|caribbean|caraibes|antilles francaises|west indies|asia.pacific|multiple/.test(
      norm,
    )
  ) {
    if (cityLabel) {
      const cnorm = normalize(cityLabel);
      const cc = CITY_TO_CC[cnorm];
      if (cc) {
        const meta = CANONICAL[cc];
        if (meta) return meta;
      }
    }
    return null; // unmapped, caller decides
  }
  return null;
}

export function getCountryByCode(cc: string): CountryMeta | null {
  return CANONICAL[cc.toUpperCase()] ?? null;
}
