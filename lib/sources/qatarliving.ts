/**
 * Qatar Living vehicles source adapter
 *
 * API endpoint:
 *   GET https://bo-prod.qatarliving.com/vehicles
 *
 * Query params:
 *   cur_page  — page number (1-indexed)
 *   per_page  — listings per page (server caps at 50)
 *   sort_by   — OPTIONAL. The QL website itself omits this param to get "latest".
 *               Confirmed working values: "price_asc", "price_desc", "adId_desc"
 *               (but adId_desc sorts as strings: 99961, 99953, 996... — broken for recency).
 *               "date_desc"/"newest"/"latest" all return 0 results.
 *               We omit sort_by so the API uses its default order.
 *
 * Default-order pattern (no sort_by):
 *   - First ~78 results are isPromoted=true (paid placement, often recycled old ads).
 *     `styleGenerated` (epoch ms) only appears on these promoted ads.
 *   - After the promoted block, non-promoted ads are returned with no date field
 *     and adIds in mixed order, so we filter promoted out and resort by adId DESC
 *     numerically in fetchQatarLivingRecent.
 *
 * Notes:
 *   - This is an internal/backoffice API ("bo-prod"). It's unauthenticated but undocumented
 *     and could be locked down anytime. Be polite: low frequency, reasonable per_page.
 *   - Response includes pagination meta: { perPage, totalPages, totalResults, curPage }
 *   - Image URIs in the response are relative paths; CDN base is prepended in normalize().
 */

import type { Prisma } from "@prisma/client";
import { stripHtml } from "../utils";

const API_BASE = "https://bo-prod.qatarliving.com/vehicles";
const CDN_BASE = "https://qlv-media-prod.qatarliving.com/ad-images-output";
const LISTING_BASE = "https://www.qatarliving.com/en";

const USER_AGENT = "CarTracker/1.0 (personal aggregator)";

// ---------- API response types (matching the actual JSON shape) ----------

interface QLImage {
  image: { uri: string };
  viewpoint: string | null;
}

interface QLNamed { [key: string]: string }

export interface QLListing {
  adId: number;
  title?: string;
  description?: string;
  locale?: string;
  price?: string;
  milage?: string; // Note: their API spells it "milage"
  engineSize?: string;
  status?: number;
  isBrandNew?: boolean;
  isPromoted?: boolean;
  installmentsAvailable?: boolean;
  isShowroom?: boolean;
  isBasic?: boolean;
  dealRating?: number;
  styleGenerated?: number; // epoch ms — appears to be last republish/refresh time

  vehicleMake?: { makeName: string };
  vehicleModel?: { modelName: string };
  vehicleTrim?: { trimName: string };
  year?: { yearName: string };
  door?: { doorName: string };
  cylinder?: { cylinderName: string };
  seat?: { seatName: string };
  seatType?: { seatTypeName: string };
  fuelType?: { fuelTypeName: string };
  serviceHistory?: { serviceHistoryName: string };
  insideColor?: { insideColorName: string };
  wheelDrive?: { wheelDriveName: string };
  imported?: { importedName: string };
  insuranceType?: { insuranceName: string };
  location?: { locationName: string };

  user?: { username: string };
  contactMobile_1?: string;
  contactMobile_2?: string;
  contactMobile_3?: string;
  contactWhatsapp_1?: string;
  contactWhatsapp_2?: string;
  contactWhatsapp_3?: string;

  carFeatures?: Array<{
    carFeature: { carFeatureName: string; featureGroup: string };
  }>;

  images?: QLImage[];
  urls?: Array<{ urlAlias: string }>;
}

export interface QLResponse {
  meta: {
    perPage: number;
    totalPages: number;
    totalResults: number;
    curPage: number;
  };
  adsCar: QLListing[];
}

// ---------- Fetcher ----------

export interface FetchOptions {
  page?: number;
  perPage?: number;
  sortBy?: string;
}

