/**
 * GET /api/meta — distinct makes (+ models) for the mobile filter dropdowns.
 *
 * Query params:
 *   make — optional; when present, models are scoped to that make.
 *
 * Returns { makes: string[], models: string[] }.
 * Mirrors the distinct-make/model queries in app/page.tsx.
 * Requires the `x-api-key` header (see lib/api-auth.ts).
 */

import { prisma } from "@/lib/db";
import { requireApiKey, jsonWithCors, CORS_HEADERS } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make")?.trim() || null;

  const [makeRows, modelRows] = await Promise.all([
    prisma.listing.findMany({
      where: { isActive: true, make: { not: null } },
      distinct: ["make"],
      select: { make: true },
      orderBy: { make: "asc" },
    }),
    prisma.listing.findMany({
      where: {
        isActive: true,
        model: { not: null },
        ...(make ? { make: { equals: make, mode: "insensitive" } } : {}),
      },
      distinct: ["model"],
      select: { model: true },
      orderBy: { model: "asc" },
    }),
  ]);

  const makes = makeRows
    .map((r) => r.make)
    .filter((m): m is string => !!m && m.trim().length > 0);
  const models = modelRows
    .map((r) => r.model)
    .filter((m): m is string => !!m && m.trim().length > 0);

  return jsonWithCors({ makes, models });
}
