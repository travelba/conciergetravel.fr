/**
 * POI card images for `le-bristol-paris` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources: Wikimedia
 * Commons + AI fallback for restricted official assets.
 *
 *   pnpm --filter @mch/editorial-pilot bristol:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot bristol:photos:poi
 *
 * Skill: photo-pipeline, hotel-kit-rollout §Rule POI images
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  configureCloudinary,
  uploadFromLocalFile,
  uploadFromUrl,
} from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';

const SLUG = 'le-bristol-paris';

interface PoiImageSource {
  readonly slug: string;
  readonly sourceUrl?: string;
  readonly source: 'commons' | 'manual' | 'press' | 'ai';
  readonly altFr: string;
  readonly altEn: string;
  readonly licenseNote: string;
  readonly openAiPrompt?: string;
}

const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'palais-elysee',
    source: 'ai',
    altFr: 'Palais de l’Élysée, résidence présidentielle, rue du Faubourg Saint-Honoré, Paris',
    altEn: 'Élysée Palace, presidential residence, Faubourg Saint-Honoré, Paris',
    licenseNote: 'AI illustrative — restricted official perimeter photography',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the Élysée Palace facade in Paris: neoclassical limestone, tricolour flags, gated courtyard, daylight, no people, no readable text, travel magazine style.',
  },
  {
    slug: 'eglise-madeleine',
    source: 'ai',
    altFr: 'Église de la Madeleine, temple néoclassique, place de la Madeleine, Paris',
    altEn: 'La Madeleine church, neoclassical temple, Place de la Madeleine, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of La Madeleine church in Paris: neoclassical Roman temple facade with Corinthian columns, Place de la Madeleine, clear daylight, no people, travel magazine style.',
  },
  {
    slug: 'place-de-la-concorde',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Paris_-_Place_de_la_Concorde_-_PA00088875_-_002.jpg/1280px-Paris_-_Place_de_la_Concorde_-_PA00088875_-_002.jpg',
    source: 'commons',
    altFr: 'Obélisque de Louxor, place de la Concorde, Paris',
    altEn: 'Luxor Obelisk, Place de la Concorde, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'musee-jacquemart-andre',
    source: 'ai',
    altFr: 'Musée Jacquemart-André, hôtel particulier du boulevard Haussmann, Paris',
    altEn: 'Musée Jacquemart-André, Haussmann boulevard town house, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Musée Jacquemart-André Paris: Haussmann limestone town house facade, wrought-iron balcony, Paris boulevard, daylight, no people, travel magazine style.',
  },
  {
    slug: 'musee-nissim-de-camondo',
    source: 'ai',
    altFr: 'Musée Nissim de Camondo, demeure du XVIIIe siècle, avenue Mozart, Paris',
    altEn: 'Musée Nissim de Camondo, 18th-century residence, Avenue Mozart, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Musée Nissim de Camondo entrance in Paris: elegant 18th-century town house, stone steps, Parisian street, daylight, no people, travel magazine style.',
  },
  {
    slug: 'parc-monceau',
    source: 'ai',
    altFr: 'Parc Monceau, jardin à l’anglaise du 8e arrondissement, Paris',
    altEn: 'Parc Monceau, English-style garden in the 8th arrondissement, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Parc Monceau in Paris: English-style garden with rotunda, columns, shaded paths and lawn, soft morning light, no people, travel magazine style.',
  },
  {
    slug: 'opera-garnier',
    source: 'ai',
    altFr: 'Opéra Garnier, Palais Garnier, place de l’Opéra, Paris',
    altEn: 'Palais Garnier opera house, Place de l’Opéra, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the Palais Garnier opera house in Paris: Beaux-Arts facade, golden statues, Place de l’Opéra, clear daylight, no people, travel magazine style.',
  },
  {
    slug: 'jardin-des-tuileries',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Grand_bassin_octogonal_Jardin_des_Tuileries_003.jpg/1280px-Grand_bassin_octogonal_Jardin_des_Tuileries_003.jpg',
    source: 'commons',
    altFr: 'Grand bassin octogonal, Jardin des Tuileries, Paris',
    altEn: 'Grand octagonal basin, Tuileries Garden, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'croisiere-seine',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/View_up_the_Seine_from_Pont_d%27I%C3%A9na%2C_Paris%2C_2016.jpg/1280px-View_up_the_Seine_from_Pont_d%27I%C3%A9na%2C_Paris%2C_2016.jpg',
    source: 'commons',
    altFr: 'Croisière sur la Seine avec la tour Eiffel, Paris',
    altEn: 'Seine river cruise with the Eiffel Tower, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'faubourg-saint-honore',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Son_immeuble_d%27habitation_avenue_Montaigne_%C3%A0_Paris.jpg/1280px-Son_immeuble_d%27habitation_avenue_Montaigne_%C3%A0_Paris.jpg',
    source: 'commons',
    altFr: 'Faubourg Saint-Honoré, artères du luxe parisien, Paris 8e',
    altEn: 'Faubourg Saint-Honoré, Paris luxury district, 8th arrondissement',
    licenseNote: 'Wikimedia Commons — Parisian luxury streetscape',
  },
  {
    slug: 'hermes-24-faubourg',
    source: 'ai',
    altFr: 'Hermès 24 Faubourg, flagship du carré Hermès, Paris',
    altEn: 'Hermès 24 Faubourg flagship, Paris',
    licenseNote: 'AI illustrative — hermes.com blocks hotlink',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a luxury Parisian hôtel particulier storefront on Faubourg Saint-Honoré: limestone facade, discreet signage, display windows with leather goods, daylight, no readable logos or text, travel magazine style.',
  },
  {
    slug: 'place-vendome',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Place-Vendome-Paris.jpg/1280px-Place-Vendome-Paris.jpg',
    source: 'commons',
    altFr: 'Place Vendôme et colonne Vendôme, Paris',
    altEn: 'Place Vendôme and Vendôme column, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'avenue-montaigne',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Son_immeuble_d%27habitation_avenue_Montaigne_%C3%A0_Paris.jpg/1280px-Son_immeuble_d%27habitation_avenue_Montaigne_%C3%A0_Paris.jpg',
    source: 'commons',
    altFr: 'Avenue Montaigne et vitrines de luxe, Paris 8e',
    altEn: 'Avenue Montaigne luxury storefronts, Paris 8th',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'le-bon-marche',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Le_Bon_March%C3%A9%2C_Paris_27_May_2012.jpg/1280px-Le_Bon_March%C3%A9%2C_Paris_27_May_2012.jpg',
    source: 'commons',
    altFr: 'Le Bon Marché, grand magasin historique, Rive Gauche, Paris',
    altEn: 'Le Bon Marché, historic department store, Left Bank, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'salle-pleyel',
    source: 'ai',
    altFr: 'Salle Pleyel, salle de concert, rue du Faubourg Saint-Honoré, Paris',
    altEn: 'Salle Pleyel concert hall, Faubourg Saint-Honoré, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Salle Pleyel concert hall exterior in Paris: modernist limestone facade, concert hall entrance, Faubourg Saint-Honoré, daylight, no people, travel magazine style.',
  },
  {
    slug: 'grand-palais',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Le_Grand_Palais_depuis_le_pont_Alexandre_III_%C3%A0_Paris.jpg/1280px-Le_Grand_Palais_depuis_le_pont_Alexandre_III_%C3%A0_Paris.jpg',
    source: 'commons',
    altFr: 'Grand Palais et verrière, Paris 8e',
    altEn: 'Grand Palais glass roof, Paris 8th',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'petit-palais',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Petit_Palais_Paris_8e.jpg/1280px-Petit_Palais_Paris_8e.jpg',
    source: 'commons',
    altFr: 'Petit Palais, musée des Beaux-Arts de la Ville de Paris',
    altEn: 'Petit Palais, Paris Fine Arts Museum',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'boutiques-faubourg',
    source: 'ai',
    altFr: 'Boutiques de couture du Faubourg Saint-Honoré, Paris 8e',
    altEn: 'Couture boutiques on Faubourg Saint-Honoré, Paris 8th',
    licenseNote: 'AI illustrative — generic luxury streetscape',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Paris Faubourg Saint-Honoré luxury boutiques: Haussmann limestone, elegant window displays, tree-lined sidewalk, soft daylight, no people, no readable brand names, travel magazine style.',
  },
];

function publicIdFor(slug: string): string {
  return `cct/hotels/${SLUG}/poi-${slug}`;
}

function parseOnlyFilter(): Set<string> | null {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  if (arg === undefined) return null;
  const slugs = arg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(slugs);
}

function cloudinarySourceTag(source: PoiImageSource['source']): 'commons' | 'manual' | 'press' {
  if (source === 'commons') return 'commons';
  if (source === 'press') return 'press';
  return 'manual';
}

async function generateOpenAiPoiImage(prompt: string): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error('[poi-images] OPENAI_API_KEY required for AI-generated POI images');
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1536x1024',
      quality: 'high',
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[poi-images] OpenAI Images ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json.data?.[0];
  if (item?.b64_json !== undefined) {
    const dir = mkdtempSync(join(tmpdir(), 'mch-poi-ai-'));
    const path = join(dir, 'poi-ai.png');
    writeFileSync(path, Buffer.from(item.b64_json, 'base64'));
    return path;
  }
  if (item?.url !== undefined) {
    return item.url;
  }
  throw new Error('[poi-images] OpenAI Images returned no image payload');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const only = parseOnlyFilter();
  const env = loadPhotoEnv();
  requirePhotoEnv(env, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    configureCloudinary({
      cloudName: env.CLOUDINARY_CLOUD_NAME!,
      apiKey: env.CLOUDINARY_API_KEY!,
      apiSecret: env.CLOUDINARY_API_SECRET!,
    });
  }

  const sources = only === null ? POI_SOURCES : POI_SOURCES.filter((p) => only.has(p.slug));

  if (sources.length === 0) {
    console.error('[poi-images] No POI slugs matched --only filter.');
    process.exitCode = 1;
    return;
  }

  const results: Array<{ slug: string; publicId: string; ok: boolean; detail?: string }> = [];

  for (let i = 0; i < sources.length; i++) {
    const poi = sources[i]!;
    const publicId = publicIdFor(poi.slug);

    if (dryRun) {
      console.log(`[dry-run] ${poi.slug}`);
      console.log(`  → ${publicId}`);
      if (poi.source === 'ai') {
        console.log(`  ← OpenAI: ${poi.openAiPrompt?.slice(0, 80)}…`);
      } else {
        console.log(`  ← ${poi.sourceUrl}`);
      }
      console.log(`  (${poi.licenseNote})`);
      results.push({ slug: poi.slug, publicId, ok: true });
      continue;
    }

    let uploaded;
    if (poi.source === 'ai') {
      if (poi.openAiPrompt === undefined) {
        throw new Error(`[poi-images] ${poi.slug}: AI source missing openAiPrompt`);
      }
      const generated = await generateOpenAiPoiImage(poi.openAiPrompt);
      if (generated.startsWith('http')) {
        uploaded = await uploadFromUrl({
          sourceUrl: generated,
          hotelSlug: SLUG,
          source: 'manual',
          index: i + 1,
          publicIdShort: `poi-${poi.slug}`,
          altFr: poi.altFr,
          altEn: poi.altEn,
          category: 'poi',
          extraTags: ['poi', poi.slug, 'ai-generated'],
        });
      } else {
        uploaded = await uploadFromLocalFile({
          localPath: generated,
          hotelSlug: SLUG,
          source: 'manual',
          index: i + 1,
          publicIdShort: `poi-${poi.slug}`,
          altFr: poi.altFr,
          altEn: poi.altEn,
          category: 'poi',
          extraTags: ['poi', poi.slug, 'ai-generated'],
        });
      }
    } else {
      if (poi.sourceUrl === undefined) {
        throw new Error(`[poi-images] ${poi.slug}: missing sourceUrl`);
      }
      uploaded = await uploadFromUrl({
        sourceUrl: poi.sourceUrl,
        hotelSlug: SLUG,
        source: cloudinarySourceTag(poi.source),
        index: i + 1,
        publicIdShort: `poi-${poi.slug}`,
        altFr: poi.altFr,
        altEn: poi.altEn,
        category: 'poi',
        extraTags: ['poi', poi.slug],
      });
    }

    if (!uploaded.ok) {
      console.error(`[FAIL] ${poi.slug}:`, uploaded.error);
      results.push({ slug: poi.slug, publicId, ok: false, detail: JSON.stringify(uploaded.error) });
      continue;
    }

    console.log(`[OK] ${poi.slug} → ${uploaded.value.public_id}`);
    results.push({ slug: poi.slug, publicId: uploaded.value.public_id, ok: true });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    console.error(`\n${failed.length} upload(s) failed.`);
  } else {
    console.log(`\nAll ${results.length} POI images ${dryRun ? 'planned' : 'uploaded'}.`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
