/**
 * Mzad Qatar selector-verification helper.
 *
 * The mzadqatar.com adapter (lib/sources/mzadqatar.ts) was written WITHOUT live
 * HTML because the site is Cloudflare-gated. Run this once SCRAPPINGBEE_KEY is set
 * to confirm the parser works against the real markup and to eyeball the raw
 * HTML so you can tighten the (currently best-effort) selectors.
 *
 * Usage:
 *   SCRAPPINGBEE_KEY=... npx tsx scripts/inspect-mzad.ts
 *   SCRAPPINGBEE_KEY=... npx tsx scripts/inspect-mzad.ts "https://mzadqatar.com/en/products/...--123"
 *
 * It will:
 *   1. Fetch the cars list, report how many product links were parsed, print
 *      the first few parsed MzadListings.
 *   2. Fetch the first (or given) detail page, print the parsed MzadProduct and
 *      the full normalized Prisma row.
 *   3. Save the raw HTML of both pages to /tmp for manual inspection.
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import {
  fetchViaProxy,
  fetchMzadQatarRecent,
  fetchMzadQatarProduct,
  normalizeMzadListing,
} from "../lib/sources/mzadqatar";

async function main() {
  const overrideDetailUrl = process.argv[2];

  console.log("=== Fetching cars list via ScrapingBee ===");
  const listHtml = await fetchViaProxy("https://mzadqatar.com/en/cars/sale");
  writeFileSync("/tmp/mzad-list.html", listHtml);
  console.log(`Saved raw list HTML to /tmp/mzad-list.html (${listHtml.length} bytes)`);

  const listings = await fetchMzadQatarRecent(1);
  console.log(`Parsed ${listings.length} listings from the grid.`);
  console.log("First 3:", JSON.stringify(listings.slice(0, 3), null, 2));

  const detailUrl = overrideDetailUrl ?? listings[0]?.url;
  if (!detailUrl) {
    console.error("No detail URL to inspect — list parse found nothing. Check /tmp/mzad-list.html.");
    process.exit(1);
  }

  console.log(`\n=== Fetching detail page: ${detailUrl} ===`);
  const detailHtml = await fetchViaProxy(detailUrl);
  writeFileSync("/tmp/mzad-detail.html", detailHtml);
  console.log(`Saved raw detail HTML to /tmp/mzad-detail.html (${detailHtml.length} bytes)`);

  const detail = await fetchMzadQatarProduct(detailUrl);
  console.log("Parsed detail:", JSON.stringify({ ...detail, rawHtmlSnippet: "<omitted>" }, null, 2));

  const listItem = listings.find((l) => l.url === detailUrl) ?? {
    id: detail!.id,
    url: detailUrl,
  };
  const normalized = normalizeMzadListing(listItem, detail);
  console.log("\n=== Normalized Prisma row ===");
  console.log(JSON.stringify({ ...normalized, rawData: "<omitted>" }, null, 2));
}

main().catch((err) => {
  console.error("inspect-mzad failed:", err);
  process.exit(1);
});
