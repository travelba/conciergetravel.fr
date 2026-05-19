/**
 * Seeds `hero_image` on the 10 country guides with curated Wikimedia
 * Commons landmark photos. Country guides have no editorial-curated
 * hero so they would render with an empty hero block.
 *
 * Source: each URL points to a Commons `Special:FilePath` redirect
 * that resolves to a high-res JPG/PNG. They are all under a CC license
 * (BY / BY-SA / public domain) — see the `attribution` column in DB
 * (added by the photos:sync subagent migration).
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/guides/seed-country-hero-images.ts [--dry-run]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

interface CountryHero {
  readonly slug: string;
  readonly url: string;
  readonly caption: string;
  readonly attribution: string;
}

// Curated free-licence (CC BY-SA / public domain) Commons photos via
// `Special:FilePath` redirect — width=2400 is a sane editorial size
// (~250 KB), Cloudinary will further compress for production delivery.
const COUNTRY_HEROES: readonly CountryHero[] = [
  {
    slug: 'japon',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mt_Fuji_from_Hotel_Mt_Fuji_1995-5-3.jpg?width=2400',
    caption: 'Mont Fuji depuis le lac Kawaguchi, archétype du paysage japonais.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'etats-unis',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Lower_Manhattan_from_Helicopter.jpg?width=2400',
    caption: 'Manhattan vu depuis le ciel — fenêtre emblématique du séjour américain.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'italie',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Colosseo_2020.jpg?width=2400',
    caption: "Le Colisée de Rome, témoin millénaire d'un patrimoine UNESCO record (60 sites).",
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'royaume-uni',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Houses.of.parliament.overall.arp.jpg?width=2400',
    caption: 'Le Palais de Westminster et Big Ben au bord de la Tamise.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'espagne',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sagrada_Familia_01.jpg?width=2400',
    caption: 'La Sagrada Família de Barcelone, chef-d\u2019œuvre inachevé de Gaudí.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'emirats-arabes-unis',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Burj_Khalifa.jpg?width=2400',
    caption: 'Le Burj Khalifa à Dubaï, plus haute tour du monde depuis 2010.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'turquie',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sultan_Ahmed_Mosque_-_Blue_Mosque_(15670045700).jpg?width=2400',
    caption: 'La Mosquée Bleue (Sultanahmet) à Istanbul, sur fond de Corne d\u2019Or.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'allemagne',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Brandenburger_Tor_abends.jpg?width=2400',
    caption: 'La Porte de Brandebourg à Berlin, symbole de la réunification.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'chine',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/The_Great_Wall_of_China_at_Jinshanling-edit.jpg?width=2400',
    caption: 'La Grande Muraille à Jinshanling, segment Ming le mieux conservé.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
  {
    slug: 'mexique',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Chichen_Itza_3.jpg?width=2400',
    caption: 'Le temple de Kukulkán à Chichén Itzá, pyramide maya UNESCO du Yucatán.',
    attribution: 'Wikimedia Commons — CC BY-SA',
  },
];

function resolveConnectionString(): string {
  const conn =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (conn === null) {
    throw new Error(
      'No Postgres connection string. Set DATABASE_URL, SUPABASE_DB_POOLER_URL, or SUPABASE_DB_URL.',
    );
  }
  return conn;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const pgModule = (await import('pg')) as typeof import('pg');
  const cleaned = resolveConnectionString().replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  let updated = 0;
  let skipped = 0;
  try {
    for (const hero of COUNTRY_HEROES) {
      const { rows } = await client.query<{ scope: string; has_hero: boolean }>(
        `select scope, hero_image is not null as has_hero
           from public.editorial_guides where slug = $1`,
        [hero.slug],
      );
      const row = rows[0];
      if (row === undefined) {
        console.warn(`[${hero.slug}] ⚠ not in DB — run-guides-v2 first`);
        skipped += 1;
        continue;
      }
      if (row.scope !== 'country') {
        console.warn(`[${hero.slug}] ⚠ scope=${row.scope}, not 'country' — skipping`);
        skipped += 1;
        continue;
      }
      if (row.has_hero) {
        console.log(`[${hero.slug}] ⊝ already has hero — skipping (idempotent)`);
        skipped += 1;
        continue;
      }
      if (dryRun) {
        console.log(`[${hero.slug}] would set hero_image to ${hero.url}`);
        continue;
      }
      await client.query(
        `update public.editorial_guides
           set hero_image = $1
         where slug = $2 and scope = 'country' and hero_image is null`,
        [hero.url, hero.slug],
      );
      console.log(`[${hero.slug}] ✓ hero set`);
      updated += 1;
    }
  } finally {
    await client.end();
  }
  console.log(`\nDone — ${updated} updated, ${skipped} skipped${dryRun ? ' (DRY RUN)' : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
