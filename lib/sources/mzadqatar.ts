/**
 * Mzad Qatar vehicles source adapter
 *
 * WHY THIS ONE IS DIFFERENT
 * -------------------------
 * Unlike Qatar Living / Qatar Sale (open JSON APIs reachable by polite fetch),
 * mzadqatar.com is fully behind Cloudflare: HTML pages return a managed JS
 * challenge and the JSON API is WAF-hard-blocked. A direct fetch always gets a
 * "Just a moment…" interstitial. So every request here is routed through
 * ScraperAPI, which solves the Cloudflare challenge server-side and returns the
 * final rendered HTML. Our code stays a plain fetch -> cheerio parse — no
 * headless browser lives in this repo (it runs on ScraperAPI's infra), so the
 * project's "no Playwright" rule still holds.
 *
 * Requires env SCRAPERAPI_KEY (also a GitHub Actions secret).
 *
 * SHAPE (mirrors qatarsale.ts: slim list -> per-listing detail enrichment)
 *   fetchMzadQatarRecent(maxPages)  -> MzadListing[]   (id + detail URL + thumb)
 *   fetchMzadQatarProduct(url)      -> MzadProduct|null (full specs/gallery/phone)
 *   normalizeMzadListing(list, det) -> Prisma.ListingCreateInput
 *
 * URL facts (confirmed during research):
 *   Cars, newest first: https://mzadqatar.com/en/cars/sale   (?page=N for paging)
 *   Detail page:        https://mzadqatar.com/en/products/{slug}--{numericId}
 *     The trailing numeric id is the stable per-ad id -> our `sourceAdId`.
 *
 * PARSING STRATEGY — robustness over precision
 *   The site's CSS class names are unknown/unstable and can change without
 *   notice, and Cloudflare can intermittently block even via ScraperAPI. So we
 *   anchor on the things that almost never move:
 *     - List grid: harvest anchors whose href matches the `...--{digits}`
 *       product pattern, dedupe by numeric id. That's the only thing the list
 *       parse really needs — the detail call fills in the real data.
 *     - Detail page: prefer Open Graph meta tags (og:title/og:image/...) and
 *       JSON-LD, which are stable; fall back to a generic label:value spec
 *       scanner for year/mileage/make/etc. Phone comes from tel:/wa.me links.
 *
 * !!! LIVE VERIFICATION NEEDED !!!
 *   These selectors are best-effort and UNVERIFIED — written without live HTML
 *   because the site is Cloudflare-gated. Once SCRAPERAPI_KEY is set, fetch one
 *   real list page and one detail page (see scripts/inspect-mzad.ts usage in the
 *   plan / verification notes), inspect the actual markup, and tighten the
 *   selectors / spec-label map below. All parsing fails soft so a wrong
 *   selector yields nulls, never a thrown sync.
 */

import type { Prisma } from "@prisma/client";
import * as cheerio from "cheerio";

const SITE_BASE = "https://mzadqatar.com";
const CARS_PATH = "/en/cars/sale";
const SCRAPERAPI_ENDPOINT = "https://api.scraperapi.com/";

// ---------- ScraperAPI fetch ----------

/**
 * Fetch a mzadqatar.com URL through ScraperAPI (Cloudflare-solving proxy).
 *
 * Starts with `render=true` (JS rendering, 10 credits) which clears most managed
 * challenges. If the response still looks like a Cloudflare interstitial, retry
 * once with `ultra_premium=true` (75 credits) which uses the hardened anti-bot
 * path. `country_code=qa` is free and makes the rendered HTML match a Qatar
 * visitor (mzad may geo-vary).
 */
