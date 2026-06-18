/**
 * Formatting helpers + sort options, mirroring the web app's lib/utils +
 * sort-options so the mobile feed presents data identically.
 */

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price_asc", label: "Price — low to high" },
  { value: "price_desc", label: "Price — high to low" },
  { value: "mileage_asc", label: "Mileage — low to high" },
  { value: "year_desc", label: "Year — newest model" },
] as const;

/** Short label for the sort trigger button (the dropdown shows the full label). */
export const SORT_SHORT: Record<SortValue, string> = {
  newest: "Newest",
  oldest: "Oldest",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  mileage_asc: "Mileage ↑",
  year_desc: "Year ↓",
};

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Year filter. The dropdown lists real years from the current year down to
 * YEAR_FLOOR, then a single "& earlier" bucket that catches YEAR_FLOOR and
 * anything older. Selecting a real year filters to exactly that year; the
 * bucket filters to <= YEAR_FLOOR.
 */
export const YEAR_FLOOR = 2015;

/** Build year dropdown options (newest first), excluding the leading "All". */
export function buildYearOptions(
  currentYear: number
): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let y = currentYear; y > YEAR_FLOOR; y--) {
    opts.push({ value: String(y), label: String(y) });
  }
  // Trailing "-" marks the catch-all bucket, e.g. "2015-" → <= 2015.
  opts.push({ value: `${YEAR_FLOOR}-`, label: `${YEAR_FLOOR} & earlier` });
  return opts;
}

/** Translate a selected year option value into an inclusive {minYear, maxYear}. */
export function yearValueToRange(value: string | null): {
  minYear: number | null;
  maxYear: number | null;
} {
  if (!value) return { minYear: null, maxYear: null };
  if (value.endsWith("-")) return { minYear: null, maxYear: parseInt(value, 10) };
  const y = parseInt(value, 10);
  return { minYear: y, maxYear: y };
}

/** Compact label for the year trigger pill (the sheet shows the full label). */
export function yearTriggerLabel(value: string | null): string {
  if (!value) return "Year";
  if (value.endsWith("-")) return `≤ ${parseInt(value, 10)}`;
  return value;
}

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

/** Short source tag used in the corner chip, mirroring the web feed (QL / QS). */
export function sourceTag(source: string): string {
  switch (source) {
    case "qatarliving":
      return "QL";
    case "qatarsale":
      return "QS";
    case "mzadqatar":
      return "MZ";
    default:
      return source.slice(0, 2).toUpperCase();
  }
}

/** Compact relative time ("3h ago", "2d ago"), mirroring web lib/utils. */
export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return "";
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/** True when the listing was first seen within the last 24h. */
export function isFresh(firstSeenAt: string | Date | null | undefined): boolean {
  if (!firstSeenAt) return false;
  const t = new Date(firstSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

/**
 * Transform a stored full-size image URL into a feed-sized thumbnail.
 * Mirrors the web app's lib/images.toFeedThumbnail — QL has pre-generated
 * 432x300 webp thumbnails; everything else passes through unchanged.
 */
export function toFeedThumbnail(url: string): string {
  if (!url.includes("qlv-media-prod.qatarliving.com")) return url;
  const lastSlash = url.lastIndexOf("/");
  if (lastSlash === -1) return url;
  const dir = url.slice(0, lastSlash);
  const file = url.slice(lastSlash + 1);
  if (dir.endsWith("/thumbnail")) return url;
  const dot = file.lastIndexOf(".");
  const base = dot === -1 ? file : file.slice(0, dot);
  return `${dir}/thumbnail/${base}_432x300.webp`;
}
