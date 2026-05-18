/**
 * Deterministic lexical linter for the editorial pipeline.
 *
 * Scans markdown text for banned terms / patterns from docs/editorial/style-guide.md
 * §4 (lexique interdit) and §5 (patterns syntaxiques interdits). Returns a flat list
 * of violations with line numbers, snippets, and severity.
 *
 * 100% deterministic. Used after Pass 5 to feed Pass 6 (linter-fixer) with exact
 * occurrences to patch. Much more reliable than asking the LLM to self-check.
 */

export type ViolationCategory =
  | 'A_cliche_premium'
  | 'A_bis_marketing'
  | 'B_opening'
  | 'C_adverbe_faible'
  | 'D_verbe_ia'
  | 'E_marketing_creux'
  | 'F_hyperbole_vide'
  | 'G_adjectif_creux_limite'
  | 'H_supplement'
  | 'pattern_definitionnel'
  | 'pattern_enumeration'
  | 'pattern_comparaison_faible'
  | 'pattern_conclusion_paresseuse'
  | 'pattern_fausse_question'
  | 'pattern_participe_present_attaque'
  | 'lead_length'
  | 'sentence_length';

export type ViolationSeverity = 'blocker' | 'high' | 'medium' | 'low';

export interface Violation {
  readonly category: ViolationCategory;
  readonly severity: ViolationSeverity;
  readonly term: string;
  readonly matchedText: string;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
  readonly suggestion: string;
}

interface BannedTerm {
  readonly term: string;
  readonly pattern: RegExp;
  readonly category: ViolationCategory;
  readonly severity: ViolationSeverity;
  readonly suggestion: string;
  readonly maxOccurrences?: number;
  readonly contextExceptions?: readonly RegExp[];
}

const A: readonly BannedTerm[] = [
  {
    term: 'incontournable',
    pattern: /\bincontournables?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion:
      'Supprimer ou remplacer par un fait précis. Ex: "première vague de distinctions Palace Atout France".',
  },
  {
    term: 'joyau',
    pattern: /\bjoyaux?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer. Si fait concret : nommer la pièce maîtresse précisément.',
  },
  {
    term: 'écrin',
    pattern: /\bécrins?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer. Le cas échéant remplacer par la matière exacte.',
  },
  {
    term: 'havre',
    pattern: /\bhavres?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer. Si abri/calme : préciser la cause concrète.',
  },
  {
    term: 'dépaysement',
    pattern: /\bdépaysements?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer ou décrire le contraste concret.',
  },
  {
    term: 'escapade',
    pattern: /\bescapades?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Remplacer par "séjour" ou "voyage de X nuits".',
  },
  {
    term: 'refuge',
    pattern: /\brefuges?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion:
      'Supprimer. Si retraite : utiliser "résidence", "retraite", "maison" selon le contexte.',
  },
  {
    term: 'bulle',
    pattern: /\bbulles? de\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'enchanteur',
    pattern: /\benchanteur|enchanteresse|enchanteurs?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'féerique',
    pattern: /\bféeriques?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'magique',
    pattern: /\bmagiques?\b/giu,
    category: 'A_cliche_premium',
    severity: 'high',
    suggestion: 'Supprimer (sauf citation directe nominée).',
  },
  {
    term: 'exceptionnel',
    pattern: /\bexceptionnels?\b|\bexceptionnelles?\b/giu,
    category: 'A_cliche_premium',
    severity: 'high',
    suggestion: 'Supprimer (sauf si attribué à une classification Atout France formelle).',
    contextExceptions: [
      /classement (?:hôtelier )?exceptionnel|classification (?:hôtelière )?exceptionnelle/iu,
    ],
  },
  {
    term: 'unique en son genre',
    pattern: /\bunique en son genre\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'comme nulle part ailleurs',
    pattern: /\bcomme nulle part ailleurs\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'harmonieuse alliance',
    pattern: /\bharmonieuses?\s+alliances?\b/giu,
    category: 'A_cliche_premium',
    severity: 'blocker',
    suggestion: 'Réécrire en pointant la nature concrète de la combinaison.',
  },
];

