/**
 * PO remark → automated gate mapping (wave 5 retro, 2026-06-10).
 * Single source of truth for skill `hotel-kit-rollout` Rule 6 + agent closure checks.
 */

export interface KitPoRemarkEntry {
  /** PO-facing label (French). */
  readonly remark: string;
  /** Root cause from wave 5 post-mortem. */
  readonly rootCause: string;
  /** Gate id(s) — `kit.*` or promoted CDC gate for kit slugs. */
  readonly gates: readonly string[];
  /** Walk / manual proof still required when gate is structural only. */
  readonly walkProof?: string;
}

/** Every PO remark from wave 5 + PdG pilot, locked to gates. */
export const KIT_PO_REMARK_REGISTRY: readonly KitPoRemarkEntry[] = [
  {
    remark: 'Photo manquante sur les cartes chambre',
    rootCause: 'hotel_rooms.images[] vide + pas de map curated par slug (fallback Airelles)',
    gates: [
      'kit.02.chambres_visible_have_photo',
      'kit.02.chambres_pick_has_photo',
      'kit.16.room_batch_script',
    ],
  },
  {
    remark: 'Sélection Concierge chambre invisible / absente',
    rootCause: 'pick pas en carte n°1 (slice 0,3) + ordering Airelles Gordes pour autres slugs',
    gates: [
      'kit.02.chambres_pick_first_visible',
      'kit.02.chambres_pick_slug',
      'kit.02.concierge_pick_note',
      'kit.16.room_display_module',
    ],
    walkProof: 'Screenshot #chambres — badge cc-pick sur carte 1',
  },
  {
    remark: 'Photo principale identique à une vignette galerie (mosaïque)',
    rootCause:
      'hero_image = press-1 réutilisé dans gallery_images[0] ; le gate url-only ne voyait pas les doublons sans source_url',
    gates: [
      'kit.02.hero_not_in_gallery',
      'kit.02.gallery_unique_public_id',
      'kit.02.gallery_source_url_tracked',
    ],
    walkProof: 'Screenshot mosaïque — hero ≠ 4 tuiles droite',
  },
  {
    remark: 'Hero pas une vue d’ensemble de l’établissement',
    rootCause: 'press-1 = réception ou détail chambre labelé exterior ; pas de gate catégorie hero',
    gates: ['kit.02.hero_category_exterior_or_view', 'kit.02.gallery_alt_category'],
    walkProof: 'Screenshot hero — façade ou domaine visible',
  },
  {
    remark: 'Photos chambres ne correspondent pas aux cartes',
    rootCause: 'fallback galerie index % length au lieu de map room slug → photo dédiée',
    gates: [
      'kit.02.chambres_visible_have_photo',
      'kit.16.room_batch_script',
      'kit.16.room_display_module',
    ],
    walkProof: 'Screenshot #chambres — visuel = nom de la chambre',
  },
  {
    remark: 'POI / activités / commerces — photo IA avant sourcing réel',
    rootCause: 'script POI génère poi-* IA sans Tavily/Commons/Places d’abord',
    gates: ['kit.07.poi_structural', 'gold.poi_dedicated_images', 'gold.poi_photo_structural'],
    walkProof: 'Screenshot #autour — photo reconnaissable du lieu nommé',
  },
  {
    remark: 'Photo expérience ou restaurant qui ne correspond pas au sujet',
    rootCause: 'même URL Cloudinary recyclée sur plusieurs slots ; fallback galerie générique',
    gates: [
      'kit.02.gallery_no_duplicate_source_url',
      'kit.02.gallery_source_url_tracked',
      'kit.02.gallery_alt_category',
      'kit.03.signature_experiences_dedicated_image',
      'photos.gallery_alt_category',
    ],
    walkProof: 'Screenshot #hotel-en-bref spa + resto + expériences vs labels',
  },
  {
    remark: 'FAQ trop faible (peu de questions, pas de profondeur)',
    rootCause: 'faq_content_kit = stub promote (5 items) au lieu de Perplexity 40–60',
    gates: [
      'kit.11.faq_kit_not_stub',
      'kit.11.faq_kit_count',
      'kit.11.faq_kit_has_groups',
      'cdc.11.faq_kit_count',
      'cdc.11.faq_kit_taxonomy',
    ],
    walkProof: 'DOM #faq — groupes thématiques comparables à Gordes',
  },
  {
    remark: 'FAQ Concierge (#concierge-questions) trop faible',
    rootCause: 'volume ou ton « Je réserve » ; pas de validation profondeur post-promote',
    gates: [
      'kit.11.concierge_questions_count',
      'kit.11.concierge_informative_tone',
      'kit.11.concierge_taxonomy',
      'kit.11.concierge_en_parity',
      'cdc.11.concierge_questions_count',
      'cdc.11.concierge_informative_tone',
    ],
    walkProof: 'DOM #concierge-questions — ≥20 Q&R groupées, ton informatif',
  },
  {
    remark: 'Avis Google les plus récents manquants dans #acces',
    rootCause: 'cache GMB stale ; gate passait sur google_reviews_count sans recency',
    gates: [
      'kit.10.gmb_review_count',
      'kit.10.gmb_review_recency',
      'kit.10.gmb_sync_fresh',
      'kit.10.gmb_display_triplet_fresh',
      'cdc.10.google_reviews_gmb',
    ],
    walkProof: 'Screenshot #acces — 3 avis auteur + date ≤90j',
  },
  {
    remark: 'POI sans vignette dédiée',
    rootCause: 'press-* recyclé au lieu de poi-{slug}',
    gates: [
      'gold.poi_dedicated_images',
      'gold.poi_images',
      'gold.poi_photo_structural',
      'kit.07.poi_structural',
    ],
  },
  {
    remark: 'F&B incomplet (bars fusionnés)',
    rootCause: 'venues[] sous-échantillonné vs site officiel',
    gates: ['gold.venues_all_handoff', 'gold.venues_handoff'],
  },
  {
    remark: 'Spa dossier / photo spa incorrecte',
    rootCause: 'spa_info incomplet + hero spa résolu sur mauvais slot galerie',
    gates: ['gold.spa_dossier', 'kit.02.gallery_category_spa', 'kit.02.gallery_category_dining'],
    walkProof: 'Screenshot #hotel-en-bref spa — cabine/soins, pas ferme extérieure seule',
  },
  {
    remark: '« C’est bon » sur deploy HTML sans walk PO',
    rootCause: 'acceptance = grep prod / score CDC sans gates kit.* ni screenshots',
    gates: ['kit.19.closure_audit_exit_zero'],
    walkProof: 'Rule 6 — 5 sections vs les-airelles-gordes FR+EN desktop+mobile',
  },
] as const;

export const KIT_PO_REMARK_GATE_IDS: readonly string[] = [
  ...new Set(KIT_PO_REMARK_REGISTRY.flatMap((e) => e.gates)),
];
