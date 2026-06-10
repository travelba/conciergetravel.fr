/**
 * Sync GIATA crosswalk → hotel_supplier_connections for one catalogue hotel.
 *
 * Pré-requis env :
 *   GIATA_ENABLED=1
 *   GIATA_MC_USERNAME, GIATA_MC_PASSWORD (format user|company + password)
 *   SUPABASE_* (service role)
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot giata:sync -- --slug=le-meurice --giata-id=12345
 *   pnpm --filter @mch/editorial-pilot giata:sync -- --hotel-id=<uuid> --giata-id=12345
 *
 * ADR-0026 — update `parseGiataPropertyPayload` when the PO supplies the wire format.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const ArgsSchema = z.object({
  slug: z.string().min(1).optional(),
  hotelId: z.string().uuid().optional(),
  giataId: z.string().min(1),
});

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (const arg of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m !== null && m[1] !== undefined && m[2] !== undefined) {
      parsed[m[1]] = m[2];
    }
  }
  const args = ArgsSchema.parse(parsed);
  if (args.slug === undefined && args.hotelId === undefined) {
    throw new Error('Provide --slug= or --hotel-id=');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (url === undefined || key === undefined) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(url, key);

  let hotelId = args.hotelId;
  if (hotelId === undefined && args.slug !== undefined) {
    const { data, error } = await supabase
      .from('hotels')
      .select('id')
      .eq('slug', args.slug)
      .maybeSingle();
    if (error !== null) throw error;
    if (data === null) throw new Error(`Hotel not found: ${args.slug}`);
    hotelId = data.id as string;
  }
  if (hotelId === undefined) throw new Error('Could not resolve hotel id');

  const { fetchGiataPropertyById } = await import('@mch/integrations/giata');

  const base =
    process.env['GIATA_MC_BASE_URL'] ??
    process.env['GIATA_API_BASE'] ??
    'https://multicodes.giatamedia.com';
  const username = process.env['GIATA_MC_USERNAME'];
  const password = process.env['GIATA_MC_PASSWORD'] ?? process.env['GIATA_API_KEY'];
  if (username === undefined || password === undefined) {
    throw new Error('Set GIATA_MC_USERNAME and GIATA_MC_PASSWORD');
  }

  const property = await fetchGiataPropertyById(
    {
      baseUrl: base,
      username,
      password,
      ...(process.env['GIATA_MC_API_VERSION'] !== undefined
        ? { apiVersion: process.env['GIATA_MC_API_VERSION'] }
        : {}),
    },
    { giataId: args.giataId },
  );

  if (!property.ok) {
    console.error('GIATA fetch failed:', property.error);
    process.exit(1);
  }

  await supabase.from('hotels').update({ giata_id: args.giataId }).eq('id', hotelId);

  const priorities: Record<string, number> = {
    little_emperors: 10,
    ratehawk: 100,
    travelport: 100,
  };

  let stored = 0;
  let connections = 0;

  for (const row of property.value.supplierRows) {
    const { error: gErr } = await supabase.from('giata_supplier_properties').upsert(
      {
        giata_id: row.giataId,
        supplier: row.supplier,
        supplier_property_key: row.supplierPropertyKey,
        hotel_id: hotelId,
        provider_code_raw: row.providerCodeRaw,
        confidence: 'giata_api',
      },
      { onConflict: 'giata_id,supplier' },
    );
    if (gErr === null) stored += 1;

    const { error: cErr } = await supabase.from('hotel_supplier_connections').upsert(
      {
        hotel_id: hotelId,
        supplier: row.supplier,
        supplier_property_key: row.supplierPropertyKey,
        enabled: true,
        priority: priorities[row.supplier] ?? 100,
      },
      { onConflict: 'hotel_id,supplier' },
    );
    if (cErr === null) connections += 1;
  }

  console.log(
    JSON.stringify(
      {
        hotelId,
        giataId: args.giataId,
        supplierRows: property.value.supplierRows.length,
        giataRowsStored: stored,
        connectionsUpserted: connections,
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
