/**
 * Qatar Sale vehicles source adapter
 *
 * Endpoints:
 *   POST https://production-api.qatarsale.com/api/v2/Products
 *        — list endpoint (paginated). Returns slim records (cover image only,
 *          ~7 definitions, no contact info).
 *   GET  https://production-api.qatarsale.com/api/v2/Products/{idOrUri}
 *        — detail endpoint. Returns full image gallery, ~21 definitions
 *          (including features, colors, body type, fuel, seats, drive),
 *          and owner contact phone.
 *
 * Required headers:
 *   X-Tenant-Id: Qatarsale
 *   Origin:      https://qatarsale.com
 *   Referer:     https://qatarsale.com/
 *
 * List body (minimum):
 *   { "categoryUri": "cars_for_sale", "currentPage": 0, "pageSize": 35 }
 *   `currentPage` is 0-indexed. Default order = newest first by createdAt.
 *
 * Definition IDs (mapped from the detail response's defsMetaData):
 *   5307 Make · 5308 Class · 5309 Model (trim) · 5310 Mileage(Km)
 *   5311 Color · 5312 Inside Color · 5313 Type (body) · 5315 Gear Type
 *   5316 Wheel Drive · 5317 Seat Type · 5318 Year · 5319 Cylinder
 *   6200 No Of Seats · 6201 Import (often a city like "Doha") · 6212 Fuel Type
 *   Booleans ("Yes"/"No"): 5320 GPS · 5321 CD · 5322 DVD · 5323 Rear Camera
 *     5324 Sensors · 5325 Sun Roof · 5326 With Warranty · 5327 Bluetooth
 *     6198 Panorama · 6199 Front Camera · 6204 First Owner · 6205 Original Paint
 *     6206 Heated Seats · 6207 Cooled Seats · 6208 Keyless Entry · 6209 Massage Seats
 *
 * Notes:
 *   - The site is a SPA. Listing URL pattern is assumed to be
 *     https://qatarsale.com/en/{categoryUri}/{uri}.
 */

import type { Prisma } from "@prisma/client";

const API_URL = "https://production-api.qatarsale.com/api/v2/Products";
const SITE_BASE = "https://qatarsale.com/en";
const USER_AGENT = "CarTracker/1.0 (personal aggregator)";

const HEADERS = {
  "X-Tenant-Id": "Qatarsale",
  Origin: "https://qatarsale.com",
  Referer: "https://qatarsale.com/",
  "Accept-Language": "en",
  "User-Agent": USER_AGENT,
  Accept: "application/json",
};

// ---------- Definition IDs ----------

const D = {
  make: "5307",
  bodyClass: "5308",
  trim: "5309",
  mileage: "5310",
  exteriorColor: "5311",
  interiorColor: "5312",
  bodyType: "5313",
  transmission: "5315",
  wheelDrive: "5316",
  seatType: "5317",
  year: "5318",
  cylinders: "5319",
  seats: "6200",
  location: "6201",
  fuelType: "6212",
} as const;

// Feature ID -> human label. Only IDs whose value is "Yes" become features.
const FEATURE_LABELS: Record<string, string> = {
  "5320": "GPS",
  "5321": "CD Player",
  "5322": "DVD Player",
  "5323": "Rear Camera",
  "5324": "Parking Sensors",
  "5325": "Sun Roof",
  "5326": "Warranty",
  "5327": "Bluetooth",
  "6198": "Panorama",
  "6199": "Front Camera",
  "6204": "First Owner",
  "6205": "Original Paint",
  "6206": "Heated Seats",
  "6207": "Cooled Seats",
  "6208": "Keyless Entry",
  "6209": "Massage Seats",
};

// ---------- Response types ----------

export interface QSListing {
  id: number;
  uri: string;
  categoryUri: string;
  categoryName?: string;
  title?: string;
  startingPrice?: number;
  coverImage?: string;
  imagesCount?: number;
  createdAt?: string;
  startDate?: string;
  viewCount?: number;
  fansCount?: number;
  condition?: number;
  isPromoted?: boolean;
  isPinned?: boolean;
  isBusiness?: boolean;
  isSold?: boolean;
  isExpired?: boolean;
  showroomId?: string;
  showroomUri?: string;
  showroomName?: string;
  location?: { latitude: number; longitude: number };
  definitions?: Record<string, string>;
}

export interface QSPhone {
  phone: string;
  contactBy?: number;
}

export interface QSOwner {
  fullPhone?: string;
  fullName?: string;
  phones?: QSPhone[];
}

export interface QSProduct extends QSListing {
  images?: string[];
  thumbnailImages?: string[];
  originalImages?: string[];
  owner?: QSOwner;
  timeAgo?: string;
  enUrl?: string;
  enSeo?: string;
}

interface QSListResponse {
  list: QSListing[];
  pagesCount: number;
  totalCount: number;
  currentPage: number;
}

interface QSDetailResponse {
  product: QSProduct;
  userProductsCount?: number;
  defsMetaData?: unknown[];
}

// ---------- Fetchers ----------

export interface FetchOptions {
  page?: number; // 0-indexed
  pageSize?: number;
}

