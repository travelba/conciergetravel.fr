/**
 * POI card images for `prince-de-galles-paris` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources: Wikimedia
 * Commons + official venue sites (Tavily discovery 2026-06-10).
 *
 *   pnpm --filter @mch/editorial-pilot pdg:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot pdg:photos:poi
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

const SLUG = 'prince-de-galles-paris';

interface PoiImageSource {
  readonly slug: string;
  readonly sourceUrl?: string;
  readonly source: 'commons' | 'manual' | 'press' | 'ai';
  readonly altFr: string;
  readonly altEn: string;
  readonly licenseNote: string;
  /** When set, generates via OpenAI Images instead of fetching `sourceUrl`. */
  readonly openAiPrompt?: string;
}

/** Commons + official URLs — must depict the named venue (not hotel gallery). */
const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'arc-de-triomphe',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Arc_de_Triomphe%2C_Paris_21_October_2010.jpg/1280px-Arc_de_Triomphe%2C_Paris_21_October_2010.jpg',
    source: 'commons',
    altFr: 'Arc de triomphe de l’Étoile, place Charles-de-Gaulle, Paris',
    altEn: 'Arc de Triomphe on Place Charles-de-Gaulle, Paris',
    licenseNote: 'Wikimedia Commons — CC-BY-SA 3.0',
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
    slug: 'place-de-la-concorde',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Paris_-_Place_de_la_Concorde_-_PA00088875_-_002.jpg/1280px-Paris_-_Place_de_la_Concorde_-_PA00088875_-_002.jpg',
    source: 'commons',
    altFr: 'Obélisque de Louxor, place de la Concorde, Paris',
    altEn: 'Luxor Obelisk, Place de la Concorde, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'musee-yves-saint-laurent',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Mus%C3%A9e_Yves-Saint-Laurent_Paris_-_Atelier_d%27YSL_by_Mikani.jpg/1280px-Mus%C3%A9e_Yves-Saint-Laurent_Paris_-_Atelier_d%27YSL_by_Mikani.jpg',
    source: 'commons',
    altFr: 'Façade du Musée Yves Saint Laurent Paris, avenue Marceau',
    altEn: 'Facade of Yves Saint Laurent Paris Museum, Avenue Marceau',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'palais-galliera',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Mus%C3%A9e_Galliera%2C_Paris_21_July_2017.jpg/1280px-Mus%C3%A9e_Galliera%2C_Paris_21_July_2017.jpg',
    source: 'commons',
    altFr: 'Palais Galliera, musée de la Mode de la Ville de Paris',
    altEn: 'Palais Galliera, Paris Fashion Museum',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'cathedrale-sainte-trinite',
    source: 'ai',
    altFr: 'Cathédrale de la Sainte-Trinité, église orthodoxe russe, Paris 16e',
    altEn: 'Holy Trinity Cathedral, Russian Orthodox church, Paris 16th',
    licenseNote: 'AI illustrative — Commons rate-limited during batch (2026-06-10)',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the Russian Orthodox Holy Trinity Cathedral in Paris (2016): five golden onion domes, white stone facade, neo-Russian architecture, clear daylight, no people, no readable text, travel magazine style.',
  },
  {
    slug: 'champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Avenue_des_Champs-Elys%C3%A9es%2C_Paris_12_December_2020.jpg/1280px-Avenue_des_Champs-Elys%C3%A9es%2C_Paris_12_December_2020.jpg',
    source: 'commons',
    altFr: 'Avenue des Champs-Élysées vue depuis l’Arc de triomphe',
    altEn: 'Champs-Élysées avenue seen from the Arc de Triomphe',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'theatre-champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Th%C3%A9%C3%A2tre_des_Champs-%C3%89lys%C3%A9es%2C_21_April_2013.jpg/1280px-Th%C3%A9%C3%A2tre_des_Champs-%C3%89lys%C3%A9es%2C_21_April_2013.jpg',
    source: 'commons',
    altFr: 'Théâtre des Champs-Élysées, avenue Montaigne, Paris',
    altEn: 'Théâtre des Champs-Élysées, Avenue Montaigne, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'palais-de-tokyo',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Palais_de_Tokyo_20030101w.JPG/1280px-Palais_de_Tokyo_20030101w.JPG',
    source: 'commons',
    altFr: 'Palais de Tokyo, centre d’art contemporain, Paris 16e',
    altEn: 'Palais de Tokyo contemporary art centre, Paris 16th',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'jardin-champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Jardins_des_Champs-%C3%89lys%C3%A9es_Paris.jpg/1280px-Jardins_des_Champs-%C3%89lys%C3%A9es_Paris.jpg',
    source: 'commons',
    altFr: 'Jardin des Champs-Élysées entre le Grand Palais et la Concorde',
    altEn: 'Jardin des Champs-Élysées between Grand Palais and Concorde',
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
    slug: 'le-clarence',
    source: 'ai',
    altFr: 'Salon du restaurant Le Clarence, hôtel particulier avenue de Friedland, Paris',
    altEn: 'Dining salon at Le Clarence, town house on Avenue de Friedland, Paris',
    licenseNote: 'AI illustrative — official site serves restricted assets (2026-06-10)',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a three-MICHELIN-star French restaurant salon in a Parisian hôtel particulier: white tablecloths, crystal glasses, boiserie and tall windows, warm evening light, no people, no readable text or logos, travel magazine style.',
  },
  {
    slug: 'galeries-lafayette-champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Galerie_Lafayette_Haussmann_Dome.jpg/1280px-Galerie_Lafayette_Haussmann_Dome.jpg',
    source: 'commons',
    altFr: 'Façade des Galeries Lafayette, grand magasin parisien',
    altEn: 'Galeries Lafayette department store facade, Paris',
    licenseNote: 'Wikimedia Commons — placeholder until Champs-Élysées store photo sourced',
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
    slug: 'maison-guerlain-champs-elysees',
    source: 'ai',
    altFr: 'Maison Guerlain, 68 avenue des Champs-Élysées, Paris',
    altEn: 'Guerlain flagship at 68 Avenue des Champs-Élysées, Paris',
    licenseNote: 'AI illustrative — guerlain.com blocks hotlink (403)',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the historic Guerlain perfume boutique interior on the Champs-Élysées: art-deco bottles, golden accents, marble counters, warm luxury lighting, no people, no readable logos, travel magazine style.',
  },
  {
    slug: 'louis-vuitton-champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Gecina_-101_champs_elysees.jpg/1280px-Gecina_-101_champs_elysees.jpg',
    source: 'commons',
    altFr: 'Maison Louis Vuitton, 101 avenue des Champs-Élysées, Paris',
    altEn: 'Louis Vuitton maison at 101 Avenue des Champs-Élysées, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'galerie-dior',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Christian_Dior%2C_30_Avenue_Montaigne%2C_Paris_2016.jpg/1280px-Christian_Dior%2C_30_Avenue_Montaigne%2C_Paris_2016.jpg',
    source: 'commons',
    altFr: 'Boutique Christian Dior, avenue Montaigne, Paris',
    altEn: 'Christian Dior boutique, Avenue Montaigne, Paris',
    licenseNote: 'Wikimedia Commons',
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
