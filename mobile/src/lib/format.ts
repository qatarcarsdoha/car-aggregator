/**
 * Formatting helpers + sort options, mirroring the web app's lib/utils +
 * sort-options so the mobile feed presents data identically.
 */

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "mileage_asc", label: "Mileage ↑" },
  { value: "year_desc", label: "Year ↓" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function formatQAR(price: number | null | undefined): string {
  if (price == null) return "Price on request";
  return `QAR ${price.toLocaleString("en-US")}`;
}

export function formatKM(km: number | null | undefined): string | null {
  if (km == null) return null;
  return `${km.toLocaleString("en-US")} km`;
}

/** Human title for a listing, falling back through make/model/year. */
export function listingTitle(l: {
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
}): string {
  const parts = [l.year, l.make, l.model].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return l.title?.trim() || "Untitled listing";
}

export function sourceLabel(source: string): string {
  switch (source) {
    case "qatarliving":
      return "Qatar Living";
    case "qatarsale":
      return "Qatar Sale";
    case "mzadqatar":
      return "Mzad Qatar";
    default:
      return source;
  }
}