export async function fetchQatarSalePage(
  opts: FetchOptions = {}
): Promise<QSListResponse> {
  const { page = 0, pageSize = 35 } = opts;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryUri: "cars_for_sale",
      currentPage: page,
      pageSize,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Qatar Sale list returned ${res.status} ${res.statusText} for page ${page}`
    );
  }
  return (await res.json()) as QSListResponse;
}

export async function fetchQatarSaleProduct(
  idOrUri: string | number
): Promise<QSProduct> {
  const url = `${API_URL}/${encodeURIComponent(String(idOrUri))}`;
  const res = await fetch(url, { method: "GET", headers: HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Qatar Sale detail returned ${res.status} ${res.statusText} for ${idOrUri}`
    );
  }
  const body = (await res.json()) as QSDetailResponse;
  return body.product;
}

export async function fetchQatarSaleRecent(maxPages = 2): Promise<QSListing[]> {
  const all: QSListing[] = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchQatarSalePage({ page });
    all.push(...data.list);
    if (page + 1 >= data.pagesCount) break;
    await new Promise((r) => setTimeout(r, 800));
  }
  return all;
}

// ---------- Normalizer ----------

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
  return cleaned || null;
}

function featuresFromDefs(defs: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [id, label] of Object.entries(FEATURE_LABELS)) {
    if (defs[id]?.toLowerCase() === "yes") out.push(label);
  }
  return out;
}

export function buildListingUrl(uri: string, categoryUri: string): string {
  return `${SITE_BASE}/${categoryUri}/${uri}`;
}

/**
 * Normalize a listing into our Prisma row.
 *
 * Pass `detail` when available (rich payload from /Products/{id}). The slim
 * `listItem` is used as a fallback and for fields that only the list endpoint
 * provides (notably showroomName).
 */
export function normalizeQSListing(
  listItem: QSListing,
  detail?: QSProduct | null
): Prisma.ListingCreateInput {
  const product: QSProduct = { ...listItem, ...(detail ?? {}) };
  const defs = product.definitions ?? {};

  const make = nonEmpty(defs[D.make]);
  const bodyClass = nonEmpty(defs[D.bodyClass]); // e.g. "Sierra"
  const trim = nonEmpty(defs[D.trim]); // e.g. "AT4"
  const year = parseIntSafe(defs[D.year]);
  const mileage = parseIntSafe(defs[D.mileage]);
  const cylinders = nonEmpty(defs[D.cylinders]);
  const transmission = nonEmpty(defs[D.transmission]);
  const wheelDrive = nonEmpty(defs[D.wheelDrive]);
  const seatType = nonEmpty(defs[D.seatType]);
  const exteriorColor = nonEmpty(defs[D.exteriorColor]);
  const interiorColor = nonEmpty(defs[D.interiorColor]);
  const bodyType = nonEmpty(defs[D.bodyType]);
  const fuelType = nonEmpty(defs[D.fuelType]);
  const seats = nonEmpty(defs[D.seats]);
  const location = nonEmpty(defs[D.location]);

  const features = featuresFromDefs(defs);

  // Image priority: detail.images (full gallery) > listItem.coverImage (slim).
  const images: string[] =
    (Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : nonEmpty(product.coverImage)
        ? [product.coverImage!]
        : []) ?? [];

  // Contact: detail.owner.fullPhone (digits) or first owner.phones[].phone.
  const ownerPhone =
    normalizePhone(product.owner?.fullPhone) ??
    normalizePhone(product.owner?.phones?.[0]?.phone) ??
    null;

  // Dealer/seller name: showroomName (business) > owner.fullName (private).
  const dealerName =
    nonEmpty(product.showroomName) ??
    nonEmpty(product.owner?.fullName) ??
    (product.isBusiness ? "Showroom" : null);

  return {
    source: "qatarsale",
    sourceAdId: String(product.id),
    sourceAdIdNum: Number.isFinite(product.id) ? product.id : null,
    sourceUrl: buildListingUrl(product.uri, product.categoryUri ?? "cars_for_sale"),
    sourceUpdatedAt: product.createdAt ? new Date(product.createdAt) : null,

    title: nonEmpty(product.title),
    description: null, // QS doesn't expose a free-text description

    make,
    model: bodyClass,
    trim,
    year,
    priceQAR: product.startingPrice ?? null,
    mileageKM: mileage,
    fuelType,
    cylinders,
    engineSize: null,
    transmission,
    bodyType,
    doors: null,
    seats,
    seatType,
    wheelDrive,
    exteriorColor,
    interiorColor,
    imported: null,
    serviceHistory: null,
    insuranceType: null,
    isBrandNew: product.condition === 0, // 0 = new, 1 = used
    isShowroom: !!product.showroomId || !!product.isBusiness,
    installmentsAvailable: false,
    dealRating: null,

    features: features as Prisma.InputJsonValue,

    location,
    dealerName,
    contactPhone: ownerPhone,
    contactWhatsapp: ownerPhone, // QS doesn't distinguish; same number works for both

    images: images as Prisma.InputJsonValue,

    rawData: product as unknown as Prisma.InputJsonValue,
  };
}
