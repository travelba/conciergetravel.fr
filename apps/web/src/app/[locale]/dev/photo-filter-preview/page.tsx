/**
 * Internal preview page for the "signature filter" decision on hotel
 * photos. Shows 6 Le Bristol photos (the 6 highest-quality kept by the
 * OpenAI Vision probe) side-by-side with the raw delivery and 3 filter
 * variants. The PO picks the look in 2 minutes, then we lock the
 * transforms into the photo pipeline.
 *
 * Skill: photo-quality-seo-geo-agentique, photo-pipeline.
 *
 * Route: /:locale/dev/photo-filter-preview
 * Indexability: noindex,nofollow + dev-only-ish (not linked from anywhere public).
 */
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Photo filter preview — internal',
  robots: { index: false, follow: false },
};

const CLOUD_NAME = 'dvbjwh5wy';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

interface FilterVariant {
  readonly id: string;
  readonly label: string;
  readonly oneLiner: string;
  readonly transforms: string;
  readonly recommendation?: string;
}

interface SamplePhoto {
  readonly id: string;
  readonly caption: string;
  readonly altFr: string;
  readonly tier: 'top' | 'medium' | 'low';
  readonly publicId: string;
  readonly sourceLabel: string;
}

/**
 * Mix volontaire de qualités pour vraiment juger l'effet du filtre.
 *
 * - "top" : photo Google Places polish (score Vision 9/10). Référence.
 *   Si le filtre la dégrade, on l'abandonne.
 * - "medium" : photo Tripadvisor user-generated (lumière plate, cadrage
 *   moyen). C'est le cas le plus courant dans le catalogue legacy
 *   (2811 photos). Le filtre doit visiblement améliorer.
 * - "low" : photo Wikimedia ancienne (façade plate, ciel gris, capteur
 *   d'époque). Le filtre joue son rôle de "rattrapage".
 */
const SAMPLE_PHOTOS: ReadonlyArray<SamplePhoto> = [
  {
    id: 'bristol-pool',
    caption: 'TOP — Piscine intérieure Bristol (Google Places, score Vision 9/10)',
    altFr: 'Espace piscine intérieure Hôtel Le Bristol Paris',
    tier: 'top',
    publicId: 'cct/hotels/le-bristol-paris/places-3',
    sourceLabel: 'Google Places · res. native 1600px',
  },
  {
    id: 'bristol-lobby',
    caption: "TOP — Hall d'entrée Bristol (Google Places, score Vision 9/10)",
    altFr: "Élégant hall d'entrée Hôtel Le Bristol Paris",
    tier: 'top',
    publicId: 'cct/hotels/le-bristol-paris/places-9',
    sourceLabel: 'Google Places · res. native 1600px',
  },
  {
    id: 'ritz-nyc-view',
    caption: 'MEDIUM — Vue Ritz-Carlton New York Central Park (Tripadvisor 900px, contraste plat)',
    altFr: 'Vue sur Central Park Ritz-Carlton New York',
    tier: 'medium',
    publicId: 'cct/dev/preview-filter/ritz-nyc-view',
    sourceLabel: 'Tripadvisor CDN · res. native 900×500',
  },
  {
    id: 'sparrow-pool',
    caption:
      'MEDIUM — Piscine intérieure The Sparrow Boise (Tripadvisor user-gen 1200px, lumière artificielle)',
    altFr: 'Piscine intérieure The Sparrow Boise',
    tier: 'medium',
    publicId: 'cct/dev/preview-filter/sparrow-pool',
    sourceLabel: 'Tripadvisor CDN · res. native 1200×800',
  },
  {
    id: 'reschio-pool',
    caption: 'LOW — Pool bar Reschio Hotel (Tripadvisor 7964px, photo plate sans relief)',
    altFr: 'Il Torrino pool bar Reschio Hotel',
    tier: 'low',
    publicId: 'cct/dev/preview-filter/reschio-pool-bar',
    sourceLabel: 'Tripadvisor CDN · res. native 7964×4480',
  },
  {
    id: 'limelight-aspen',
    caption: 'LOW — Façade Limelight Aspen (Tripadvisor 2000px, ciel terne montagne)',
    altFr: 'Façade Limelight Hotel Aspen',
    tier: 'low',
    publicId: 'cct/dev/preview-filter/limelight-aspen',
    sourceLabel: 'Tripadvisor CDN · res. native 2000×1500',
  },
];

