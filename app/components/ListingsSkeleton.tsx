import { Skeleton } from "@/components/ui/skeleton";

export function ListingsSkeleton({ perPage }: { perPage: number }) {
  return (
    <section className="px-5 sm:px-8 lg:px-12 py-6 sm:py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
        {Array.from({ length: perPage }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function ListingCardSkeleton() {
  return (
    <article className="bg-paper rounded-2xl overflow-hidden border border-ink/5 shadow-soft h-full flex flex-col">
      <Skeleton className="aspect-[4/3] w-full rounded-none bg-sand" />
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-5 w-2/3 bg-sand" />
          <Skeleton className="h-3 w-10 bg-sand" />
        </div>
        <Skeleton className="h-3 w-1/2 bg-sand" />
        <div className="flex flex-wrap gap-2 mt-1">
          <Skeleton className="h-3 w-16 bg-sand" />
          <Skeleton className="h-3 w-20 bg-sand" />
          <Skeleton className="h-3 w-14 bg-sand" />
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-ink/5">
          <Skeleton className="h-2.5 w-24 bg-sand" />
          <Skeleton className="h-2.5 w-12 bg-sand" />
        </div>
      </div>
    </article>
  );
}