const A_BIS: readonly BannedTerm[] = [
  {
    term: 'must',
    pattern: /\b(un|le|les)\s+must\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer ou remplacer par "à recommander absolument".',
  },
  {
    term: 'spot',
    pattern: /\b(un|le|les|notre)\s+spot\b/giu,
    category: 'A_bis_marketing',
    severity: 'high',
    suggestion: 'Remplacer par "lieu", "emplacement", "adresse".',
  },
  {
    term: 'adresse confidentielle',
    pattern: /\badresse\s+confidentielle\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'secret bien gardé',
    pattern: /\bsecret bien gardé\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'coup de cœur',
    pattern: /\bcoup de cœur\b/giu,
    category: 'A_bis_marketing',
    severity: 'high',
    suggestion: 'Supprimer (sauf attribué : "le coup de cœur de Léa, conseillère senior Paris").',
  },
  {
    term: 'classique indémodable',
    pattern: /\bclassiques?\s+indémodables?\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'atmosphère feutrée',
    pattern: /\batmosphères?\s+feutrées?\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer ou décrire la matière concrète.',
  },
  {
    term: 'ambiance feutrée',
    pattern: /\bambiances?\s+feutrées?\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'cocon',
    pattern: /\bcocons?\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'sanctuaire',
    pattern: /\bsanctuaires?\b/giu,
    category: 'A_bis_marketing',
    severity: 'high',
    suggestion: 'Supprimer (sauf au sens propre : "le sanctuaire fut consacré en...").',
  },
  {
    term: 'temple (figuré)',
    pattern: /\btemples?\s+(?:du\s+\w+|de\s+la\s+\w+)\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'quintessence',
    pattern: /\bquintessences?\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'crème de la crème',
    pattern: /\bcrème de la crème\b/giu,
    category: 'A_bis_marketing',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
];

const B_OPENINGS: readonly BannedTerm[] = [
  {
    term: 'Niché au cœur de',
    pattern: /^(\s*)niché[se]?\s+au\s+cœur\s+de\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire avec une attaque factuelle.',
  },
  {
    term: 'Niché entre',
    pattern: /^(\s*)niché[se]?\s+entre\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire.',
  },
  {
    term: 'Au cœur battant de',
    pattern: /\bau\s+cœur\s+battant\s+de\b/giu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire.',
  },
  {
    term: 'Au cœur de',
    pattern: /^(\s*)au\s+cœur\s+de\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire avec une attaque factuelle.',
  },
  {
    term: 'Découvrez',
    pattern: /^(\s*)découvrez\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Mode injonctif marketing — réécrire au déclaratif.',
  },
  {
    term: 'Plongez dans',
    pattern: /^(\s*)plongez\s+dans\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Mode injonctif — réécrire.',
  },
  {
    term: 'Bienvenue dans',
    pattern: /^(\s*)bienvenue\s+dans\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire.',
  },
  {
    term: 'Laissez-vous porter',
    pattern: /^(\s*)laissez-vous\s+porter\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire.',
  },
  {
    term: 'Laissez-vous séduire',
    pattern: /^(\s*)laissez-vous\s+séduire\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Réécrire.',
  },
  {
    term: 'Imaginez',
    pattern: /^(\s*)imaginez\b/imu,
    category: 'B_opening',
    severity: 'blocker',
    suggestion: 'Mode injonctif imaginaire — réécrire au descriptif factuel.',
  },
];

const C: readonly BannedTerm[] = [
  {
    term: 'véritablement',
    pattern: /\bvéritablement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'particulièrement',
    pattern: /\bparticulièrement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'medium',
    suggestion: 'Supprimer (sauf factuel précis : "particulièrement bien noté par Michelin").',
  },
  {
    term: 'notablement',
    pattern: /\bnotablement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'remarquablement',
    pattern: /\bremarquablement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'harmonieusement',
    pattern: /\bharmonieusement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'subtilement',
    pattern: /\bsubtilement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'medium',
    suggestion: 'Supprimer (sauf factuel : "subtilement épicé").',
  },
  {
    term: 'élégamment',
    pattern: /\bélégamment\b/giu,
    category: 'C_adverbe_faible',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'divinement',
    pattern: /\bdivinement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'sublimement',
    pattern: /\bsublimement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'merveilleusement',
    pattern: /\bmerveilleusement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'magnifiquement',
    pattern: /\bmagnifiquement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'royalement',
    pattern: /\broyalement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'résolument',
    pattern: /\brésolument\b/giu,
    category: 'C_adverbe_faible',
    severity: 'medium',
    suggestion: 'Supprimer.',
  },
  {
    term: 'définitivement',
    pattern: /\bdéfinitivement\b/giu,
    category: 'C_adverbe_faible',
    severity: 'medium',
    suggestion: 'Supprimer.',
  },
  {
    term: 'assurément',
    pattern: /\bassurément\b/giu,
    category: 'C_adverbe_faible',
    severity: 'medium',
    suggestion: 'Supprimer.',
  },
];

const D: readonly BannedTerm[] = [
  {
    term: 'se dresse fièrement',
    pattern: /\bse\s+dresse\s+fièrement\b/giu,
    category: 'D_verbe_ia',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'se dresse',
    pattern: /\bse\s+dresse\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion:
      'Remplacer par un verbe neutre : "se trouve", "occupe", "domine" (au sens géographique précis).',
  },
  {
    term: "s'inscrit dans",
    pattern: /\bs['']inscrit\s+dans\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion: 'Remplacer par "appartient à", "fait partie de".',
  },
  {
    term: "s'inscrit comme",
    pattern: /\bs['']inscrit\s+comme\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion: 'Remplacer par "constitue", "représente" (avec parcimonie).',
  },
  {
    term: 'rayonne par',
    pattern: /\brayonne\s+par\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion: 'Supprimer ou réécrire factuellement.',
  },
  {
    term: 'marie subtilement',
    pattern: /\bmarie\s+subtilement\b/giu,
    category: 'D_verbe_ia',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: "s'illustre par",
    pattern: /\bs['']illustre\s+par\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion: 'Remplacer par "se caractérise par" (max 1 fois) ou décrire directement.',
  },
  {
    term: 'se distingue par',
    pattern: /\bse\s+distingue\s+par\b/giu,
    category: 'D_verbe_ia',
    severity: 'medium',
    suggestion: 'Remplacer par une description directe.',
  },
  {
    term: 'incarne',
    pattern: /\bincarne(?:nt|ra|rait|raient)?\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion: 'Remplacer par "représente", "illustre", ou réécrire en factuel.',
  },
  {
    term: 'embrasse (figuré)',
    pattern: /\bembrasse(?:nt)?\s+(?:la\s+mer|l['']horizon|le\s+paysage|le\s+ciel)\b/giu,
    category: 'D_verbe_ia',
    severity: 'high',
    suggestion: 'Réécrire : "donne sur", "fait face à", "surplombe".',
  },
  {
    term: "s'impose (figuré)",
    pattern: /\bs['']impose\s+(?:comme|en)\b/giu,
    category: 'D_verbe_ia',
    severity: 'medium',
    suggestion: 'Réécrire en factuel.',
  },
];

const E: readonly BannedTerm[] = [
  {
    term: 'art de recevoir',
    pattern: /\bart\s+de\s+recevoir\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'art de vivre',
    pattern: /\bart\s+de\s+vivre\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer (sauf citation directe attribuée).',
  },
  {
    term: 'savoir-faire ancestral',
    pattern: /\bsavoir-faire\s+ancestral\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: "savoir-faire d'exception",
    pattern: /\bsavoir-faire\s+d['']exception\b/giu,
    category: 'E_marketing_creux',
    severity: 'high',
    suggestion: 'Supprimer ou détailler.',
  },
  {
    term: 'raffinement à la française',
    pattern: /\braffinement\s+à\s+la\s+française\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'douceur de vivre',
    pattern: /\bdouceur\s+de\s+vivre\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'élégance intemporelle',
    pattern: /\bélégance\s+intemporelle\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'charme désuet',
    pattern: /\bcharme\s+désuet\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'charme intemporel',
    pattern: /\bcharme\s+intemporel\b/giu,
    category: 'E_marketing_creux',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'art du cocktail',
    pattern: /\bart\s+du\s+cocktail\b/giu,
    category: 'E_marketing_creux',
    severity: 'high',
    suggestion: 'Remplacer par "carte de cocktails signature" ou similaire.',
  },
];

const F: readonly BannedTerm[] = [
  {
    term: 'spectacle grandiose',
    pattern: /\bspectacles?\s+grandioses?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'vue imprenable',
    pattern: /\bvues?\s+imprenables?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'high',
    suggestion: "Décrire ce que l'on voit précisément (Tour Eiffel à 750 m, etc.).",
  },
  {
    term: 'vue spectaculaire',
    pattern: /\bvues?\s+spectaculaires?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'high',
    suggestion: "Décrire ce que l'on voit.",
  },
  {
    term: 'vue exceptionnelle',
    pattern: /\bvues?\s+exceptionnelles?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'medium',
    suggestion: "Décrire l'angle, le cadrage, la distance.",
  },
  {
    term: 'panorama imprenable',
    pattern: /\bpanoramas?\s+imprenables?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'high',
    suggestion: 'Décrire.',
  },
  {
    term: 'panorama à couper le souffle',
    pattern: /\bpanoramas?\s+à\s+couper\s+le\s+souffle\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'expérience inoubliable',
    pattern: /\bexpériences?\s+inoubliables?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'expérience unique',
    pattern: /\bexpériences?\s+uniques?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'high',
    suggestion: 'Décrire la spécificité concrète.',
  },
  {
    term: "moment d'éternité",
    pattern: /\bmoments?\s+d['']éternité\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'cadre idyllique',
    pattern: /\bcadres?\s+idylliques?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'cadre enchanteur',
    pattern: /\bcadres?\s+enchanteurs?\b/giu,
    category: 'F_hyperbole_vide',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
];

const G_LIMITED: readonly BannedTerm[] = [
  {
    term: 'iconique',
    pattern: /\biconiques?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'medium',
    suggestion: 'Max 1 occurrence par fiche. Au-delà : supprimer ou remplacer.',
    maxOccurrences: 1,
  },
  {
    term: 'emblématique',
    pattern: /\bemblématiques?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'medium',
    suggestion: 'Max 1 occurrence par fiche. Au-delà : supprimer ou remplacer.',
    maxOccurrences: 1,
  },
  {
    term: 'magnifique',
    pattern: /\bmagnifiques?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'high',
    suggestion: 'Supprimer ou décrire concrètement.',
  },
  {
    term: 'magnifié',
    pattern: /\bmagnifiés?\b|\bmagnifiées?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'magistral',
    pattern: /\bmagistral(?:e|es|ement)?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'high',
    suggestion: 'Supprimer ou décrire le fait précis.',
  },
  {
    term: 'grandiose',
    pattern: /\bgrandioses?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'high',
    suggestion: 'Supprimer ou détailler.',
  },
  {
    term: 'prestigieux',
    pattern: /\bprestigieux\b|\bprestigieuses?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'medium',
    suggestion:
      'Conserver UNIQUEMENT si attribué à une institution établie ("le prestigieux Guide Michelin", "label Palace prestigieux décerné par Atout France").',
    contextExceptions: [
      /prestigieux?\s+guide\s+michelin|prestigieuse?\s+étoile/iu,
      // Atout France / Palace distinction — the institutional context
      // justifies the qualifier (it's a formal label, not marketing
      // fluff). Allow the term when "Atout France" appears in the
      // surrounding window.
      /atout\s+france/iu,
      // Relais & Châteaux is an official association, same rationale.
      /relais\s+(?:&|et)\s+châteaux/iu,
    ],
  },
  {
    term: 'mythique',
    pattern: /\bmythiques?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'medium',
    suggestion: 'Supprimer (sauf citation directe).',
  },
  {
    term: 'sublime',
    pattern: /\bsublimes?\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'high',
    suggestion: 'Supprimer (verbe et adjectif au sens marketing).',
  },
  {
    term: 'épitomé',
    pattern: /\bépitomé\b/giu,
    category: 'G_adjectif_creux_limite',
    severity: 'medium',
    suggestion: 'Mot précieux gallicisme — remplacer par "exemple", "incarnation", ou réécrire.',
  },
];

const H_SUPPLEMENT: readonly BannedTerm[] = [
  {
    term: 'sublimé (participe)',
    pattern: /\bsublim(?:é|ée|és|ées)\b/giu,
    category: 'H_supplement',
    severity: 'high',
    suggestion:
      'Supprimer. Remplacer par un verbe factuel : "modernisé", "rénové", "préservé", "mis en valeur" selon le contexte.',
  },
  {
    term: 'ode à',
    pattern: /\bode[s]?\s+(?:à|aux)\b/giu,
    category: 'H_supplement',
    severity: 'high',
    suggestion: 'Supprimer. Réécrire factuellement.',
  },
  {
    term: 'trésors de',
    pattern:
      /\btrésors?\s+de\s+(?:la\s+|l['']\s*)?(?:gastronomie|cuisine|patrimoine|cellier|cave|jardin)/giu,
    category: 'H_supplement',
    severity: 'medium',
    suggestion: 'Supprimer ou remplacer par "le patrimoine de", "les classiques de".',
  },
  {
    term: 'niché (participe)',
    pattern: /\bnich(?:é|ée|és|ées)\b/giu,
    category: 'H_supplement',
    severity: 'high',
    suggestion:
      'Supprimer ce participe figé. Remplacer par "située", "installée", "implantée", "logée" selon le contexte précis.',
  },
  {
    term: "chef-d'œuvre",
    pattern: /\bchefs?[\s-]d['']œuvre\b/giu,
    category: 'H_supplement',
    severity: 'medium',
    suggestion:
      'Supprimer (sauf citation Patrimoine UNESCO formel). Décrire le fait architectural.',
  },
  {
    term: 'cœur battant',
    pattern: /\bcœur\s+battant\b/giu,
    category: 'H_supplement',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'véritable (figuré)',
    pattern:
      /\bvéritables?\s+(?:joyau|écrin|symphonie|ode|chef-d['']œuvre|art|institution|expérience|trésor)/giu,
    category: 'H_supplement',
    severity: 'high',
    suggestion: 'Supprimer l\'amplificateur "véritable" + remplacer le nom figuré.',
  },
  {
    term: "épicentre de l'élégance",
    pattern: /\bépicentre\s+de\s+l['']élégance\b/giu,
    category: 'H_supplement',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
  {
    term: 'cantine emblématique',
    pattern: /\bcantines?\s+emblématiques?\b/giu,
    category: 'H_supplement',
    severity: 'medium',
    suggestion:
      'Préciser le nom et la date : "Le Relais Plaza, brasserie Art déco ouverte en 1936".',
  },
];

const PATTERNS: readonly BannedTerm[] = [
  {
    term: "X, c'est Y",
    pattern: /,\s*c['']est\s+(?:avant\s+tout\s+)?(?:un|une|le|la|les)\s+/giu,
    category: 'pattern_definitionnel',
    severity: 'medium',
    suggestion: 'Réécrire en proposition principale active.',
  },
  {
    term: 'Pas seulement X, mais aussi Y',
    pattern: /\bpas\s+seulement\s+\w+(?:[^,]+)?,?\s+mais\s+aussi\b/giu,
    category: 'pattern_definitionnel',
    severity: 'medium',
    suggestion: 'Réécrire.',
  },
  {
    term: "Plus qu'un X, Y",
    pattern: /\bplus\s+qu['']un[e]?\s+\w+,\s+/giu,
    category: 'pattern_definitionnel',
    severity: 'medium',
    suggestion: 'Réécrire.',
  },
  {
    term: "À l'image de",
    pattern: /\bà\s+l['']image\s+de\b/giu,
    category: 'pattern_comparaison_faible',
    severity: 'medium',
    suggestion: 'Supprimer ou choisir une comparaison concrète.',
  },
  {
    term: 'Telle une',
    pattern: /^\s*telle?\s+une?\b/imu,
    category: 'pattern_comparaison_faible',
    severity: 'medium',
    suggestion: 'Réécrire.',
  },
  {
    term: 'En définitive',
    pattern: /^\s*en\s+définitive\b/imu,
    category: 'pattern_conclusion_paresseuse',
    severity: 'medium',
    suggestion: 'Supprimer.',
  },
  {
    term: 'Une chose est sûre',
    pattern: /\bune\s+chose\s+est\s+sûre\b/giu,
    category: 'pattern_conclusion_paresseuse',
    severity: 'medium',
    suggestion: 'Supprimer.',
  },
  {
    term: 'Pas de doute',
    pattern: /\bpas\s+de\s+doute\b/giu,
    category: 'pattern_conclusion_paresseuse',
    severity: 'medium',
    suggestion: 'Supprimer.',
  },
  {
    term: 'Au final',
    pattern: /^\s*au\s+final\b/imu,
    category: 'pattern_conclusion_paresseuse',
    severity: 'medium',
    suggestion: 'Supprimer ou remplacer par "Pour conclure".',
  },
  {
    term: 'Comment ne pas être séduit',
    pattern: /\bcomment\s+ne\s+pas\s+être\s+séduit\b/giu,
    category: 'pattern_fausse_question',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'Qui ne rêverait pas',
    pattern: /\bqui\s+ne\s+rêverait\s+pas\b/giu,
    category: 'pattern_fausse_question',
    severity: 'blocker',
    suggestion: 'Supprimer.',
  },
  {
    term: 'Comment résister',
    pattern: /\bcomment\s+résister\b/giu,
    category: 'pattern_fausse_question',
    severity: 'high',
    suggestion: 'Supprimer.',
  },
];

const ALL_TERMS: readonly BannedTerm[] = [
  ...A,
  ...A_BIS,
  ...B_OPENINGS,
  ...C,
  ...D,
  ...E,
  ...F,
  ...G_LIMITED,
  ...H_SUPPLEMENT,
  ...PATTERNS,
];

const PARAGRAPH_BREAK = /\n\s*\n/;
const PARTICIPE_PRESENT_ATTACK =
  /^([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÇ][a-zàâäéèêëîïôöùûüÿç]+(?:ant|ante|ants|antes))\s*[,—\u2014]/u;
const HEADING_PREFIX = /^#{1,6}\s/;

function lintParticipePresentAttack(text: string): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split(/\r?\n/);
  const paragraphs: { startLine: number; lines: string[] }[] = [];
  let current: { startLine: number; lines: string[] } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed === '') {
      if (current) {
        paragraphs.push(current);
        current = null;
      }
      continue;
    }
    if (HEADING_PREFIX.test(trimmed)) {
      if (current) {
        paragraphs.push(current);
        current = null;
      }
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('> ')) {
      if (current) {
        paragraphs.push(current);
        current = null;
      }
      continue;
    }
    if (current === null) current = { startLine: i + 1, lines: [line] };
    else current.lines.push(line);
  }
  if (current) paragraphs.push(current);

  for (const p of paragraphs) {
    const firstLine = p.lines[0] ?? '';
    const match = firstLine.match(PARTICIPE_PRESENT_ATTACK);
    if (match && match[1]) {
      const lowered = match[1].toLowerCase();
      const allowList = new Set([
        'avant',
        'devant',
        'pendant',
        'durant',
        'partant',
        'pourtant',
        'cependant',
        'maintenant',
      ]);
      if (allowList.has(lowered)) continue;
      violations.push({
        category: 'pattern_participe_present_attaque',
        severity: 'high',
        term: 'participe présent en attaque',
        matchedText: match[1],
        line: p.startLine,
        column: firstLine.indexOf(match[1]),
        snippet:
          firstLine.slice(0, Math.min(firstLine.length, 80)) + (firstLine.length > 80 ? '…' : ''),
        suggestion:
          'Réécrire la phrase principale au verbe principal. Ex: "Polyglotte et formée à l\'excellence, l\'équipe..." → "L\'équipe parle neuf langues et a été formée à l\'excellence."',
      });
    }
  }
  return violations;
}

