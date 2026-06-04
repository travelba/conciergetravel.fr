import { Skeleton } from '@mch/ui';

/**
 * Route-level loading skeleton for the search/listing page — a filter rail
 * plus a responsive grid of card placeholders.
 */
export default function RechercheLoading() {
  return (
    <div className="max-w-editorial px-margin-mobile md:px-margin-desktop mx-auto py-8" aria-hidden>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-40" />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        {/* Facet rail */}
        <div className="hidden flex-col gap-4 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>

        {/* Results grid */}
        <div className="gap-gutter grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
