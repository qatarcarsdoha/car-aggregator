/**
 * GET /api/listings/[id] — single listing by cuid for the mobile detail screen.
 * Returns the full Listing row, or 404 JSON when missing.
 * Requires the `x-api-key` header (see lib/api-auth.ts).
 */

import { prisma } from "@/lib/db";
import { requireApiKey, jsonWithCors, CORS_HEADERS } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing) {
    return jsonWithCors({ error: "Not found" }, { status: 404 });
  }

  return jsonWithCors(listing);
}
