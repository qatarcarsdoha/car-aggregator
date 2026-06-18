/**
 * Mzad Qatar vehicles source adapter
 *
 * WHY THIS ONE IS DIFFERENT
 * -------------------------
 * Unlike Qatar Living / Qatar Sale (open JSON APIs reachable by polite fetch),
 * mzadqatar.com is fully behind Cloudflare: HTML pages return a managed JS
 * challenge and the JSON API is WAF-hard-blocked. A direct fetch always gets a
 * "Just a moment…" interstitial. So every request here is routed through
 * ScrapingBee, which solves the Cloudflare challenge server-side and returns the
 * final rendered HTML. Our code stays a plain fetch -> cheerio parse — no
 * headless browser lives in this repo (it runs on ScrapingBee's infra), so the
 * project's "no Playwright" rule still holds.
 *
 * Requires env SCRAPPINGBEE_KEY (also a GitHub Actions secret).
 *
 * SHAPE (mirrors qatarsale.ts: slim list -> per-listing detail enrichment)
 *   fetchMzadQatarRecent(maxPages)  -> MzadProduct[]   (id, URL, price, dateMs, …)
 *   fetchMzadQatarProduct(url)      -> MzadProduct|null (full specs/gallery/phone)
 *   normalizeMzadListing(list, det) -> Prisma.ListingCreateInput
 *
 * URL facts (confirmed during research):
 *   Cars, newest first: https://mzadqatar.com/en/cars/sale   (?page=N for paging)
 *   Detail page:        https://mzadqatar.com/en/products/{slug}--{numericId}
 *     The trailing numeric id is the stable per-ad id -> our `sourceAdId`.
 *
 * PARSING STRATEGY — parse embedded JSON, not the DOM (VERIFIED LIVE)
 *   mzad is an Inertia.js app: every page ships its data as an HTML-entity-
 *   escaped JSON blob that's present even without JS rendering. We parse that —
 *   far more stable than the JS-rendered grid markup.
 *     - List page: slice the `products` array on each `{"dateOfAdvertise":` key.
 *       Each block yields id, title, price, description, thumbnail, the real
 *       posting epoch (dateOfAdvertise), and partial specs. DOM-anchor scraping
 *       (parseListPageFromAnchors) remains as a fallback if the JSON disappears.
 *     - Detail page: specs come from the schema.org JSON-LD Vehicle node — the
 *       page's `{"dateOfAdvertise"}` blocks are the related-products carousel,
 *       not this ad. Gallery = upload URLs carrying this ad's id; phone is the
 *       DOM tel:/wa.me link. Specs are keyed by mzad's stable `filterId`, not
 *       the misleading display labels ("Motor type" is the brand, etc.).
 *   All parsing fails soft — a missing field yields null, never a thrown sync.
 */

import type { Prisma } from "@prisma/client";
import * as cheerio from "cheerio";

const SITE_BASE = "https://mzadqatar.com";
const CARS_PATH = "/en/cars/sale";
const SCRAPINGBEE_ENDPOINT = "https://app.scrapingbee.com/api/v1/";

// ---------- ScrapingBee fetch ----------

/**
 * Fetch a mzadqatar.com URL through ScrapingBee (Cloudflare-solving proxy).
 *
 * Tier 1 (cheap, default): `premium_proxy=true` + `country_code=qa` with NO JS
 * rendering — 10 credits. Verified live against the cars list page: this clears
 * Cloudflare and returns the full HTML (Qatar geo confirmed via a Doha cf-ray).
 * Tier 2 (fallback): if the cheap path is challenged or errors, escalate once to
 * the hardened `stealth_proxy=true` pool with `render_js=true` — 75 credits.
 *
 * Geotargeting (`country_code=qa`) requires a premium/stealth proxy, both of
 * which we use here. Requires env SCRAPPINGBEE_KEY (also a GitHub Actions secret).
 */
