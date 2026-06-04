import { Skeleton } from '@mch/ui';

/**
 * Route-level loading skeleton for the hotel fiche. Mirrors the page's
 * above-the-fold structure (gallery mosaic + title block + booking rail)
 * so the layout doesn't shift when content streams in.
 */
export default function HotelLoading() {
  return (
    <div className="max-w-editorial px-margin-mobile md:px-margin-desktop mx-auto py-8" aria-hidden>
      {/* Gallery mosaic */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:grid-rows-2">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl md:col-span-2 md:row-span-2 md:aspect-auto md:h-full" />
        <Skeleton className="hidden aspect-[4/3] w-full rounded-2xl md:block" />
        <Skeleton className="hidden aspect-[4/3] w-full rounded-2xl md:block" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        {/* Title + body column */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Booking rail */}
        <div className="hidden lg:block">
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