export async function fetchViaScraperApi(targetUrl: string): Promise<string> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) {
    throw new Error(
      "SCRAPERAPI_KEY is not set — required to fetch Cloudflare-gated mzadqatar.com"
    );
  }

  const build = (ultra: boolean) => {
    const p = new URLSearchParams({
      api_key: key,
      url: targetUrl,
      render: "true",
      country_code: "qa",
    });
    if (ultra) p.set("ultra_premium", "true");
    return `${SCRAPERAPI_ENDPOINT}?${p.toString()}`;
  };

  const looksChallenged = (html: string) =>
    /just a moment|cf-mitigated|challenge-platform|cdn-cgi\/challenge/i.test(html);

  for (const ultra of [false, true]) {
    const res = await fetch(build(ultra), { cache: "no-store" });
    if (!res.ok) {
      // 403/500 from ScraperAPI itself usually means the proxy couldn't solve
      // the challenge — escalate to ultra on the next loop iteration.
      if (!ultra) continue;
      throw new Error(
        `ScraperAPI returned ${res.status} ${res.statusText} for ${targetUrl}`
      );
    }
    const html = await res.text();
    if (!looksChallenged(html)) return html;
    if (ultra) {
      throw new Error(
        `Cloudflare challenge not cleared for ${targetUrl} even with ultra_premium`
      );
    }
  }
  // Unreachable, but satisfies the type checker.
  throw new Error(`Failed to fetch ${targetUrl}`);
}

// ---------- Types ----------

export interface MzadListing {
  /** Numeric id parsed from the `...--{id}` detail URL — our sourceAdId. */
  id: number;
  /** Absolute detail-page URL. */
  url: string;
  title?: string | null;
  /** List-grid thumbnail (detail gallery is richer). */
  thumbnail?: string | null;
  priceQAR?: number | null;
}

export interface MzadProduct extends MzadListing {
  description?: string | null;
  images?: string[];
  phone?: string | null;
  location?: string | null;
  dealerName?: string | null;
  /** Raw label:value spec pairs scraped from the detail page. */
  specs?: Record<string, string>;
  /** Snippet of the raw HTML kept in rawData for debugging schema drift. */
  rawHtmlSnippet?: string;
}

// ---------- Small helpers (mirror qatarsale.ts) ----------

function parseIntSafe(s: string | number | undefined | null): number | null {
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) ? Math.trunc(s) : null;
  const n = parseInt(s.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function nonEmpty(s: string | undefined | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function normalizePhone(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9+]/g, "");
  return cleaned.length >= 7 ? cleaned : null;
}

function absoluteUrl(href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, SITE_BASE).toString();
  } catch {
    return null;
  }
}

