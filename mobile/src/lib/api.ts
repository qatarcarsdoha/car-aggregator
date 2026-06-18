/**
 * Typed client for the car-aggregator REST API (app/api/* on the Next.js app).
 * Every request carries the shared-secret `x-api-key` header.
 */

import { API_BASE_URL, API_KEY } from "./config";
import type { SortValue } from "./format";

/** Mirrors the Prisma `Listing` row returned by the API (JSON-serialized). */
export interface Listing {
  id: string;
  source: string;
  sourceAdId: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  title: string | null;
  description: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  year: number | null;
  priceQAR: number | null;
  mileageKM: number | null;
  fuelType: string | null;
  cylinders: string | null;
  engineSize: string | null;
  transmission: string | null;
  bodyType: string | null;
  doors: string | null;
  seats: string | null;
  seatType: string | null;
  wheelDrive: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  imported: string | null;
  serviceHistory: string | null;
  insuranceType: string | null;
  isBrandNew: boolean;
  isShowroom: boolean;
  installmentsAvailable: boolean;
  dealRating: number | null;
  features: string[];
  location: string | null;
  dealerName: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  images: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface ListingsPage {
  items: Listing[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface Meta {
  makes: string[];
  models: string[];
}

export interface ListingsParams {
  page?: number;
  perPage?: number;
  sort?: SortValue;
  make?: string | null;
  model?: string | null;
  q?: string | null;
  minYear?: number | null;
  maxYear?: number | null;
}

async function apiGet<T>(path: string, params?: Record<string, string | number | null | undefined>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY },
  });

  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function getListings(params: ListingsParams = {}): Promise<ListingsPage> {
  return apiGet<ListingsPage>("/api/listings", {
    page: params.page,
    perPage: params.perPage,
    sort: params.sort,
    make: params.make,
    model: params.model,
    q: params.q,
    minYear: params.minYear,
    maxYear: params.maxYear,
  });
}

export function getListing(id: string): Promise<Listing> {
  return apiGet<Listing>(`/api/listings/${encodeURIComponent(id)}`);
}

export function getMeta(make?: string | null): Promise<Meta> {
  return apiGet<Meta>("/api/meta", { make });
}
