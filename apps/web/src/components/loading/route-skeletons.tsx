import { Skeleton } from '@mch/ui';

/**
 * Shared route-level loading skeletons for the high-traffic dynamic hubs and
 * editorial templates (Cluster 3 perf audit — ~28 force-dynamic routes had no
 * `loading.tsx`, so client navigations froze the previous page until the RSC
 * payload resolved). Kept deliberately light: a header band + a card grid for
 * directory hubs, and a hero/intro/content stack for editorial templates.
 *
 * Each `loading.tsx` is a thin wrapper around one of these so the skeletons
 * stay consistent and maintainable. Mirrors `recherche/loading.tsx`.
 */

/** Directory hub skeleton — header + responsive card grid. */
export function HubGridSkeleton({ cards = 9 }: { readonly cards?: number }) {
  return (
    <div
      className="max-w-editorial px-margin-mobile md:px-margin-desktop mx-auto py-10"
      aria-hidden
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-2/3 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-5 w-4/5 max-w-xl" />

      <div className="gap-gutter mt-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Editorial template skeleton (destination hub, ranking page) — a hero band,
 * an intro block, and a stack of content rows. `min-h` keeps the footer below
 * the fold so it doesn't jump when the long page streams in (CLS guard).
 */
export function EditorialTemplateSkeleton() {
  return (
    <main
      className="max-w-editorial container mx-auto min-h-[140vh] px-4 py-10 sm:py-14"
      aria-hidden
    >
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Hero band */}
      <Skeleton className="h-[42vh] max-h-[420px] w-full rounded-2xl" />

      {/* Title + intro */}
      <Skeleton className="mt-8 h-10 w-3/4 max-w-2xl" />
      <div className="mt-5 flex flex-col gap-3">
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-11/12 max-w-2xl" />
      </div>

      {/* Content rows */}
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  );
}
