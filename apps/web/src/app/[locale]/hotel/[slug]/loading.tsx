import { Skeleton } from '@mch/ui';

/**
 * Route-level loading skeleton for the hotel fiche.
 *
 * It mirrors the page's above-the-fold structure *and matches its vertical
 * footprint* so the layout doesn't shift when the streamed content replaces
 * the fallback (CLS fix — `/hotel/[slug]` measured 0.130):
 *
 *  - same `<main>` wrapper classes (max width, container, padding) as
 *    `page.tsx`;
 *  - a breadcrumb row + gallery filter-tab row above the mosaic — the real
 *    page renders both above the gallery (`<nav>` + `HotelGallery` tabs);
 *    without them the gallery, and everything below it, jumped down ~70px on
 *    hydration;
 *  - the same gallery footprint: mobile = 2-up then 3-up `aspect-[4/3]`
 *    tiles, desktop = the `h-[440px]` 4×2 mosaic;
 *  - a `min-h` taller than any viewport so the site footer (rendered by the
 *    locale layout right after this Suspense boundary, inside the
 *    `flex-1` `#main` slot) starts *below the fold*. The previous short
 *    skeleton let `#main` collapse to one viewport, pinning the footer to
 *    the bottom edge of the fold; when the real ~25 000 px page streamed in,
 *    the footer was shoved ~24 000 px down — the dominant CLS source.
 */
export default function HotelLoading() {
  return (
    <main
      className="max-w-editorial container mx-auto min-h-[180vh] px-4 py-10 sm:py-14"
      aria-hidden
    >
      {/* Breadcrumb (mirrors the page <nav> above the gallery) */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Gallery filter tabs (mirrors HotelGallery's mosaic tablist) */}
      <div className="mb-3 flex gap-3">
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-14" />
      </div>

      {/* Gallery mosaic — mobile: 2-up then 3-up; desktop: h-[440px] 4×2 */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-1.5">
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
          <Skeleton className="aspect-[4/3] w-full rounded-md" />
        </div>
      </div>
      <div className="hidden h-[440px] grid-cols-4 grid-rows-2 gap-2.5 md:grid">
        <Skeleton className="col-span-2 row-span-2 h-full w-full rounded-2xl" />
        <Skeleton className="h-full w-full rounded-2xl" />
        <Skeleton className="h-full w-full rounded-2xl" />
        <Skeleton className="h-full w-full rounded-2xl" />
        <Skeleton className="h-full w-full rounded-2xl" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Title + body column */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-48" />
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
    </main>
  );
}
