/**
 * Shared listings query logic.
 *
 * The `where` builder and the sort→orderBy map are used by both the web feed
 * (Server Components in `app/page.tsx` + `app/components/ListingsSection.tsx`)
 * and the mobile REST API (`app/api/listings`). Keep them here so the web app
 * and the app stay in lockstep — same filtering, same ordering.
 */

import type { Prisma } from "@prisma/client";
import { SORT_OPTIONS, type SortValue } from "@/app/components/sort-options";

export type { SortValue };

export function isSortValue(v: string | undefined | null): v is SortValue {
  return !!v && SORT_OPTIONS.some((o) => o.value === v);
}

// "newest"/"oldest" rank by firstSeenAt — when the ad first entered our DB —
// which is the app's true "recently added" signal and is fair across sources.
// (sourceUpdatedAt was unfair: the QL scraper re-stamps it to ~now every sync,
// so QL's ~200 ads flooded the top and buried Qatar Sale + Mzad. firstSeenAt is
// set once and preserved, so each source interleaves by genuine arrival time.)
const SORT_TO_ORDER: Record<SortValue, Prisma.ListingOrderByWithRelationInput[]> = {
  newest: [{ firstSeenAt: "desc" }, { sourceAdIdNum: { sort: "desc", nulls: "last" } }],
  oldest: [{ firstSeenAt: "asc" }, { sourceAdIdNum: { sort: "asc", nulls: "last" } }],
  price_asc: [{ priceQAR: { sort: "asc", nulls: "last" } }],
  price_desc: [{ priceQAR: { sort: "desc", nulls: "last" } }],
  mileage_asc: [{ mileageKM: { sort: "asc", nulls: "last" } }],
  year_desc: [{ year: { sort: "desc", nulls: "last" } }],
};

export function listingOrderBy(sort: SortValue): Prisma.ListingOrderByWithRelationInput[] {
  return SORT_TO_ORDER[sort];
}

/**
 * Build the Prisma `where` for the active listings feed.
 *
 * Free-text `q` searches across the fields most useful for finding a car: make,
 * model, trim, title (often holds variant + descriptor), body type, exterior
 * color, fuel, location, dealer name, and the descriptive blob. Year is matched
 * too if the query parses as a 4-digit number. `make`/`model` are exact
 * (case-insensitive) filters fed by the dropdowns. `minYear`/`maxYear` bound the
 * model year (inclusive): the year dropdown sends a `minYear` floor for its
 * "last N years" recency buckets. `source` is an exact filter on the listing
 * origin ("qatarliving" | "qatarsale" | "mzadqatar").
 */
export function buildListingWhere({
  make,
  model,
  q,
  minYear,
  maxYear,
  source,
}: {
  make?: string | null;
  model?: string | null;
  q?: string | null;
  minYear?: number | null;
  maxYear?: number | null;
  source?: string | null;
}): Prisma.ListingWhereInput {
  const qYear = q && /^\d{4}$/.test(q) ? parseInt(q, 10) : null;
  const searchFilter: Prisma.ListingWhereInput | null = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { make: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
          { trim: { contains: q, mode: "insensitive" } },
          { bodyType: { contains: q, mode: "insensitive" } },
          { exteriorColor: { contains: q, mode: "insensitive" } },
          { fuelType: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { dealerName: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          ...(qYear ? [{ year: qYear } as Prisma.ListingWhereInput] : []),
        ],
      }
    : null;

  const yearFilter =
    minYear != null || maxYear != null
      ? {
          year: {
            ...(minYear != null ? { gte: minYear } : {}),
            ...(maxYear != null ? { lte: maxYear } : {}),
          },
        }
      : null;

  return {
    isActive: true,
    ...(make ? { make: { equals: make, mode: "insensitive" } } : {}),
    ...(model ? { model: { equals: model, mode: "insensitive" } } : {}),
    ...(source ? { source } : {}),
    ...(yearFilter ?? {}),
    ...(searchFilter ?? {}),
  };
}