function extractLead(text: string): { lead: string; line: number } | null {
  const lines = text.split(/\r?\n/);
  let h1Index = -1;
  let h2Index = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (h1Index === -1 && /^#\s+/.test(line)) {
      h1Index = i;
      continue;
    }
    if (h1Index >= 0 && /^##\s+/.test(line)) {
      h2Index = i;
      break;
    }
  }
  if (h1Index === -1 || h2Index === -1) return null;
  const lead = lines
    .slice(h1Index + 1, h2Index)
    .join(' ')
    .trim();
  return { lead, line: h1Index + 2 };
}

function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => w.length > 0 && /[\p{L}\p{N}]/u.test(w)).length;
}

function lintLeadLength(text: string, minWords = 80, maxWords = 120): Violation[] {
  const extracted = extractLead(text);
  if (!extracted) return [];
  const wordCount = countWords(extracted.lead);
  if (wordCount >= minWords && wordCount <= maxWords) return [];
  const isShort = wordCount < minWords;
  return [
    {
      category: 'lead_length',
      severity: isShort ? 'medium' : 'low',
      term: 'Longueur du lead',
      matchedText: `${wordCount} mots`,
      line: extracted.line,
      column: 0,
      snippet: extracted.lead.slice(0, 120) + (extracted.lead.length > 120 ? '…' : ''),
      suggestion: isShort
        ? `Lead trop court (${wordCount} mots). Étendre à 80-120 mots en ajoutant 1-2 détails sensoriels ANCRÉS dans le brief (signature_features, architecture, dining iconique) — surtout pas en répétant les mêmes idées.`
        : `Lead trop long (${wordCount} mots). Resserrer à 80-120 mots en supprimant les redondances et les passages génériques.`,
    },
  ];
}

