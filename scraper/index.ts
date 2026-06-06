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

async function syncQatarLiving(): Promise<void> {
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

async function syncQatarSale(): Promise<void> {
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

async function syncMzadQatar(): Promise<void> {
  const run = await prisma.syncRun.create({
    data: { source: "mzadqatar", status: "running" },
  });

  let newListings = 0;
  let updatedListings = 0;
  let pagesFetched = 0;

  try {
    // Mzad pages are fetched through ScraperAPI (Cloudflare-solving proxy), so
    // keep page count low — each page is a paid, slow request.
    const maxPages = 2;
    const listings = await fetchMzadQatarRecent(maxPages);
    pagesFetched = maxPages;

    console.log(
      `[mzadqatar] Fetched ${listings.length} listings — enriching with details`
    );

    // Mzad has no reliable absolute timestamp, so (like Qatar Living) synthesize
    // a sourceUpdatedAt from batch time minus list position to keep "newest"
    // ordering stable. The list is already newest-first.
    const batchStart = Date.now();
    let position = 0;

    for (const listItem of listings) {
      // Tolerate per-listing detail failures — fall back to slim list data so a
      // single bad page (or a Cloudflare hiccup) doesn't kill the whole sync.
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
      const sourceUpdatedAt = new Date(batchStart - position);
      position++;

      const result = await prisma.listing.upsert({
        where: {
          source_sourceAdId: {
            source: "mzadqatar",
            sourceAdId: String(listItem.id),
          },
        },
        create: { ...data, sourceUpdatedAt },
        update: { ...data, sourceUpdatedAt, isActive: true },
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
      `[mzadqatar] Done. New: ${newListings}, Updated: ${updatedListings}`
    );

    await pruneSource("mzadqatar", PRUNE_MAX_PER_SOURCE);
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

  const sources: Record<SourceName, () => Promise<void>> = {
    qatarliving: syncQatarLiving,
    qatarsale: syncQatarSale,
    mzadqatar: syncMzadQatar,
  };

  if (arg) {
    if (!sources[arg]) {
      console.error(`Unknown source: ${arg}`);
      process.exit(1);
    }
    await sources[arg]();
  } else {
    for (const name of Object.keys(sources) as SourceName[]) {
      try {
        await sources[name]();
      } catch (err) {
        console.error(`[${name}] sync failed but continuing:`, err);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
