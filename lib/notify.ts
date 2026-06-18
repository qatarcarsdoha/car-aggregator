/**
 * Push notifications via Expo's push service.
 *
 * After a sync that adds new listings, the scraper calls `notifyNewListings`
 * with the per-source new counts. We read every registered Expo push token from
 * the DB and send ONE summary notification ("12 new cars — Qatar Living 8 ·
 * Mzad 4") to each device. There are no user accounts — it's a personal app, so
 * every registered device gets every notification.
 *
 * Delivery goes through https://exp.host/--/api/v2/push/send. On Android this is
 * relayed via FCM, so the standalone APK must be built with FCM credentials in
 * EAS (see NOTIFICATIONS.md) — but this server code is platform-agnostic.
 *
 * Resilience: this never throws. A push failure must not fail a sync — the sync
 * already committed its rows; notifications are best-effort. Errors are logged.
 *
 * Optional env EXPO_ACCESS_TOKEN — set it (and enable "enhanced security push"
 * in your Expo account) to require an auth token on sends. Works without it.
 */

import { prisma } from "./db";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo accepts up to 100 messages per request.

export interface SourceNewCount {
  source: string; // "qatarliving" | "qatarsale" | "mzadqatar"
  newListings: number;
}

/** Human label for each source, used in the notification body. */
const SOURCE_LABELS: Record<string, string> = {
  qatarliving: "Qatar Living",
  qatarsale: "Qatar Sale",
  mzadqatar: "Mzad Qatar",
};

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, unknown>;
  channelId?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Build the "N new cars" summary copy from per-source counts.
 * Title: "12 new cars" · Body: "Qatar Living 8 · Mzad Qatar 4".
 */
function buildSummary(counts: SourceNewCount[]): { title: string; body: string } {
  const fresh = counts.filter((c) => c.newListings > 0);
  const total = fresh.reduce((sum, c) => sum + c.newListings, 0);
  const title = total === 1 ? "1 new car" : `${total} new cars`;
  const body = fresh
    .map((c) => `${SOURCE_LABELS[c.source] ?? c.source} ${c.newListings}`)
    .join(" · ");
  return { title, body };
}

/** POST one batch of messages to Expo; returns the tickets (or null on failure). */
async function sendBatch(messages: ExpoMessage[]): Promise<ExpoTicket[] | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const res = await fetch(EXPO_PUSH_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error(`[notify] Expo push returned ${res.status} ${res.statusText}`);
    return null;
  }
  const json = (await res.json()) as { data?: ExpoTicket[] };
  return json.data ?? null;
}

/**
 * Send a single "new listings" summary push to every registered device.
 * No-op (returns 0) when there are no new listings or no registered devices.
 * Returns the number of tokens we attempted to notify.
 */
export async function notifyNewListings(counts: SourceNewCount[]): Promise<number> {
  try {
    const total = counts.reduce((sum, c) => sum + c.newListings, 0);
    if (total <= 0) return 0;

    const tokens = await prisma.deviceToken.findMany({ select: { token: true } });
    if (tokens.length === 0) {
      console.log("[notify] No registered devices — skipping push.");
      return 0;
    }

    const { title, body } = buildSummary(counts);
    const messages: ExpoMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      sound: "default",
      channelId: "new-listings",
      data: { type: "new-listings", total },
    }));

    const invalidTokens: string[] = [];
    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
      const tickets = await sendBatch(batch);
      if (!tickets) continue;
      // Tickets map positionally to the batch we sent.
      tickets.forEach((ticket, j) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(batch[j].to);
        } else if (ticket.status === "error") {
          console.warn(`[notify] push error for ${batch[j].to}: ${ticket.message}`);
        }
      });
    }

    // Prune tokens Expo says are dead so we don't keep paying to message them.
    if (invalidTokens.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
      console.log(`[notify] Removed ${invalidTokens.length} dead device token(s).`);
    }

    console.log(
      `[notify] Sent "${title}" (${body}) to ${tokens.length} device(s).`
    );
    return tokens.length;
  } catch (err) {
    // Never let a notification failure break the sync.
    console.error(
      "[notify] Failed to send push (sync is unaffected):",
      err instanceof Error ? err.message : err
    );
    return 0;
  }
}