/**
 * Voix Concierge — ADR-0011 §C2.
 *
 * Strict rule: aucune phrase prose ne dépasse 25 mots. Tolerance 0 — toute
 * phrase au-delà est `medium` (pas bloquant : on laisse Pass 5/6 corriger
 * mais on signale). Les titres (`#`, `##`, …), listes (`- `, `* `, `1. `),
 * et blocs code sont ignorés.
 */
function lintSentenceLength(text: string, maxWords = 25): Violation[] {
  const lines = text.split(/\r?\n/);
  const out: Violation[] = [];
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    if (trimmed.length === 0) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^([-*+]\s|\d+\.\s|>\s)/.test(trimmed)) continue;
    if (/^\|/.test(trimmed)) continue;
    const sentences = trimmed.split(/(?<=[.!?…])\s+/u);
    for (const s of sentences) {
      const clean = s.replace(/^[\s>]+/, '').trim();
      if (clean.length === 0) continue;
      const words = countWords(clean);
      if (words > maxWords) {
        out.push({
          category: 'sentence_length',
          severity: 'medium',
          term: 'Phrase > 25 mots (voix Concierge)',
          matchedText: `${words} mots`,
          line: i + 1,
          column: 0,
          snippet: clean.slice(0, 140) + (clean.length > 140 ? '…' : ''),
          suggestion: `Phrase ${words} mots > 25 max (ADR-0011 §C2). Couper en 2-3 phrases courtes, voix active.`,
        });
      }
    }
  }
  return out;
}

