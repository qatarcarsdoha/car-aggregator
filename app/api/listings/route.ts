/**
 * GET /api/listings — paginated, filtered, sorted listings feed for the mobile app.
 *
 * Query params (same names as the web feed):
 *   page   — 1-indexed page number (default 1)
 *   sort   — one of SORT_OPTIONS values (default "newest")
 *   make   — exact make filter (case-insensitive)
 *   model  — exact model filter (case-insensitive)
 *   q      — free-text search
 *   minYear — inclusive lower bound on model year
 *   maxYear — inclusive upper bound on model year
 *   source  — exact source filter ("qatarliving" | "qatarsale" | "mzadqatar")
 *   perPage — page size (default 20, capped at 50)
 *
 * Returns { items, total, page, perPage, totalPages }.
 * Requires the `x-api-key` header (see lib/api-auth.ts).
 */

import { prisma } from "@/lib/db";
import { buildListingWhere, listingOrderBy, isSortValue } from "@/lib/listings-query";
import { requireApiKey, jsonWithCors, CORS_HEADERS } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

const KNOWN_SOURCES = new Set(["qatarliving", "qatarsale", "mzadqatar"]);

/** Parse a year query param to a positive int, or null if absent/invalid. */
function parseYear(raw: string | null): number | null {
  const n = parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);

  const sortParam = searchParams.get("sort");
  const sort = isSortValue(sortParam) ? sortParam : "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, parseInt(searchParams.get("perPage") ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE)
  );
  const make = searchParams.get("make")?.trim() || null;
  const model = searchParams.get("model")?.trim() || null;
  const q = searchParams.get("q")?.trim() || null;
  const minYear = parseYear(searchParams.get("minYear"));
  const maxYear = parseYear(searchParams.get("maxYear"));
  const sourceParam = searchParams.get("source")?.trim() || null;
  const source = sourceParam && KNOWN_SOURCES.has(sourceParam) ? sourceParam : null;

  const where = buildListingWhere({ make, model, q, minYear, maxYear, source });

  const [total, items] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: listingOrderBy(sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return jsonWithCors({ items, total, page, perPage, totalPages });
}
