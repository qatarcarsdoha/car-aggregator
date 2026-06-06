/**
 * Shared-secret guard for the mobile REST API (`/api/*`).
 *
 * The Android app sends a static `x-api-key` header (baked into the APK at build
 * time) that must match `MOBILE_API_KEY`. This is light protection appropriate
 * for a personal 2-person app over already-public aggregated listings — it keeps
 * the public Vercel API from being trivially scraped, not a real auth boundary.
 *
 * If `MOBILE_API_KEY` is unset, the guard fails closed (everything is 401) so we
 * never accidentally ship an open API to production.
 */

import { NextResponse } from "next/server";

export function requireApiKey(req: Request): NextResponse | null {
  const expected = process.env.MOBILE_API_KEY;
  const provided = req.headers.get("x-api-key");

  if (!expected || provided !== expected) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }
  return null;
}

/**
 * Permissive CORS — the RN app isn't a browser so this isn't strictly required,
 * but it keeps a future web-debug client (or Expo web) trivial. Echoing `*` is
 * fine here since the API is already key-gated and serves public data.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
} as const;

export function jsonWithCors(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}
