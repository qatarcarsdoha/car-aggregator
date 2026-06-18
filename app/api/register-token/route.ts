/**
 * POST /api/register-token — register an Expo push token for this device.
 *
 * The mobile app calls this on launch (after the user grants notification
 * permission) with its Expo push token. We upsert by token so re-registering is
 * idempotent and just bumps `lastSeenAt`. The scraper later reads every token
 * and pushes a "N new cars" summary after a sync that added listings.
 *
 * Body: { token: string, platform?: "android" | "ios" }
 * Requires the `x-api-key` header (see lib/api-auth.ts).
 */

import { prisma } from "@/lib/db";
import { requireApiKey, jsonWithCors, CORS_HEADERS } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const unauthorized = requireApiKey(req);
  if (unauthorized) return unauthorized;

  let body: { token?: unknown; platform?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonWithCors({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  // Expo tokens look like ExponentPushToken[...] or ExpoPushToken[...].
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
    return jsonWithCors({ error: "Invalid Expo push token" }, { status: 400 });
  }

  const platform =
    body.platform === "android" || body.platform === "ios" ? body.platform : null;

  await prisma.deviceToken.upsert({
    where: { token },
    create: { token, platform },
    update: { platform }, // lastSeenAt auto-bumps via @updatedAt
  });

  return jsonWithCors({ ok: true });
}
