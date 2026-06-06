/**
 * App configuration, sourced from EXPO_PUBLIC_* env vars (inlined at build time
 * by Expo). Set these in `.env` for local dev and as EAS env/secrets for builds:
 *
 *   EXPO_PUBLIC_API_BASE_URL  — the deployed Next.js API origin (Vercel URL)
 *   EXPO_PUBLIC_API_KEY       — must match MOBILE_API_KEY on the server
 *
 * See .env.example.
 */

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? "";