function extractSnippet(line: string, col: number, matchLength: number): string {
  const start = Math.max(0, col - 25);
  const end = Math.min(line.length, col + matchLength + 25);
  const before = line.slice(start, col);
  const match = line.slice(col, col + matchLength);
  const after = line.slice(col + matchLength, end);
  return `${start > 0 ? '…' : ''}${before}**${match}**${after}${end < line.length ? '…' : ''}`;
}

function countOccurrencesGlobal(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  return Array.from(text.matchAll(globalPattern)).length;
}

export function lintMarkdown(text: string): Violation[] {
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [
    ...lintParticipePresentAttack(text),
    ...lintLeadLength(text),
    ...lintSentenceLength(text),
  ];

  for (const term of ALL_TERMS) {
    const totalOccurrences = countOccurrencesGlobal(text, term.pattern);
    const maxAllowed = term.maxOccurrences ?? 0;
    if (term.maxOccurrences !== undefined && totalOccurrences <= maxAllowed) {
      continue;
    }
    const startCountingFrom = term.maxOccurrences !== undefined ? maxAllowed : 0;

    let occurrenceIndex = 0;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      const lineFlags = term.pattern.flags.includes('g')
        ? term.pattern.flags
        : `${term.pattern.flags}g`;
      const lineRegex = new RegExp(term.pattern.source, lineFlags);
      let m: RegExpExecArray | null;
      while ((m = lineRegex.exec(line)) !== null) {
        occurrenceIndex++;
        if (occurrenceIndex <= startCountingFrom) continue;

        const context = line.toLowerCase();
        const isException =
          term.contextExceptions?.some((re) => {
            const idx = m!.index;
            const window = context.slice(Math.max(0, idx - 60), Math.min(context.length, idx + 60));
            return re.test(window);
          }) ?? false;
        if (isException) continue;

        violations.push({
          category: term.category,
          severity: term.severity,
          term: term.term,
          matchedText: m[0],
          line: lineIdx + 1,
          column: m.index,
          snippet: extractSnippet(line, m.index, m[0].length),
          suggestion: term.suggestion,
        });
        if (m[0].length === 0) lineRegex.lastIndex++;
      }
    }
  }

  return violations.sort((a, b) => a.line - b.line || a.column - b.column);
}

