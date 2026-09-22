/**
 * Backfill GIATA property crosswalk → `hotels.giata_id` + `v2.hotel_supplier_codes`.
 *
 * Pré-requis env :
 *   GIATA_MC_USERNAME, GIATA_MC_PASSWORD
 *   SUPABASE_* (service role)
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot giata:backfill -- --slug=le-meurice --giata-id=12345
 *   pnpm --filter @mch/editorial-pilot giata:backfill -- --limit=50 --only-missing
 *   pnpm --filter @mch/editorial-pilot giata:backfill -- --dry-run --slug=ritz-paris --giata-id=…
 *
 * ADR-0026 / CDC v2 Q43 — seeds Phase 9 booking aggregation mappings.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import type { GiataSupplier } from '@mch/integrations/giata';

import { loadPhotoEnv } from '../photos/env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const ArgsSchema = z.object({
  slug: z.string().min(1).optional(),
  hotelId: z.string().uuid().optional(),
  giataId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(25),
  onlyMissing: z.coerce.boolean().default(false),
  dryRun: z.coerce.boolean().default(false),
});

function parseArgv(argv: readonly string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === '--only-missing') {
      parsed.onlyMissing = true;
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m !== null && m[1] !== undefined && m[2] !== undefined) {
      parsed[m[1]] = m[2];
    }
  }
  return parsed;
}

function supplierHotelCode(supplier: GiataSupplier, key: Record<string, string>): string {
  return JSON.stringify({ supplier, ...key });
}

async function upsertPublicRow(
  cfg: SupabaseRestConfig,
  table: string,
  body: Readonly<Record<string, unknown>>,
  onConflict: string,
): Promise<boolean> {
  const res = await fetch(
    `${cfg.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}

async function upsertV2Row(
  cfg: SupabaseRestConfig,
  table: string,
  body: Readonly<Record<string, unknown>>,
  onConflict: string,
): Promise<boolean> {
  const res = await fetch(
    `${cfg.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'v2',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}

async function loadGiataConfig(): Promise<{
  baseUrl: string;
  username: string;
  password: string;
  apiVersion?: string;
}> {
  const base =
    process.env['GIATA_MC_BASE_URL'] ??
    process.env['GIATA_API_BASE'] ??
    'https://multicodes.giatamedia.com';
  const username = process.env['GIATA_MC_USERNAME'];
  const password = process.env['GIATA_MC_PASSWORD'] ?? process.env['GIATA_API_KEY'];
  if (username === undefined || password === undefined) {
    throw new Error('Set GIATA_MC_USERNAME and GIATA_MC_PASSWORD');
  }
  return {
    baseUrl: base,
    username,
    password,
    ...(process.env['GIATA_MC_API_VERSION'] !== undefined
      ? { apiVersion: process.env['GIATA_MC_API_VERSION'] }
      : {}),
  };
}

type HotelRow = {
  readonly id: string;
  readonly slug: string;
  readonly giata_id: string | null;
  readonly name: string;
  readonly city: string | null;
  readonly country_code: string | null;
};

async function main(): Promise<void> {
  const rawArgs = parseArgv(process.argv.slice(2));
  const args = ArgsSchema.parse({
    ...rawArgs,
    onlyMissing: rawArgs.onlyMissing === true,
    dryRun: rawArgs.dryRun === true,
  });
  if (args.slug === undefined && args.hotelId === undefined && !args.onlyMissing) {
    throw new Error('Provide --slug=, --hotel-id=, or --only-missing');
  }

  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const filters: string[] = ['is_published=eq.true'];
  if (args.slug !== undefined) {
    filters.push(`slug=eq.${encodeURIComponent(args.slug)}`);
  }
  if (args.hotelId !== undefined) {
    filters.push(`id=eq.${encodeURIComponent(args.hotelId)}`);
  }
  if (args.onlyMissing) {
    filters.push('giata_id=is.null');
  }

  const hotels = await selectHotels<HotelRow>(cfg, {
    columns: 'id,slug,giata_id,name,city,country_code',
    filters,
    limit: args.limit,
  });

  if (hotels.length === 0) {
    console.log(JSON.stringify({ processed: 0, message: 'no hotels matched' }, null, 2));
    return;
  }

  const { fetchGiataPropertyById, searchGiataProperty } = await import('@mch/integrations/giata');
  const giataCfg = await loadGiataConfig();

  let processed = 0;
  let supplierCodesWritten = 0;
  let skipped = 0;

  for (const hotel of hotels) {
    let giataId = args.giataId ?? hotel.giata_id?.trim() ?? '';
    if (giataId.length === 0) {
      const city = hotel.city?.trim();
      if (city === undefined || city.length === 0) {
        skipped += 1;
        continue;
      }
      const countryCode = hotel.country_code?.trim();
      if (countryCode === undefined || countryCode.length !== 2) {
        skipped += 1;
        continue;
      }
      const match = await searchGiataProperty(giataCfg, {
        name: hotel.name,
        city,
        countryCode,
      });
      if (!match.ok || match.value.length === 0) {
        skipped += 1;
        continue;
      }
      const first = match.value[0];
      if (first === undefined) {
        skipped += 1;
        continue;
      }
      giataId = first.giataId;
    }

    const property = await fetchGiataPropertyById(giataCfg, { giataId });
    if (!property.ok) {
      skipped += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(
        JSON.stringify({
          dryRun: true,
          hotelId: hotel.id,
          slug: hotel.slug,
          giataId,
          supplierRows: property.value.supplierRows.length,
        }),
      );
      processed += 1;
      continue;
    }

    await patchHotelById(cfg, hotel.id, { giata_id: giataId });

    for (const row of property.value.supplierRows) {
      const code = supplierHotelCode(row.supplier, row.supplierPropertyKey);
      const v2Ok = await upsertV2Row(
        cfg,
        'hotel_supplier_codes',
        {
          hotel_id: hotel.id,
          giata_id: giataId,
          supplier: row.supplier,
          supplier_hotel_code: code,
        },
        'hotel_id,supplier',
      );
      if (v2Ok) supplierCodesWritten += 1;

      await upsertPublicRow(
        cfg,
        'giata_supplier_properties',
        {
          giata_id: row.giataId,
          supplier: row.supplier,
          supplier_property_key: row.supplierPropertyKey,
          hotel_id: hotel.id,
          provider_code_raw: row.providerCodeRaw,
          confidence: 'giata_api',
        },
        'giata_id,supplier',
      );
    }

    processed += 1;
  }

  console.log(
    JSON.stringify(
      {
        processed,
        skipped,
        supplierCodesWritten,
        dryRun: args.dryRun,
        limit: args.limit,
      },
      null,
      2,
    ),
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
