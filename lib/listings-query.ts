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

const SORT_TO_ORDER: Record<SortValue, Prisma.ListingOrderByWithRelationInput[]> = {
  newest: [{ sourceUpdatedAt: { sort: "desc", nulls: "last" } }, { sourceAdIdNum: { sort: "desc", nulls: "last" } }],
  oldest: [{ sourceUpdatedAt: { sort: "asc", nulls: "last" } }, { sourceAdIdNum: { sort: "asc", nulls: "last" } }],
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
 * (case-insensitive) filters fed by the dropdowns.
 */
export function buildListingWhere({
  make,
  model,
  q,
}: {
  make?: string | null;
  model?: string | null;
  q?: string | null;
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

  return {
    isActive: true,
    ...(make ? { make: { equals: make, mode: "insensitive" } } : {}),
    ...(model ? { model: { equals: model, mode: "insensitive" } } : {}),
    ...(searchFilter ?? {}),
  };
}
