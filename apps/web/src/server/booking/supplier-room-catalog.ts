import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Read cached supplier static room media from `supplier_room_catalog`
 * (migration 0071) for the NON-INDEXED booking funnel only.
 *
 * EEAT / indexability contract: these supplier-hosted images (Travelport /
 * Leonardo, RateHawk) are funnel-only — never surface them on a page that
 * emits `index,follow`. The indexable surface keeps curated Cloudinary photos.
 *
 * Returns a `label -> first image URL` map keyed by the supplier room label
 * (`supplier_room_key.labels[0]`, falling back to `room_name`) so the funnel
 * can use it as a fallback room visual when no editorial Cloudinary photo is
 * mapped to a live supplier label.
 */
export async function getSupplierRoomImagesByLabel(input: {
  readonly hotelId: string;
  readonly supplier: 'travelport' | 'ratehawk';
}): Promise<Record<string, string>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('supplier_room_catalog')
    .select('supplier_room_key, room_name, images')
    .eq('hotel_id', input.hotelId)
    .eq('supplier', input.supplier);

  if (error !== null || !Array.isArray(data)) return {};

  const out: Record<string, string> = {};
  for (const raw of data) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as {
      supplier_room_key?: unknown;
      room_name?: unknown;
      images?: unknown;
    };

    const firstImage = Array.isArray(row.images)
      ? row.images.find((u): u is string => typeof u === 'string' && u.length > 0)
      : undefined;
    if (firstImage === undefined) continue;

    const labels: string[] = [];
    const key = row.supplier_room_key;
    if (
      typeof key === 'object' &&
      key !== null &&
      Array.isArray((key as { labels?: unknown }).labels)
    ) {
      for (const l of (key as { labels: unknown[] }).labels) {
        if (typeof l === 'string' && l.length > 0) labels.push(l);
      }
    }
    if (typeof row.room_name === 'string' && row.room_name.length > 0) labels.push(row.room_name);

    for (const label of labels) {
      if (out[label] === undefined) out[label] = firstImage;
    }
  }
  return out;
}