export async function fetchQatarLivingPage(opts: FetchOptions = {}): Promise<QLResponse> {
  const { page = 1, perPage = 50, sortBy } = opts;

  const url = new URL(API_BASE);
  url.searchParams.set("cur_page", String(page));
  url.searchParams.set("per_page", String(perPage));
  if (sortBy) url.searchParams.set("sort_by", sortBy);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    // Don't cache in scraper context — we always want fresh data
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Qatar Living API returned ${res.status} ${res.statusText} for page ${page}`
    );
  }

  const data = (await res.json()) as QLResponse;
  return data;
}

/**
 * Fetch recent (genuinely new) listings.
 *
 * The QL default order is: ~78 promoted ads (recycled/old, regardless of adId)
 * followed by non-promoted listings in mixed adId order. We drop the promoted
 * block entirely and resort the rest by adId DESC numerically as a recency
 * proxy — there's no real timestamp on fresh listings.
 *
 * 4 pages × per_page=50 = 200 listings fetched, ~120 fresh after filtering.
 */
export async function fetchQatarLivingRecent(maxPages = 4): Promise<QLListing[]> {
  const all: QLListing[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchQatarLivingPage({ page });
    all.push(...data.adsCar);

    if (page >= data.meta.totalPages) break;

    // Politeness delay between pages
    await new Promise((r) => setTimeout(r, 800));
  }

  // Drop promoted ads — they're paid placements, often recycled from years ago.
  const fresh = all.filter((ad) => !ad.isPromoted);

  // Higher adId ≈ newer. The API returns these in mixed order, so resort here.
  fresh.sort((a, b) => b.adId - a.adId);

  return fresh;
}

// ---------- Normalizer: QLListing -> Prisma create input ----------

// Encode each path segment so spaces / parens in filenames don't break the URL.
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function stripExt(file: string): string {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? file : file.slice(0, dot);
}

export function buildImageUrl(uri: string): string {
  // The CDN serves a .webp version of every uploaded image at the same path —
  // the original extension (.jpg / .jpeg / .png) returns 404, only .webp 200s.
  // Example uri:
  //   prod/lexus-570-2013-1743253994826/1743253994826-WhatsApp Image 2025-03-26 at 11.10.48 PM (1).jpeg
  const lastSlash = uri.lastIndexOf("/");
  if (lastSlash === -1) return `${CDN_BASE}/${encodeURIComponent(stripExt(uri))}.webp`;

  const dir = uri.slice(0, lastSlash);
  const file = uri.slice(lastSlash + 1);
  return `${CDN_BASE}/${encodePath(dir)}/${encodeURIComponent(stripExt(file))}.webp`;
}

export function buildThumbnailUrl(uri: string): string {
  // Thumbnail variant lives at {CDN_BASE}/{dir}/thumbnail/{basename}_432x300.webp
  // Confirmed working against the live CDN.
  const lastSlash = uri.lastIndexOf("/");
  if (lastSlash === -1) return buildImageUrl(uri);

  const dir = uri.slice(0, lastSlash);
  const file = uri.slice(lastSlash + 1);
  return `${CDN_BASE}/${encodePath(dir)}/thumbnail/${encodeURIComponent(stripExt(file))}_432x300.webp`;
}

export function buildListingUrl(urlAlias: string): string {
  // urlAlias starts with /, e.g. "/vehicles/cars/156373_mercedes_gtr_2018"
  return `${LISTING_BASE}${urlAlias}`;
}

function parseIntSafe(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseInt(s.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizeQLListing(ad: QLListing): Prisma.ListingCreateInput {
  const images = (ad.images ?? []).map((img) => buildImageUrl(img.image.uri));
  const urlAlias = ad.urls?.[0]?.urlAlias ?? `/vehicles/cars/${ad.adId}`;
  const features =
    ad.carFeatures
      ?.map((f) => f.carFeature?.carFeatureName)
      .filter((n): n is string => !!n) ?? [];

  return {
    source: "qatarliving",
    sourceAdId: String(ad.adId),
    sourceAdIdNum: Number.isFinite(ad.adId) ? ad.adId : null,
    sourceUrl: buildListingUrl(urlAlias),
    sourceUpdatedAt: ad.styleGenerated ? new Date(ad.styleGenerated) : null,

    title: ad.title?.trim() || null,
    description: stripHtml(ad.description) || null,

    make: ad.vehicleMake?.makeName ?? null,
    model: ad.vehicleModel?.modelName ?? null,
    trim: ad.vehicleTrim?.trimName ?? null,
    year: parseIntSafe(ad.year?.yearName),
    priceQAR: parseIntSafe(ad.price),
    mileageKM: parseIntSafe(ad.milage),
    fuelType: ad.fuelType?.fuelTypeName ?? null,
    cylinders: ad.cylinder?.cylinderName ?? null,
    engineSize: ad.engineSize ?? null,
    doors: ad.door?.doorName ?? null,
    seats: ad.seat?.seatName ?? null,
    seatType: ad.seatType?.seatTypeName ?? null,
    wheelDrive: ad.wheelDrive?.wheelDriveName ?? null,
    interiorColor: ad.insideColor?.insideColorName ?? null,
    imported: ad.imported?.importedName ?? null,
    serviceHistory: ad.serviceHistory?.serviceHistoryName ?? null,
    insuranceType: ad.insuranceType?.insuranceName ?? null,
    isBrandNew: ad.isBrandNew ?? false,
    isShowroom: ad.isShowroom ?? false,
    installmentsAvailable: ad.installmentsAvailable ?? false,
    dealRating: typeof ad.dealRating === "number" ? ad.dealRating : null,

    features: features as Prisma.InputJsonValue,

    location: ad.location?.locationName ?? null,
    dealerName: ad.user?.username ?? null,
    contactPhone: ad.contactMobile_1 ?? null,
    contactWhatsapp: ad.contactWhatsapp_1 ?? null,

    images: images as Prisma.InputJsonValue,

    rawData: ad as unknown as Prisma.InputJsonValue,
  };
}