/** Pull the trailing numeric id out of a `/products/{slug}--{id}` URL. */
export function parseMzadId(url: string): number | null {
  const m = url.match(/--(\d+)(?:[/?#]|$)/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------- List parsing ----------

function parseListPage(html: string): MzadListing[] {
  const $ = cheerio.load(html);
  const byId = new Map<number, MzadListing>();

  $('a[href*="/products/"]').each((_, el) => {
    const href = absoluteUrl($(el).attr("href"));
    if (!href || !/\/products\//.test(href)) return;
    const id = parseMzadId(href);
    if (id == null || byId.has(id)) return;

    // Best-effort card metadata from the anchor's surrounding container.
    // (Unverified selectors — the detail call fills the authoritative data.)
    const card = $(el).closest("li, article, div");
    const img = card.find("img").first();
    const thumbnail =
      absoluteUrl(img.attr("data-src") || img.attr("src") || undefined) ?? null;
    const title =
      nonEmpty($(el).attr("title")) ??
      nonEmpty(img.attr("alt")) ??
      nonEmpty(card.find("h2, h3, .title").first().text());
    const priceText = card
      .find('[class*="price"], [class*="amount"]')
      .first()
      .text();
    const priceQAR = parseIntSafe(priceText);

    byId.set(id, { id, url: href, title, thumbnail, priceQAR });
  });

  return Array.from(byId.values());
}

export async function fetchMzadQatarRecent(maxPages = 2): Promise<MzadListing[]> {
  const all: MzadListing[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= maxPages; page++) {
    const url = `${SITE_BASE}${CARS_PATH}${page > 1 ? `?page=${page}` : ""}`;
    const html = await fetchViaScraperApi(url);
    const listings = parseListPage(html);
    if (listings.length === 0) break; // no more pages (or markup changed)

    let added = 0;
    for (const l of listings) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      all.push(l);
      added++;
    }
    if (added === 0) break; // page returned only dupes — stop paging

    // Politeness between pages (ScraperAPI is slower anyway).
    await new Promise((r) => setTimeout(r, 500));
  }

  return all;
}

// ---------- Detail parsing ----------

/**
 * Generic label:value spec scanner. Mzad detail pages render a spec list whose
 * exact markup we don't know, so we collect candidate pairs from common
 * structures (definition lists, two-cell rows, label/value spans) and key them
 * by a normalized lowercase label. Keep keys raw — mapping to our columns
 * happens in normalizeMzadListing via SPEC_KEYS.
 */
function scrapeSpecs($: cheerio.CheerioAPI): Record<string, string> {
  const specs: Record<string, string> = {};
  const put = (label: string, value: string) => {
    const k = label.trim().toLowerCase().replace(/\s+/g, " ");
    const v = value.trim();
    if (k && v && !specs[k]) specs[k] = v;
  };

  // <dl><dt>Label</dt><dd>Value</dd>
  $("dl").each((_, dl) => {
    const dts = $(dl).find("dt");
    const dds = $(dl).find("dd");
    dts.each((i, dt) => put($(dt).text(), $(dds[i]).text()));
  });

  // Two-cell rows: <tr><td>Label</td><td>Value</td></tr> and
  // <li><span>Label</span><span>Value</span></li> style.
  $("tr, li, .row, .spec, .detail-row").each((_, row) => {
    const cells = $(row).children();
    if (cells.length === 2) {
      put($(cells[0]).text(), $(cells[1]).text());
    }
  });

  return specs;
}

function parseDetailPage(url: string, html: string): MzadProduct {
  const $ = cheerio.load(html);
  const id = parseMzadId(url) ?? 0;

  const meta = (prop: string) =>
    nonEmpty($(`meta[property="${prop}"]`).attr("content")) ??
    nonEmpty($(`meta[name="${prop}"]`).attr("content"));

  const title = meta("og:title") ?? nonEmpty($("h1").first().text()) ?? nonEmpty($("title").text());
  const description = meta("og:description") ?? nonEmpty($('meta[name="description"]').attr("content"));

  // Image gallery: all og:image tags + any large content images, deduped.
  const images = new Set<string>();
  $('meta[property="og:image"]').each((_, el) => {
    const u = absoluteUrl($(el).attr("content") || undefined);
    if (u) images.add(u);
  });
  $('[class*="gallery"] img, [class*="slider"] img, .product-image img').each((_, el) => {
    const u = absoluteUrl($(el).attr("data-src") || $(el).attr("src") || undefined);
    if (u && !/sprite|logo|icon/i.test(u)) images.add(u);
  });

  // Phone: tel: link or wa.me / whatsapp link.
  let phone: string | null = null;
  $('a[href^="tel:"]').each((_, el) => {
    phone = phone ?? normalizePhone($(el).attr("href")?.replace(/^tel:/, ""));
  });
  if (!phone) {
    $('a[href*="wa.me"], a[href*="whatsapp"]').each((_, el) => {
      const m = $(el).attr("href")?.match(/(\d{7,})/);
      phone = phone ?? normalizePhone(m?.[1]);
    });
  }

  const specs = scrapeSpecs($);

  // Price: og price meta, else from specs, else a price-ish element.
  const priceQAR =
    parseIntSafe(meta("product:price:amount")) ??
    parseIntSafe(specs["price"]) ??
    parseIntSafe($('[class*="price"], [class*="amount"]').first().text());

  const location = nonEmpty(specs["location"]) ?? nonEmpty(specs["city"]) ?? nonEmpty(specs["area"]);

  return {
    id,
    url,
    title,
    description,
    priceQAR,
    images: Array.from(images),
    phone,
    location,
    dealerName: nonEmpty(specs["seller"]) ?? nonEmpty(specs["advertiser"]) ?? null,
    specs,
    rawHtmlSnippet: html.slice(0, 4000),
  };
}

export async function fetchMzadQatarProduct(url: string): Promise<MzadProduct | null> {
  const html = await fetchViaScraperApi(url);
  return parseDetailPage(url, html);
}

// ---------- Normalizer ----------

/**
 * Spec-label -> a small extractor. Each key is matched as a substring of the
 * normalized (lowercased) spec label so minor wording differences (and the
 * English half of bilingual labels) still hit. UNVERIFIED — confirm the real
 * labels against a live detail page and adjust.
 */
const SPEC_KEYS = {
  make: ["make", "brand", "manufacturer"],
  model: ["model"],
  year: ["year", "manufacture"],
  mileage: ["mileage", "kilometer", "kilometre", "km", "odometer"],
  fuelType: ["fuel"],
  transmission: ["transmission", "gear"],
  bodyType: ["body"],
  cylinders: ["cylinder"],
  exteriorColor: ["exterior color", "outside color", "color", "colour"],
  interiorColor: ["interior color", "inside color"],
  wheelDrive: ["drive", "wheel"],
} as const;

function specValue(specs: Record<string, string>, candidates: readonly string[]): string | null {
  for (const [label, value] of Object.entries(specs)) {
    if (candidates.some((c) => label.includes(c))) return nonEmpty(value);
  }
  return null;
}

/**
 * Try to pull make/model/year out of a title like
 * "Nissan Patrol 2020 for sale" when the spec list doesn't carry them.
 */
function parseFromTitle(title: string | null | undefined): {
  year: number | null;
  make: string | null;
  model: string | null;
} {
  const t = title?.trim() ?? "";
  const yearMatch = t.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
  const words = t.replace(/\b(19|20)\d{2}\b.*$/, "").trim().split(/\s+/).filter(Boolean);
  return {
    year,
    make: words[0] ?? null,
    model: words[1] ?? null,
  };
}

export function normalizeMzadListing(
  listItem: MzadListing,
  detail?: MzadProduct | null
): Prisma.ListingCreateInput {
  const p: MzadProduct = { ...listItem, ...(detail ?? {}) };
  const specs = p.specs ?? {};

  const fromTitle = parseFromTitle(p.title);

  const make = specValue(specs, SPEC_KEYS.make) ?? fromTitle.make;
  const model = specValue(specs, SPEC_KEYS.model) ?? fromTitle.model;
  const year = parseIntSafe(specValue(specs, SPEC_KEYS.year)) ?? fromTitle.year;
  const mileageKM = parseIntSafe(specValue(specs, SPEC_KEYS.mileage));

  const images: string[] =
    p.images && p.images.length > 0
      ? p.images
      : nonEmpty(p.thumbnail)
        ? [p.thumbnail!]
        : [];

  const phone = normalizePhone(p.phone);

  return {
    source: "mzadqatar",
    sourceAdId: String(p.id),
    sourceAdIdNum: Number.isFinite(p.id) ? p.id : null,
    sourceUrl: p.url,
    // Mzad detail pages show a relative "posted X ago"; we don't have a reliable
    // absolute timestamp, so leave null and let the scraper synthesize ordering
    // from list position (same approach as Qatar Living).
    sourceUpdatedAt: null,

    title: nonEmpty(p.title),
    description: nonEmpty(p.description),

    make,
    model,
    trim: null,
    year,
    priceQAR: p.priceQAR ?? null,
    mileageKM,
    fuelType: specValue(specs, SPEC_KEYS.fuelType),
    cylinders: specValue(specs, SPEC_KEYS.cylinders),
    engineSize: null,
    transmission: specValue(specs, SPEC_KEYS.transmission),
    bodyType: specValue(specs, SPEC_KEYS.bodyType),
    doors: null,
    seats: null,
    seatType: null,
    wheelDrive: specValue(specs, SPEC_KEYS.wheelDrive),
    exteriorColor: specValue(specs, SPEC_KEYS.exteriorColor),
    interiorColor: specValue(specs, SPEC_KEYS.interiorColor),
    imported: null,
    serviceHistory: null,
    insuranceType: null,
    isBrandNew: false,
    isShowroom: false,
    installmentsAvailable: false,
    dealRating: null,

    features: [] as Prisma.InputJsonValue,

    location: nonEmpty(p.location),
    dealerName: nonEmpty(p.dealerName),
    contactPhone: phone,
    contactWhatsapp: phone, // Mzad doesn't distinguish; same number works for both

    images: images as Prisma.InputJsonValue,

    rawData: p as unknown as Prisma.InputJsonValue,
  };
}
