/**
 * Photo filter preview — internal dev tool.
 *
 * Compares 3 candidate Cloudinary "signature filters" (A subtle / B
 * editorial / C bold) side-by-side against the unfiltered baseline on
 * 6 production-grade photos coming from the live catalogue
 * (sourced via Google Places API → Cloudinary, ADR-0023 sourcing).
 *
 * Purpose: let the PO arbitrate which filter becomes the locked
 * `SIGNATURE_TRANSFORM` constant used by the photo pipeline before
 * Cloudinary re-uploads at scale.
 *
 * NOT indexable. NOT linked from production navigation. Lives under
 * `/dev/*` for the same reason `/_next/`, `/api/` and `/monitoring`
 * are excluded from sitemaps + robots (see seo-technical SKILL).
 *
 * Skill: photo-quality-seo-geo-agentique, photo-pipeline.
 */

import type { Metadata } from 'next';

import { buildCloudinarySrc } from '@mch/ui';

const CLOUD_NAME = process.env['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'] ?? 'dvbjwh5wy';

export const metadata: Metadata = {
  title: 'Photo filter preview (DEV)',
  robots: { index: false, follow: false },
};

interface SampleImage {
  readonly publicId: string;
  readonly hotel: string;
  readonly category: string;
  readonly note: string;
}

const SAMPLE_IMAGES: ReadonlyArray<SampleImage> = [
  {
    publicId: 'cct/hotels/akelarre/places-7',
    hotel: 'Akelarre',
    category: 'exterior',
    note: 'Façade — paysage basque, ciel changeant',
  },
  {
    publicId: 'cct/hotels/akelarre/places-6',
    hotel: 'Akelarre',
    category: 'view',
    note: 'Panorama océan — gradient bleu/gris',
  },
  {
    publicId: 'cct/hotels/al-moudira/places-2',
    hotel: 'Al Moudira',
    category: 'room',
    note: 'Chambre orientale — bois sombre, textiles riches',
  },
  {
    publicId: 'cct/hotels/al-moudira/places-3',
    hotel: 'Al Moudira',
    category: 'pool',
    note: 'Piscine — eau turquoise + pierre claire',
  },
  {
    publicId: 'cct/hotels/alila-jabal-akhdar/places-10',
    hotel: 'Alila Jabal Akhdar',
    category: 'spa',
    note: 'Spa — intérieur faible lumière, ambiance feutrée',
  },
  {
    publicId: 'cct/hotels/alila-jabal-akhdar/places-7',
    hotel: 'Alila Jabal Akhdar',
    category: 'dining',
    note: 'Restaurant — éclairage chaud, dressage table',
  },
];

interface FilterVariant {
  readonly id: 'baseline' | 'a-subtle' | 'b-editorial' | 'c-bold';
  readonly label: string;
  readonly subtitle: string;
  readonly transforms: string;
  readonly description: string;
}

const FRAME = 'w_800,h_600,c_fill,g_auto,f_auto,q_auto:best';

const FILTERS: ReadonlyArray<FilterVariant> = [
  {
    id: 'baseline',
    label: 'Baseline',
    subtitle: 'Sans filtre signature',
    transforms: FRAME,
    description: 'Cloudinary auto-format + auto-quality, aucun retraitement.',
  },
  {
    id: 'a-subtle',
    label: 'A — Subtle',
    subtitle: 'Signature minimaliste',
    transforms: `${FRAME},e_improve:50,e_sharpen:200`,
    description:
      'Amélioration auto à 50% + sharpening léger 200. Effet imperceptible sauf sur images très molles. Risque : presque invisible côté PO.',
  },
  {
    id: 'b-editorial',
    label: 'B — Editorial',
    subtitle: 'Signature équilibrée (candidat principal)',
    transforms: `${FRAME},e_improve:80,e_sharpen:300,e_saturation:20,e_contrast:10`,
    description:
      'Amélioration 80 + sharpening 300 + saturation +20% + contraste +10%. Rendu "magazine premium" type Conde Nast Traveler / Travel+Leisure.',
  },
  {
    id: 'c-bold',
    label: 'C — Bold',
    subtitle: 'Signature affirmée',
    transforms: `${FRAME},e_improve:100,e_sharpen:400,e_saturation:35,e_contrast:25,e_auto_color`,
    description:
      'Amélioration max + sharpening 400 + saturation +35% + contraste +25% + auto-color. Rendu cinématographique. Risque : sur-traitement visible sur portraits / peau.',
  },
];

function imgUrl(publicId: string, transforms: string): string {
  return buildCloudinarySrc({ cloudName: CLOUD_NAME, publicId, transforms });
}

