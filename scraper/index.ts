/**
 * Scraper entrypoint
 *
 * Run locally:        npm run sync
 * Run single source:  npm run sync:qatarliving
 *
 * Triggered by GitHub Actions on schedule (.github/workflows/scrape.yml)
 * Requires DATABASE_URL env var.
 */

import "dotenv/config";
import { prisma } from "../lib/db";
import {
  fetchQatarLivingRecent,
  normalizeQLListing,
} from "../lib/sources/qatarliving";
import {
  fetchQatarSaleRecent,
  fetchQatarSaleProduct,
  normalizeQSListing,
} from "../lib/sources/qatarsale";
import {
  fetchMzadQatarRecent,
  fetchMzadQatarProduct,
  normalizeMzadListing,
} from "../lib/sources/mzadqatar";
import { notifyNewListings, type SourceNewCount } from "../lib/notify";

type SourceName = "qatarliving" | "qatarsale" | "mzadqatar";

const PRUNE_MAX_PER_SOURCE = Number(process.env.PRUNE_MAX_PER_SOURCE ?? 500);

/**
 * Hard-cap each source's row count by deleting the rows with the oldest
 * `lastSeenAt`. Only call this AFTER a successful sync — if we prune on a
 * failed run, every row will look stale and we'll wipe the DB.
 */
async function pruneSource(source: SourceName, max: number): Promise<void> {
  const total = await prisma.listing.count({ where: { source } });
  if (total <= max) {
    console.log(`[${source}] Prune skipped — ${total} ≤ ${max}`);
    return;
  }
  const excess = total - max;
  const victims = await prisma.listing.findMany({
    where: { source },
    orderBy: { lastSeenAt: "asc" },
    take: excess,
    select: { id: true },
  });
  const { count } = await prisma.listing.deleteMany({
    where: { id: { in: victims.map((v) => v.id) } },
  });
  console.log(`[${source}] Pruned ${count} oldest rows (keeping ${max})`);
}

async function syncQatarLiving(): Promise<number> {
  const run = await prisma.syncRun.create({
    data: { source: "qatarliving", status: "running" },
  });

  let newListings = 0;
  let updatedListings = 0;
  let pagesFetched = 0;

  try {
    // QL's first ~78 results are promoted (filtered out by fetchQatarLivingRecent).
    // 4 pages × per_page=50 covers the promoted block + ~120 fresh listings.
    const ads = await fetchQatarLivingRecent(4);
    pagesFetched = 4;

    console.log(`[qatarliving] Fetched ${ads.length} listings`);

    // Most QL listings have no date field — only promoted ads carry `styleGenerated`.
    // To keep "newest" sort working, synthesize a sourceUpdatedAt from batch time
    // minus the listing's position in the API-sorted (adId DESC) array. Position 0
    // (highest adId) gets the latest timestamp. This also overwrites the (null)
    // sourceUpdatedAt on existing records each re-sync, so they re-rank correctly.
    const batchStart = Date.now();
    let position = 0;
    for (const ad of ads) {
      const data = normalizeQLListing(ad);
      const sourceUpdatedAt =
        data.sourceUpdatedAt ?? new Date(batchStart - position);
      position++;

      // Update all fields except firstSeenAt (which uses @default(now())
      // and is never passed in `data`, so it's preserved automatically).
      const result = await prisma.listing.upsert({
        where: {
          source_sourceAdId: {
            source: "qatarliving",
            sourceAdId: String(ad.adId),
          },
        },
        create: { ...data, sourceUpdatedAt },
        update: { ...data, sourceUpdatedAt, isActive: true },
      });

      // Heuristic for "new vs updated": if lastSeenAt is essentially equal to firstSeenAt,
      // this was just inserted.
      const ageMs = result.lastSeenAt.getTime() - result.firstSeenAt.getTime();
      if (ageMs < 5000) newListings++;
      else updatedListings++;
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        pagesFetched,
        newListings,
        updatedListings,
      },
    });

    console.log(
      `[qatarliving] Done. New: ${newListings}, Updated: ${updatedListings}`
    );

    await pruneSource("qatarliving", PRUNE_MAX_PER_SOURCE);
    return newListings;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[qatarliving] FAILED:`, message);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        pagesFetched,
        newListings,
        updatedListings,
        error: message,
      },
    });
    throw err;
  }
}

async function syncQatarSale(): Promise<number> {
  const run = await prisma.syncRun.create({
    data: { source: "qatarsale", status: "running" },
  });

  let newListings = 0;
  let updatedListings = 0;
  let pagesFetched = 0;

  try {
    // QS API returns 35 listings per page, page-0 = newest first.
    const maxPages = 2;
    const ads = await fetchQatarSaleRecent(maxPages);
    pagesFetched = maxPages;

    console.log(`[qatarsale] Fetched ${ads.length} listings — enriching with details`);

    for (const ad of ads) {
      // Fetch the rich detail (images, phone, full definitions).
      // Tolerate per-listing detail failures — fall back to slim data so a
      // single 404 doesn't kill the whole sync.
      let detail = null;
      try {
        detail = await fetchQatarSaleProduct(ad.id);
      } catch (e) {
        console.warn(
          `[qatarsale] detail fetch failed for ${ad.id}; using slim data:`,
          e instanceof Error ? e.message : e
        );
      }
      // Politeness throttle between detail calls.
      await new Promise((r) => setTimeout(r, 200));

      const data = normalizeQSListing(ad, detail);

      const result = await prisma.listing.upsert({
        where: {
          source_sourceAdId: {
            source: "qatarsale",
            sourceAdId: String(ad.id),
          },
        },
        create: data,
        update: { ...data, isActive: true },
      });

      const ageMs = result.lastSeenAt.getTime() - result.firstSeenAt.getTime();
      if (ageMs < 5000) newListings++;
      else updatedListings++;
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        pagesFetched,
        newListings,
        updatedListings,
      },
    });

    console.log(
      `[qatarsale] Done. New: ${newListings}, Updated: ${updatedListings}`
    );

    await pruneSource("qatarsale", PRUNE_MAX_PER_SOURCE);
    return newListings;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[qatarsale] FAILED:`, message);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        pagesFetched,
        newListings,
        updatedListings,
        error: message,
      },
    });
    throw err;
  }
}