const BASE_TRANSFORM = 'w_1230,h_820,c_fill,g_auto,f_auto,q_auto:best';

/**
 * 4 variants — intensité augmentée pour qu'on voie clairement la différence (révision 2026-05-29).
 *
 * Les anciennes valeurs (improve:30, sharpen:80) étaient invisibles à l'œil.
 * On passe à improve:80-100 et sharpen:200-400 pour que chaque variante
 * raconte une histoire visuelle distincte.
 */
const VARIANTS: ReadonlyArray<FilterVariant> = [
  {
    id: 'raw',
    label: 'Raw (baseline actuel)',
    oneLiner: 'Aucun filtre. C\u2019est ce que sert le pipeline aujourd\u2019hui.',
    transforms: BASE_TRANSFORM,
  },
  {
    id: 'concierge_sober',
    label: 'A — Concierge sobre',
    oneLiner:
      'Auto-contraste + sharpen marqué + improve fort. Photo nette, propre, jamais maquillée.',
    transforms: `${BASE_TRANSFORM},e_improve:80,e_auto_contrast,e_sharpen:300`,
    recommendation: 'Recommandé — voix Concierge sobre, gain visible',
  },
  {
    id: 'concierge_magazine',
    label: 'B — Magazine éditorial',
    oneLiner: 'Look Forbes/Travel+Leisure : contraste prononcé, saturation neutre, piqué fort.',
    transforms: `${BASE_TRANSFORM},e_improve:100,e_auto_contrast,e_contrast:25,e_saturation:-15,e_sharpen:400`,
  },
  {
    id: 'concierge_warm',
    label: 'C — Doré chaleureux',
    oneLiner:
      'Boost saturation + auto-color. Donne du chaud aux blancs et aux dorures, risque commercial.',
    transforms: `${BASE_TRANSFORM},e_improve:80,e_auto_color,e_auto_contrast,e_saturation:30,e_sharpen:200`,
  },
];

function buildUrl(publicId: string, transforms: string): string {
  const publicIdSafe = publicId.split('/').map(encodeURIComponent).join('/');
  return `${CLOUDINARY_BASE}/${transforms}/${publicIdSafe}`;
}

const TIER_BADGE: Record<
  SamplePhoto['tier'],
  { readonly bg: string; readonly text: string; readonly label: string }
> = {
  top: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Top qualité' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Qualité moyenne' },
  low: { bg: 'bg-stone-200', text: 'text-stone-700', label: 'Qualité brute' },
};