export interface LinterReport {
  readonly violations: readonly Violation[];
  readonly counts: {
    readonly total: number;
    readonly blocker: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly clean: boolean;
}

export function lintReport(text: string): LinterReport {
  const violations = lintMarkdown(text);
  const counts = {
    total: violations.length,
    blocker: violations.filter((v) => v.severity === 'blocker').length,
    high: violations.filter((v) => v.severity === 'high').length,
    medium: violations.filter((v) => v.severity === 'medium').length,
    low: violations.filter((v) => v.severity === 'low').length,
  };
  return {
    violations,
    counts,
    clean: counts.blocker === 0 && counts.high === 0,
  };
}

// ---------------------------------------------------------------------------
// WS5 phase 2 — Concierge-voice linter for *short texts* (POI / event /
// FAQ Q&A items). Re-uses the lexical banned-terms set + the ≤25 words
// sentence-length rule already battle-tested on the long-form editorial
// pipeline, but skips the markdown-specific checks (lead length,
// participe présent en attaque) that don't apply to a one-liner.
//
// Use this from the humanizer scripts to validate each LLM-generated
// item *after* Zod parsing — Zod handles the shape, the linter handles
// the editorial contract.
// ---------------------------------------------------------------------------

export function lintConciergeText(text: string): readonly Violation[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  // Upgrade sentence-length violations to `blocker` for Concierge
  // short-text. The default `medium` severity is calibrated for
  // long-form editorial markdown where a 26-word sentence is often
  // acceptable; for POI / event / FAQ rewrites the ≤ 25 mots rule
  // is hard (CDC §6, ADR-0011 §C2) — the LLM has no excuse to
  // overshoot on a single-paragraph answer.
  const violations: Violation[] = lintSentenceLength(trimmed).map(
    (v): Violation =>
      v.category === 'sentence_length' ? { ...v, severity: 'blocker' as const } : v,
  );

  // Lexical pass — same banned-terms set as `lintMarkdown`, but we
  // iterate manually here so a single line can be scanned without the
  // markdown-aware paragraph splitter.
  const lines = trimmed.split(/\r?\n/);
  for (const term of ALL_TERMS) {
    const totalOccurrences = countOccurrencesGlobal(trimmed, term.pattern);
    const maxAllowed = term.maxOccurrences ?? 0;
    if (term.maxOccurrences !== undefined && totalOccurrences <= maxAllowed) continue;
    const startCountingFrom = term.maxOccurrences !== undefined ? maxAllowed : 0;

    let occurrenceIndex = 0;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      const lineFlags = term.pattern.flags.includes('g')
        ? term.pattern.flags
        : `${term.pattern.flags}g`;
      const lineRegex = new RegExp(term.pattern.source, lineFlags);
      let m: RegExpExecArray | null;
      while ((m = lineRegex.exec(line)) !== null) {
        occurrenceIndex++;
        if (occurrenceIndex <= startCountingFrom) continue;
        const context = line.toLowerCase();
        const isException =
          term.contextExceptions?.some((re) => {
            const idx = m!.index;
            const window = context.slice(Math.max(0, idx - 60), Math.min(context.length, idx + 60));
            return re.test(window);
          }) ?? false;
        if (isException) continue;
        violations.push({
          category: term.category,
          severity: term.severity,
          term: term.term,
          matchedText: m[0],
          line: lineIdx + 1,
          column: m.index,
          snippet: extractSnippet(line, m.index, m[0].length),
          suggestion: term.suggestion,
        });
        if (m[0].length === 0) lineRegex.lastIndex++;
      }
    }
  }

  return violations.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * Compact summary used by the humanizer scripts to decide whether to
 * accept an LLM output. We accept everything except `blocker` — `high`
 * occurrences are logged but don't block, matching the long-form
 * pipeline behaviour where a Pass 6 fixer cleans them later. For short
 * Concierge items there is no Pass 6, so the humanizer surfaces the
 * counts in its runlog and a follow-up `--invalid` re-run can rewrite
 * the affected entries.
 */
export interface ConciergeLintSummary {
  readonly clean: boolean;
  readonly blocker: number;
  readonly high: number;
  readonly violations: readonly Violation[];
}

export function lintConciergeSummary(text: string): ConciergeLintSummary {
  const violations = lintConciergeText(text);
  return {
    violations,
    blocker: violations.filter((v) => v.severity === 'blocker').length,
    high: violations.filter((v) => v.severity === 'high').length,
    clean: violations.every((v) => v.severity !== 'blocker'),
  };
}