export async function fetchViaProxy(targetUrl: string): Promise<string> {
  const key = process.env.SCRAPPINGBEE_KEY ?? process.env.SCRAPINGBEE_KEY;
  if (!key) {
    throw new Error(
      "SCRAPPINGBEE_KEY is not set — required to fetch Cloudflare-gated mzadqatar.com"
    );
  }

  const build = (stealth: boolean) => {
    const p = new URLSearchParams({
      api_key: key,
      url: targetUrl,
      country_code: "qa",
    });
    if (stealth) {
      p.set("stealth_proxy", "true");
      p.set("render_js", "true");
    } else {
      p.set("premium_proxy", "true");
      p.set("render_js", "false");
    }
    return `${SCRAPINGBEE_ENDPOINT}?${p.toString()}`;
  };

  // NOTE: do NOT match `cdn-cgi/challenge` / `challenge-platform` here — Cloudflare
  // injects that script tag into successfully-served pages too, so it false-positives.
  // The block interstitial is identified by its title text instead.
  const looksChallenged = (html: string) =>
    /just a moment|attention required|cf-mitigated/i.test(html);

  for (const stealth of [false, true]) {
    const res = await fetch(build(stealth), { cache: "no-store" });
    if (!res.ok) {
      // Non-200 from ScrapingBee means the proxy couldn't fetch/solve — escalate
      // to the stealth pool on the next loop iteration.
      if (!stealth) continue;
      throw new Error(
        `ScrapingBee returned ${res.status} ${res.statusText} for ${targetUrl}`
      );
    }
    const html = await res.text();
    if (!looksChallenged(html)) return html;
    if (stealth) {
      throw new Error(
        `Cloudflare challenge not cleared for ${targetUrl} even with stealth_proxy`
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
  /** Spec pairs keyed by mzad's stable `filterId` (e.g. "subCategoryId"). */
  specs?: Record<string, string>;
  /** `dateOfAdvertise` epoch ms — mzad's real posting time (true recency). */
  dateMs?: number | null;
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

// ---------- Embedded-JSON helpers ----------

/**
 * mzad is an Inertia.js app: every page embeds its product data as an
 * HTML-entity-escaped JSON blob (list pages carry a `products` array of full
 * product objects; detail pages carry one). We parse that JSON instead of the
 * DOM — the visible grid is JS-rendered, but the JSON is present even without
 * rendering and is complete and stable.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Read a string field from a JSON product block. */
function jsonStr(block: string, key: string): string | null {
  const m = block.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? nonEmpty(m[1].replace(/\\\//g, "/")) : null;
}

/** Read a numeric field (quoted or unquoted) from a JSON product block. */
function jsonNum(block: string, key: string): number | null {
  const m = block.match(new RegExp(`"${key}":"?(-?\\d+(?:\\.\\d+)?)"?`));
  return m ? parseIntSafe(m[1]) : null;
}

/**
 * Spec pairs from a product's embedded `properties` array, keyed by the stable
 * machine `filterId` (NOT the display label — mzad's labels mislead: "Motor
 * type" is the brand, "Class" the model, "Model" the trim).
 */
function specsFromBlock(block: string): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const m of block.matchAll(/"filterId":"([^"]+)","filterValue":"([^"]*)"/g)) {
    const fid = m[1];
    const val = m[2].trim();
    if (fid && val && !(fid in specs)) specs[fid] = val;
  }
  return specs;
}

/** Detail-page URL from a product id (list JSON leaves `productUrl` empty; mzad
 *  ignores the slug and routes on the trailing `--{id}`). */
function detailUrlForId(id: number): string {
  return `${SITE_BASE}/en/products/car--${id}`;
}

// ---------- List parsing ----------

/**
 * Parse the `products` array out of the list page's embedded JSON. Each product
 * object is delimited by its leading `{"dateOfAdvertise":` key; we slice between
 * consecutive ones so each block carries exactly that product's fields +
 * `properties`.
 */
function parseListPage(html: string): MzadProduct[] {
  const decoded = decodeEntities(html);
  const starts = [...decoded.matchAll(/\{"dateOfAdvertise":/g)].map((m) => m.index ?? -1);
  const byId = new Map<number, MzadProduct>();

  for (let i = 0; i < starts.length; i++) {
    const block = decoded.slice(starts[i], starts[i + 1] ?? starts[i] + 12000);
    const id = jsonNum(block, "productId");
    if (id == null || byId.has(id)) continue;

    const thumbnail = jsonStr(block, "productMainImage");
    byId.set(id, {
      id,
      url: detailUrlForId(id),
      title: jsonStr(block, "productName"),
      thumbnail,
      priceQAR: jsonNum(block, "productPrice") || null, // 0 == "unspecified"
      description: jsonStr(block, "productDescription"),
      specs: specsFromBlock(block),
      images: thumbnail ? [thumbnail] : [],
      dateMs: jsonNum(block, "dateOfAdvertise"),
    });
  }

  // Fallback to DOM-anchor scraping if the embedded JSON ever disappears.
  if (byId.size === 0) return parseListPageFromAnchors(html);
  return Array.from(byId.values());
}

/** Legacy fallback: harvest `/products/...--{id}` anchors from the DOM. */
function parseListPageFromAnchors(html: string): MzadProduct[] {
  const $ = cheerio.load(html);
  const byId = new Map<number, MzadProduct>();
  $('a[href*="/products/"]').each((_, el) => {
    const href = absoluteUrl($(el).attr("href"));
    if (!href) return;
    const id = parseMzadId(href);
    if (id == null || byId.has(id)) return;
    const img = $(el).closest("li, article, div").find("img").first();
    byId.set(id, {
      id,
      url: href,
      title: nonEmpty($(el).attr("title")) ?? nonEmpty(img.attr("alt")),
      thumbnail: absoluteUrl(img.attr("data-src") || img.attr("src") || undefined),
      priceQAR: null,
    });
  });
  return Array.from(byId.values());
}

export async function fetchMzadQatarRecent(maxPages = 2): Promise<MzadProduct[]> {
  const all: MzadProduct[] = [];
  const seen = new Set<number>();

  for (let page = 1; page <= maxPages; page++) {
    const url = `${SITE_BASE}${CARS_PATH}${page > 1 ? `?page=${page}` : ""}`;
    const html = await fetchViaProxy(url);
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
 * Read the main product's specs from the page's schema.org JSON-LD. On a detail
 * page the `{"dateOfAdvertise"}` blocks are the *related-products* carousel
 * (no specs); the actual ad's structured data lives in a `<script
 * type="application/ld+json">` Vehicle/Product node. Returns a specs map keyed
 * by our FILTER_FIELDS scheme so the normalizer treats it like list specs.
 */
function specsFromJsonLd(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const scripts = [
    ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const sc of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(sc[1]);
    } catch {
      try {
        data = JSON.parse(decodeEntities(sc[1]));
      } catch {
        continue;
      }
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const n of nodes as Record<string, unknown>[]) {
      if (!n || typeof n !== "object") continue;
      const set = (fid: string, v: unknown) => {
        const s = v == null ? "" : String(v).trim();
        if (s && !(fid in specs)) specs[fid] = s;
      };
      const brand = n.brand as { name?: string } | undefined;
      set(FILTER_FIELDS.make, brand?.name);
      set(FILTER_FIELDS.model, n.model);
      set(FILTER_FIELDS.year, n.vehicleModelDate);
      set(FILTER_FIELDS.transmission, n.vehicleTransmission);
      set(FILTER_FIELDS.fuelType, n.fuelType);
      set(FILTER_FIELDS.bodyType, n.bodyType);
      set(FILTER_FIELDS.exteriorColor, n.color);
      const odo = n.mileageFromOdometer as { value?: number } | undefined;
      set(FILTER_FIELDS.mileage, odo?.value);
      const eng = n.vehicleEngine as { engineDisplacement?: { value?: number } } | undefined;
      const cc = eng?.engineDisplacement?.value;
      if (cc != null) set(FILTER_FIELDS.engineSize, `${cc} cc`);
    }
  }
  return specs;
}

function parseDetailPage(url: string, html: string): MzadProduct {
  const decoded = decodeEntities(html);
  const id = parseMzadId(url) ?? jsonNum(decoded, "productId") ?? 0;

  const specs = specsFromJsonLd(html);

  // Full gallery: high-res uploads whose filename carries THIS id (excludes the
  // related-products carousel, UI chrome, and low-quality variants).
  const imgRe = new RegExp(
    `https://content\\.mzadqatar\\.com/uploads/images/[^"\\\\]*?${id}-[^"\\\\]*?\\.(?:jpe?g|png|webp)`,
    "g"
  );
  const images = [...new Set([...decoded.matchAll(imgRe)].map((m) => m[0]))].filter(
    (u) => !u.includes("/low_quality/")
  );

  // Phone still lives in the DOM (a tel:/wa.me link), not the JSON.
  const $ = cheerio.load(html);
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

  return {
    id,
    url,
    images,
    phone,
    specs,
    rawHtmlSnippet: JSON.stringify({ specs, imageCount: images.length }),
  };
}

export async function fetchMzadQatarProduct(url: string): Promise<MzadProduct | null> {
  const html = await fetchViaProxy(url);
  return parseDetailPage(url, html);
}

// ---------- Normalizer ----------

/**
 * Our column -> mzad's stable `filterId` key. Verified against live detail/list
 * JSON. Note mzad's labels are misleading, so we map by filterId, not label:
 *   subCategoryId="Motor type"=brand, subsubCategoryId="Class"=model,
 *   subsubsubCategoryId="Model"=trim.
 */
const FILTER_FIELDS = {
  make: "subCategoryId",
  model: "subsubCategoryId",
  trim: "subsubsubCategoryId",
  year: "manfactureYearId",
  mileage: "km",
  fuelType: "Fueltype",
  transmission: "gear",
  cylinders: "CylinderNumber",
  engineSize: "Engine_capacity",
  bodyType: "CartypeID",
  exteriorColor: "carcolor",
} as const;

function specValue(specs: Record<string, string>, filterId: string): string | null {
  return nonEmpty(specs[filterId]);
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
  listItem: MzadProduct,
  detail?: MzadProduct | null
): Prisma.ListingCreateInput {
  const id = listItem.id;
  // Detail's JSON-LD specs are authoritative for car attributes; the list's
  // partial specs (year/mileage) fill any gaps. Detail wins on overlap.
  const specs = { ...(listItem.specs ?? {}), ...(detail?.specs ?? {}) };

  // Title/price/description come from the list (clean, complete); detail is fallback.
  const title = nonEmpty(listItem.title) ?? nonEmpty(detail?.title);
  const description = nonEmpty(listItem.description) ?? nonEmpty(detail?.description);
  const priceQAR = listItem.priceQAR ?? detail?.priceQAR ?? null;
  const dateMs = listItem.dateMs ?? detail?.dateMs ?? null;

  const fromTitle = parseFromTitle(title);

  const make = specValue(specs, FILTER_FIELDS.make) ?? fromTitle.make;
  const model = specValue(specs, FILTER_FIELDS.model) ?? fromTitle.model;
  const year = parseIntSafe(specValue(specs, FILTER_FIELDS.year)) ?? fromTitle.year;
  const mileageKM = parseIntSafe(specValue(specs, FILTER_FIELDS.mileage));

  // Prefer the detail gallery; fall back to the list thumbnail.
  const images: string[] =
    detail?.images && detail.images.length > 0
      ? detail.images
      : nonEmpty(listItem.thumbnail)
        ? [listItem.thumbnail!]
        : [];

  const phone = normalizePhone(detail?.phone);

  // mzad's `dateOfAdvertise` (epoch ms) is a real posting time — use it for
  // recency. The scraper falls back to a synthesized order only when it's absent.
  const sourceUpdatedAt = dateMs && dateMs > 0 ? new Date(dateMs) : null;

  return {
    source: "mzadqatar",
    sourceAdId: String(id),
    sourceAdIdNum: Number.isFinite(id) ? id : null,
    sourceUrl: detail?.url ?? listItem.url,
    sourceUpdatedAt,

    title,
    description,

    make,
    model,
    trim: specValue(specs, FILTER_FIELDS.trim),
    year,
    priceQAR,
    mileageKM,
    fuelType: specValue(specs, FILTER_FIELDS.fuelType),
    cylinders: specValue(specs, FILTER_FIELDS.cylinders),
    engineSize: specValue(specs, FILTER_FIELDS.engineSize),
    transmission: specValue(specs, FILTER_FIELDS.transmission),
    bodyType: specValue(specs, FILTER_FIELDS.bodyType),
    doors: null,
    seats: null,
    seatType: null,
    wheelDrive: null,
    exteriorColor: specValue(specs, FILTER_FIELDS.exteriorColor),
    interiorColor: null,
    imported: null,
    serviceHistory: null,
    insuranceType: null,
    isBrandNew: false,
    isShowroom: false,
    installmentsAvailable: false,
    dealRating: null,

    features: [] as Prisma.InputJsonValue,

    location: nonEmpty(detail?.location) ?? nonEmpty(listItem.location),
    dealerName: nonEmpty(detail?.dealerName) ?? nonEmpty(listItem.dealerName),
    contactPhone: phone,
    contactWhatsapp: phone, // Mzad doesn't distinguish; same number works for both

    images: images as Prisma.InputJsonValue,

    rawData: { ...listItem, detail: detail ?? null } as unknown as Prisma.InputJsonValue,
  };
}