export default function PhotoFilterPreviewPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-10">
      <header className="mb-10 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
          Preview interne · décision filtre signature
        </p>
        <h1 className="mt-2 font-serif text-3xl text-stone-900">
          Quel look pour les photos hôtel ?
        </h1>
        <p className="mt-4 text-sm leading-6 text-stone-700">
          6 photos volontairement contrastées en qualité — 2 <strong>TOP</strong> (Google Places
          polish, Vision score 9/10), 2 <strong>MEDIUM</strong> (Tripadvisor user-generated, lumière
          plate, basse résolution), 2 <strong>LOW</strong> (Tripadvisor amateur, contraste mou, ciel
          terne). Toutes passées dans 4 variantes Cloudinary (1230×820, c_fill, q_auto:best).
          <br />
          <strong>Mission</strong> : choisir la variante qui (a) ne dégrade pas le TOP, (b) améliore
          visiblement le MEDIUM, (c) rattrape le LOW. Le filtre choisi sera locké dans le pipeline
          pour les 4 fiches polish puis pour tout le catalogue Phase 2.
        </p>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          <p>
            <strong>Recommandation Concierge</strong> : la variante <strong>A — sobre</strong>{' '}
            respecte le mieux la règle « jamais commerciale, toujours précise » (skill{' '}
            <code>editorial-voice</code>). Les LOW/MEDIUM montrent le mieux la différence entre les
            variantes. Les TOP servent de garde-fou : si une variante dégrade un Bristol, on
            l'abandonne.
          </p>
        </div>
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-900">
          <p>
            <strong>
              ⚠ Note sourcing — ce sample n'est PAS représentatif du catalogue production
            </strong>
            <br />
            Les 4 photos Tripadvisor de cette page (Ritz NYC, Sparrow, Reschio, Limelight) sont là{' '}
            <strong>uniquement pour tester l'effet visuel du filtre</strong>. La règle{' '}
            <code>photo-quality.mdc</code> interdit Tripadvisor CDN en production — le catalogue
            n'utilisera <strong>que des photos officielles</strong> (site officiel hôtel via Tavily,
            Google Places photos publiées par l'hôtel, press kits R&C/LHW/FS/MO/Forbes, Wikimedia
            uniquement si score Vision ≥ 8 + licence CC). Une fois le filtre choisi ici, on
            l'applique sur du sourcing 100% officiel.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12">
        {SAMPLE_PHOTOS.map((photo) => {
          const tierBadge = TIER_BADGE[photo.tier];
          return (
            <section key={photo.id}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierBadge.bg} ${tierBadge.text}`}
                >
                  {tierBadge.label}
                </span>
                <h2 className="text-sm font-medium text-stone-900">{photo.caption}</h2>
              </div>
              <p className="mb-4 text-xs text-stone-500">
                <code>{photo.sourceLabel}</code> · alt FR : {photo.altFr}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {VARIANTS.map((variant) => (
                  <figure
                    key={variant.id}
                    className={`overflow-hidden rounded-lg border ${
                      variant.recommendation !== undefined
                        ? 'border-amber-400 ring-1 ring-amber-300'
                        : 'border-stone-200'
                    } bg-white`}
                  >
                    <div className="aspect-[3/2] w-full bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={buildUrl(photo.publicId, variant.transforms)}
                        alt={`${photo.altFr} — variante ${variant.label}`}
                        width={1230}
                        height={820}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <figcaption className="p-3">
                      <p className="text-xs font-semibold text-stone-900">{variant.label}</p>
                      <p className="mt-1 text-[11px] leading-4 text-stone-600">
                        {variant.oneLiner}
                      </p>
                      {variant.recommendation !== undefined && (
                        <p className="mt-2 text-[11px] font-medium text-amber-700">
                          ✓ {variant.recommendation}
                        </p>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] text-stone-400 hover:text-stone-600">
                          Transforms
                        </summary>
                        <code className="mt-1 block break-all text-[10px] text-stone-500">
                          {variant.transforms}
                        </code>
                      </details>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="mt-16 max-w-3xl border-t border-stone-200 pt-6 text-xs text-stone-500">
        <p>
          Décision attendue : <strong>A</strong>, <strong>B</strong>, <strong>C</strong>, ou
          variante composite (ex. « A + un peu plus de saturation »). Le PO valide → on locke
          <code className="ml-1">SIGNATURE_TRANSFORM</code> dans
          <code className="ml-1">packages/ui/src/components/hotel-image.tsx</code>+ on régénère les
          vignettes JSON-LD ImageObject.
        </p>
        <p className="mt-4">
          Page <code>force-static</code> + <code>noindex,nofollow</code>. Aucune trace publique.
        </p>
      </footer>
    </main>
  );
}
