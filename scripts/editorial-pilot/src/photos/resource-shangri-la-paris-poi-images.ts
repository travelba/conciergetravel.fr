/**
 * POI card images for `shangri-la-paris` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources: Wikimedia
 * Commons + AI fallback (16e arrondissement / Trocadéro cluster).
 *
 *   pnpm --filter @mch/editorial-pilot slp:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot slp:photos:poi
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

const SLUG = 'shangri-la-paris';

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
    slug: 'tour-eiffel-trocadero',
    source: 'ai',
    altFr: 'Tour Eiffel vue depuis le Trocadéro, Paris 16e',
    altEn: 'Eiffel Tower seen from Trocadéro, Paris 16th',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the Eiffel Tower seen from Trocadéro gardens in Paris: iron lattice tower, fountains in foreground, clear blue sky, no people, travel magazine style.',
  },
  {
    slug: 'musee-guimet',
    source: 'ai',
    altFr: 'Musée national des Arts asiatiques Guimet, place d’Iéna, Paris',
    altEn: 'Guimet National Museum of Asian Arts, Place d’Iéna, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Musée Guimet Paris: Beaux-Arts museum facade on Place d’Iéna, stone columns, Paris 16th, daylight, no people, travel magazine style.',
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
    slug: 'musee-yves-saint-laurent',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Mus%C3%A9e_Yves-Saint-Laurent_Paris_-_Atelier_d%27YSL_by_Mikani.jpg/1280px-Mus%C3%A9e_Yves-Saint-Laurent_Paris_-_Atelier_d%27YSL_by_Mikani.jpg',
    source: 'commons',
    altFr: 'Musée Yves Saint Laurent Paris, avenue Marceau',
    altEn: 'Yves Saint Laurent Paris Museum, Avenue Marceau',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'cite-architecture',
    source: 'ai',
    altFr: 'Cité de l’architecture et du patrimoine, Palais de Chaillot, Paris',
    altEn: 'Cité de l’architecture et du patrimoine, Palais de Chaillot, Paris',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Cité de l’architecture et du patrimoine at Palais de Chaillot Paris: monumental Art Deco wings framing Eiffel Tower view, Trocadéro, daylight, no people, travel magazine style.',
  },
  {
    slug: 'cathedrale-sainte-trinite',
    source: 'ai',
    altFr: 'Cathédrale de la Sainte-Trinité, église orthodoxe russe, Paris 16e',
    altEn: 'Holy Trinity Cathedral, Russian Orthodox church, Paris 16th',
    licenseNote: 'AI illustrative — Commons rate-limited during batch',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the Russian Orthodox Holy Trinity Cathedral in Paris: five golden onion domes, white stone facade, neo-Russian architecture, clear daylight, no people, no readable text, travel magazine style.',
  },
  {
    slug: 'promenade-seine',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/View_up_the_Seine_from_Pont_d%27I%C3%A9na%2C_Paris%2C_2016.jpg/1280px-View_up_the_Seine_from_Pont_d%27I%C3%A9na%2C_Paris%2C_2016.jpg',
    source: 'commons',
    altFr: 'Promenade sur les quais de Seine, pont d’Iéna, Paris 16e',
    altEn: 'Seine riverbank walk, Pont d’Iéna, Paris 16th',
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
    slug: 'theatre-champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Th%C3%A9%C3%A2tre_des_Champs-%C3%89lys%C3%A9es%2C_21_April_2013.jpg/1280px-Th%C3%A9%C3%A2tre_des_Champs-%C3%89lys%C3%A9es%2C_21_April_2013.jpg',
    source: 'commons',
    altFr: 'Théâtre des Champs-Élysées, avenue Montaigne, Paris',
    altEn: 'Théâtre des Champs-Élysées, Avenue Montaigne, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'musee-marmottan',
    source: 'ai',
    altFr: 'Musée Marmottan Monet, avenue du Ranelagh, Paris 16e',
    altEn: 'Musée Marmottan Monet, Avenue du Ranelagh, Paris 16th',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Musée Marmottan Monet in Paris: elegant townhouse museum facade, Avenue du Ranelagh, leafy 16th arrondissement, daylight, no people, travel magazine style.',
  },
  {
    slug: 'bois-de-boulogne',
    source: 'ai',
    altFr: 'Bois de Boulogne, poumon vert de l’ouest parisien',
    altEn: 'Bois de Boulogne, western Paris green lung',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Bois de Boulogne in Paris: tree-lined alleys, lake and rowing boats, soft morning light, no people, travel magazine style.',
  },
  {
    slug: 'le-clarence',
    source: 'ai',
    altFr: 'Restaurant Le Clarence, hôtel particulier avenue de Friedland, Paris',
    altEn: 'Le Clarence restaurant, town house on Avenue de Friedland, Paris',
    licenseNote: 'AI illustrative — official site serves restricted assets',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a three-MICHELIN-star French restaurant salon in a Parisian hôtel particulier: white tablecloths, crystal glasses, boiserie and tall windows, warm evening light, no people, no readable text or logos, travel magazine style.',
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
    slug: 'marche-passy',
    source: 'ai',
    altFr: 'Marché couvert de Passy, quartier du 16e arrondissement, Paris',
    altEn: 'Passy covered market, Paris 16th arrondissement',
    licenseNote: 'AI illustrative — no stable Commons hero asset',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a Parisian covered food market (Passy style): stalls with produce and flowers, iron and glass roof, morning light, no readable text, travel magazine style.',
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
    slug: 'maison-guerlain',
    source: 'ai',
    altFr: 'Maison Guerlain, 68 avenue des Champs-Élysées, Paris',
    altEn: 'Guerlain flagship at 68 Avenue des Champs-Élysées, Paris',
    licenseNote: 'AI illustrative — guerlain.com blocks hotlink',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the historic Guerlain perfume boutique interior on the Champs-Élysées: art-deco bottles, golden accents, marble counters, warm luxury lighting, no people, no readable logos, travel magazine style.',
  },
  {
    slug: 'galeries-lafayette-champs-elysees',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Galerie_Lafayette_Haussmann_Dome.jpg/1280px-Galerie_Lafayette_Haussmann_Dome.jpg',
    source: 'commons',
    altFr: 'Galeries Lafayette, grand magasin parisien',
    altEn: 'Galeries Lafayette department store, Paris',
    licenseNote: 'Wikimedia Commons — placeholder until Champs-Élysées store photo sourced',
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