export default function PhotoFilterPreviewPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-10 lg:px-8">
      <header className="mb-8 space-y-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Internal · noindex · dev tool
        </p>
        <h1 className="font-serif text-3xl text-zinc-900 lg:text-4xl">
          Photo filter preview — arbitrage signature
        </h1>
        <p className="max-w-3xl text-base text-zinc-700">
          Trois candidats de filtre Cloudinary comparés sur 6 photos officielles déjà chargées
          (sourced Google Places API). Choisis le filtre qui devient la constante{' '}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm">SIGNATURE_TRANSFORM</code> du
          pipeline. Une fois locké, le filtre est appliqué à chaque upload Cloudinary (preset
          uploaded asset, pas en delivery — irréversible).
        </p>

        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold uppercase tracking-wider text-green-800">
            ✓ Sources officielles uniquement
          </p>
          <p className="mt-1">
            Les 6 photos ci-dessous sont sourcées via <strong>Google Places API</strong> (compte
            officiel de chaque hôtel sur Google Business Profile). Aucune image client, aucun
            hotlink Pinterest, aucun TripAdvisor. Hashes Cloudinary :{' '}
            <code className="text-xs">cct/hotels/&lt;slug&gt;/places-N</code>. Voir{' '}
            <code className="text-xs">.cursor/rules/photo-quality.mdc</code>.
          </p>
        </div>

        <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
          <summary className="cursor-pointer font-semibold">
            Pourquoi ces 3 filtres ? Pourquoi pas de Lightroom preset propriétaire ?
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-700">
            <li>
              Les 3 variantes sont des transformations Cloudinary natives (no LUT, no neural net),
              donc reproductibles à l'infini sur ~2 200 hôtels sans coût de licence.
            </li>
            <li>
              Le filtre choisi sera baked-in au moment de l'upload (preset Cloudinary), pas appliqué
              en delivery — pas de double-coût LCP.
            </li>
            <li>
              Un LUT Lightroom (Adobe DNG / 3D LUT) demanderait un passage Python/ImageMagick avant
              Cloudinary, soit ×3 le temps de pipeline + dépendance machine locale.
            </li>
            <li>
              Le candidat <strong>B</strong> est calibré pour ressembler au rendu Condé Nast
              Traveler / Travel + Leisure (saturation modérée +20 %, contraste léger +10 %).
            </li>
          </ul>
        </details>
      </header>

      {/* Table récap des transforms en haut */}
      <section className="mb-8 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase tracking-wider text-zinc-700">
            <tr>
              <th className="px-4 py-3">Variante</th>
              <th className="px-4 py-3">Transforms Cloudinary</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {FILTERS.map((f) => (
              <tr key={f.id} className="text-zinc-800">
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-zinc-900">{f.label}</p>
                  <p className="text-xs text-zinc-500">{f.subtitle}</p>
                </td>
                <td className="px-4 py-3 align-top font-mono text-xs text-zinc-700">
                  {f.transforms}
                </td>
                <td className="px-4 py-3 align-top text-xs leading-relaxed">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Comparatif image par image */}
      <section className="space-y-12">
        {SAMPLE_IMAGES.map((sample) => (
          <article
            key={sample.publicId}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div>
                <h2 className="font-serif text-xl text-zinc-900">{sample.hotel}</h2>
                <p className="text-sm text-zinc-600">
                  <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-zinc-700">
                    {sample.category}
                  </span>{' '}
                  · {sample.note}
                </p>
              </div>
              <code className="text-xs text-zinc-500">{sample.publicId}</code>
            </header>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {FILTERS.map((filter) => (
                <figure key={filter.id} className="space-y-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgUrl(sample.publicId, filter.transforms)}
                      alt={`${sample.hotel} — ${sample.category} — ${filter.label}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <figcaption className="space-y-0.5 text-xs">
                    <p className="font-semibold text-zinc-900">{filter.label}</p>
                    <p className="text-zinc-500">{filter.subtitle}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </article>
        ))}
      </section>

      {/* Décision PO */}
      <section className="mt-12 rounded-lg border-2 border-amber-300 bg-amber-50 p-6">
        <h2 className="mb-3 font-serif text-2xl text-zinc-900">Ta décision</h2>
        <p className="mb-4 text-sm text-zinc-800">
          Quand tu as arrêté ton choix, dis-le moi (« va sur B » / « lock A » / etc.) et je :
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-800">
          <li>
            Locke la constante{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">SIGNATURE_TRANSFORM</code> dans{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">
              packages/ui/src/cloudinary-presets.ts
            </code>
            .
          </li>
          <li>
            Mets à jour ADR-0023 (Photos — quota 10 + filtre signature) avec la décision et la
            rationale.
          </li>
          <li>
            Lance{' '}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs">
              categorize-with-vision.ts
            </code>{' '}
            sur les 4 hôtels phare en mode re-upload avec le filtre locké.
          </li>
          <li>
            Smoke-test : visite les 4 fiches publiées et confirme que les photos rendent bien avec
            le nouveau filtre.
          </li>
        </ol>
      </section>

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        <p>
          Build: ADR-0023 photo quota 10 + LLM Vision categorization. Cloudinary cloud :{' '}
          <code>{CLOUD_NAME}</code>. Page non-indexée (robots noindex). Source rules :{' '}
          <code>.cursor/rules/photo-quality.mdc</code>.
        </p>
      </footer>
    </main>
  );
}
