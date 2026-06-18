import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Full source name for headings (mirrors mobile format.ts sourceLabel). */
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

/** Short corner-chip tag (mirrors mobile format.ts sourceTag): QL / QS / MZ. */
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

export function formatQAR(price: number | null | undefined): string {
  if (price == null) return "Price on request";
  return `QAR ${price.toLocaleString("en-US")}`;
}

export function formatKM(km: number | null | undefined): string {
  if (km == null) return "—";
  return `${km.toLocaleString("en-US")} km`;
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - then.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(day / 365);
  return `${yr}y ago`;
}