async function syncMzadQatar(): Promise<number> {
  const run = await prisma.syncRun.create({
    data: { source: "mzadqatar", status: "running" },
  });

  let newListings = 0;
  let updatedListings = 0;
  let pagesFetched = 0;

  try {
    // Each mzad page is a paid ScrapingBee request (~10 credits). At our 30-min
    // cron the first page (~50 newest ads) reliably covers everything posted
    // since the last run, so default to a single page; MZAD_MAX_PAGES can bump
    // it if gaps ever appear.
    const maxPages = Number(process.env.MZAD_MAX_PAGES ?? 1);
    // Safety valve: cap paid detail calls per run so a one-off surge (or a first
    // populate against an empty DB) can't burn an unbounded number of credits in
    // a single run. New ads beyond the cap are deferred to the next run (they're
    // still on page 1), so we catch up without ever spiking spend.
    const maxDetailPerRun = Number(process.env.MZAD_MAX_DETAIL_PER_RUN ?? 60);

    const listings = await fetchMzadQatarRecent(maxPages);
    pagesFetched = maxPages;

    console.log(
      `[mzadqatar] Fetched ${listings.length} listings — enriching with details`
    );

    // Prefer mzad's real posting time (dateOfAdvertise, carried per listing).
    // Synthesize a batch-time-minus-position order only as a fallback when it's
    // missing, to keep "newest" ordering stable.
    const batchStart = Date.now();
    let position = 0;
    let detailsFetched = 0;

    for (const listItem of listings) {
      // Prefer mzad's real posting time (dateOfAdvertise); fall back to a
      // synthesized list-position order only when it's missing.
      const sourceUpdatedAt =
        listItem.dateMs && listItem.dateMs > 0
          ? new Date(listItem.dateMs)
          : new Date(batchStart - position);
      position++;

      // Already enriched on a prior run? mzad ads don't change after posting, so
      // skip the paid ScrapingBee detail call — just mark it seen/active and
      // refresh the synthesized ordering. This keeps credit spend on genuinely
      // new listings only (the detail call is the expensive part).
      const existing = await prisma.listing.findUnique({
        where: {
          source_sourceAdId: {
            source: "mzadqatar",
            sourceAdId: String(listItem.id),
          },
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.listing.update({
          where: { id: existing.id },
          // lastSeenAt auto-updates via @updatedAt; firstSeenAt is preserved.
          data: { isActive: true, sourceUpdatedAt },
        });
        updatedListings++;
        continue;
      }

      // New ad — fetch full detail (one paid request). Tolerate per-listing
      // failures: fall back to slim list data so a single bad page doesn't kill
      // the whole sync.
      if (detailsFetched >= maxDetailPerRun) {
        console.warn(
          `[mzadqatar] hit detail cap (${maxDetailPerRun}) — deferring ` +
            `remaining new ads to the next run`
        );
        break;
      }
      detailsFetched++; // count the credit-spending attempt, success or not
      let detail = null;
      try {
        detail = await fetchMzadQatarProduct(listItem.url);
      } catch (e) {
        console.warn(
          `[mzadqatar] detail fetch failed for ${listItem.id}; using slim data:`,
          e instanceof Error ? e.message : e
        );
      }
      // Politeness throttle between detail calls.
      await new Promise((r) => setTimeout(r, 300));

      const data = normalizeMzadListing(listItem, detail);
      await prisma.listing.create({ data: { ...data, sourceUpdatedAt } });
      newListings++;
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        pagesFetched,
        newListings,
        updatedListings,
      },
    });

    // Rough credit check against the 250k/month ScrapingBee budget: every
    // ScrapingBee request (list page + each new-ad detail) is ~10 Tier-1 credits.
    const estCredits = (pagesFetched + detailsFetched) * 10;
    console.log(
      `[mzadqatar] Done. New: ${newListings}, Updated: ${updatedListings}, ` +
        `detail fetches: ${detailsFetched}, est. ScrapingBee credits: ~${estCredits}`
    );

    await pruneSource("mzadqatar", PRUNE_MAX_PER_SOURCE);
    return newListings;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mzadqatar] FAILED:`, message);

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        pagesFetched,
        newListings,
        updatedListings,
        error: message,
      },
    });
    throw err;
  }
}

async function main() {
  const arg = process.argv[2] as SourceName | undefined;

  const sources: Record<SourceName, () => Promise<number>> = {
    qatarliving: syncQatarLiving,
    qatarsale: syncQatarSale,
    mzadqatar: syncMzadQatar,
  };

  // Collect per-source new-listing counts so we can fire ONE summary push after
  // the whole run, rather than spamming a notification per source.
  const counts: SourceNewCount[] = [];

  if (arg) {
    if (!sources[arg]) {
      console.error(`Unknown source: ${arg}`);
      process.exit(1);
    }
    counts.push({ source: arg, newListings: await sources[arg]() });
  } else {
    for (const name of Object.keys(sources) as SourceName[]) {
      try {
        counts.push({ source: name, newListings: await sources[name]() });
      } catch (err) {
        console.error(`[${name}] sync failed but continuing:`, err);
      }
    }
  }

  // Best-effort: notify registered devices when this run added listings.
  await notifyNewListings(counts);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
