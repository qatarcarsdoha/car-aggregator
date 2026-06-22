/**
 * /api/sync — the "doorbell". Ringing it triggers a fresh sync.
 *
 * Why this is so thin: the actual sync (QL + QS + Mzad, with throttled detail
 * enrichment) takes 1–3 min, which is well over Vercel's serverless timeout.
 * So we never run the sync here. Instead this route pokes GitHub via
 * `workflow_dispatch`, and the existing scrape.yml workflow does the heavy
 * lifting on a GitHub runner (no timeout, free). This returns in ~1s.
 *
 * Two callers, one endpoint:
 *  - cron-job.org rings it every hour (the reliable timer that replaces
 *    GitHub's flaky `schedule` trigger). Auth: `Authorization: Bearer <CRON_SECRET>`.
 *  - the mobile app's "Sync now" button rings it on demand. Auth: same Bearer,
 *    or the app's `x-api-key` header.
 *
 * Requires env:
 *  - CRON_SECRET        — shared secret for the Bearer guard (already set).
 *  - GH_DISPATCH_TOKEN  — GitHub PAT with Actions read+write on this repo.
 *  - GH_REPO            — optional, defaults to "qatarcarsdoha/car-aggregator".
 *  - GH_WORKFLOW        — optional, defaults to "scrape.yml".
 *  - GH_REF             — optional branch to run on, defaults to "main".
 */

import { jsonWithCors, CORS_HEADERS, requireApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const GH_REPO = process.env.GH_REPO ?? "qatarcarsdoha/car-aggregator";
const GH_WORKFLOW = process.env.GH_WORKFLOW ?? "scrape.yml";
const GH_REF = process.env.GH_REF ?? "main";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Accept the caller if EITHER:
 *  - it presents `Authorization: Bearer <CRON_SECRET>` (cron-job.org), or
 *  - it presents a valid `x-api-key` (the mobile app).
 * Fails closed if CRON_SECRET is unset.
 */
function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  // Fall back to the mobile app's key guard (returns null when authorized).
  return requireApiKey(req) === null;
}

async function trigger(req: Request) {
  if (!authorize(req)) {
    return jsonWithCors({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return jsonWithCors(
      { error: "GH_DISPATCH_TOKEN is not set" },
      { status: 500 }
    );
  }

  const url = `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "car-aggregator-sync",
    },
    body: JSON.stringify({ ref: GH_REF }),
  });

  // GitHub returns 204 No Content on a successful dispatch.
  if (res.status === 204) {
    return jsonWithCors({ queued: true });
  }

  const detail = await res.text();
  return jsonWithCors(
    { error: "Failed to dispatch workflow", status: res.status, detail },
    { status: 502 }
  );
}

// GET so cron-job.org can ring it with just a URL + Bearer header.
export async function GET(req: Request) {
  return trigger(req);
}

// POST for the mobile "Sync now" button.
export async function POST(req: Request) {
  return trigger(req);
}
