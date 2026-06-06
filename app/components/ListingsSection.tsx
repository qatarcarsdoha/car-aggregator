import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ListingCard } from "./ListingCard";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";
import type { SortValue } from "./sort-options";
import { listingOrderBy } from "@/lib/listings-query";

export async function ListingsSection({
  where,
  sort,
  page,
  perPage,
  filtered,
  buildHref,
}: {
  where: Prisma.ListingWhereInput;
  sort: SortValue;
  page: number;
  perPage: number;
  filtered: boolean;
  buildHref: (p: number) => string;
}) {
  const [total, listings] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: listingOrderBy(sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);

  return (
    <section className="px-5 sm:px-8 lg:px-12 py-6 sm:py-8">
      <p className="text-sm mb-5">
        <span className="font-display text-base mr-1">
          {total === 0 ? 0 : (safePage - 1) * perPage + 1}–
          {Math.min(safePage * perPage, total)}
        </span>
        <span className="text-ink-muted">of {total}</span>
      </p>

      {listings.length === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}

      <Pagination page={safePage} totalPages={totalPages} buildHref={buildHref} />
    </section>
  );
}
