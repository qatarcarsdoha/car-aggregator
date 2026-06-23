# CLAUDE.md — Handoff Notes for Claude Code

This file gives Claude Code context to pick up where the scaffold left off.

## What this project is

A personal mobile-first Next.js app that aggregates recently added car listings
from Qatar Living (and eventually Qatar Sale) into a single feed. The user is
in Qatar and wants this for themselves and one other person — not a public app.

## Status

The scaffold is past the bring-up phase. Both source integrations are wired
up end-to-end, the DB is populating, and the mobile feed renders. Day-to-day
loop is: `npm run sync` to refresh data, `npm run dev` to view it. Cron in
`.github/workflows/scrape.yml` runs the sync every 30 min.

**Working:**

- Qatar Living adapter (`lib/sources/qatarliving.ts`) — list endpoint, recency
  resort, thumbnail URL builder, normalization to `Prisma.ListingCreateInput`.
- Qatar Sale adapter (`lib/sources/qatarsale.ts`) — list + detail endpoints,
  definition-ID mapping, image gallery + phone enrichment.
- Sync orchestrator (`scraper/index.ts`) — per-source upsert by
  `(source, sourceAdId)`, `SyncRun` row tracking each run's status / counts
  / error, and `pruneSource` to cap each source at
  `PRUNE_MAX_PER_SOURCE` (default 500) by deleting oldest `lastSeenAt` rows.
  Prune only runs **after** a successful sync — never on a failed run.
- Mobile feed (`app/page.tsx`) with sort + pagination, detail page
  (`app/listing/[id]/page.tsx`), Tailwind v4 + shadcn/ui plumbing.

## Deploying & schema changes — READ BEFORE SHIPPING

**The sync cron no longer runs `prisma db push`.** It was removed from
`.github/workflows/scrape.yml` because the DB (Neon serverless Postgres)
auto-suspends between hourly runs, and the direct connection `db push` opens
would intermittently fail on Neon's cold start (`P1001: Can't reach database
server`). The cron now only runs `prisma generate` (no DB connection) and
retries `npm run sync` to ride out the cold start.

**Consequence:** schema changes are NOT applied automatically anymore. Any time
you edit `prisma/schema.prisma`, you MUST push it manually to each environment
before the new columns/tables are live:

```bash
DATABASE_URL=<prod-neon-url> npx prisma db push
```

Forgetting this means the app/sync will reference columns that don't exist in
the DB and error. The trigger reliability itself comes from cron-job.org hitting
`/api/sync` hourly (see `app/api/sync/route.ts`), not from GitHub's scheduler.

## What is known about the source APIs

### Qatar Living

Internal/backoffice API at `bo-prod.qatarliving.com/vehicles`. Unauthenticated
today (no server-side gate, only browser-CORS — which doesn't affect
Node/curl), but undocumented and could be locked down anytime. Be polite:
low frequency, reasonable `per_page`.

Recency: the **resolved** answer is to **omit `sort_by`** and use the API's
default order. The first ~78 results are `isPromoted=true` (paid placement,
often recycled old ads, the only ones carrying a `styleGenerated` epoch).
After that block, non-promoted ads come back with no date field and mixed
adId order, so we filter promoted out and resort by `adId` DESC numerically
in `fetchQatarLivingRecent`. Tried and dead: `date_desc`, `newest`, `latest`
all return 0 results; `adId_desc` sorts lexicographically (`99961`, `99953`,
`996…`) which is broken for recency. See the docblock in `qatarliving.ts`
for the full notes.

Other signals: `X-Robots-Tag: noindex, nofollow, noarchive` (soft "don't
index"), `Set-Cookie: adminjs=...` (ignored).

### Qatar Sale

Public-ish JSON API at `production-api.qatarsale.com/api/v2/Products`.
Requires headers `X-Tenant-Id: Qatarsale`, `Origin: https://qatarsale.com`,
`Referer: https://qatarsale.com/`. List endpoint is POST with
`{ categoryUri: "cars_for_sale", currentPage: 0, pageSize: 35 }`
(0-indexed, default order = newest by createdAt). Detail endpoint is
`GET /Products/{idOrUri}` and is required to get the full image gallery,
owner phone, and the ~21 definition fields. The list endpoint only returns
slim records (cover image, ~7 definitions, no contact info), so the sync
walks the list and enriches each ad with a detail call, throttled at 200ms
between calls. Per-listing detail failures are tolerated (slim fallback).

Definition IDs are mapped in `qatarsale.ts` — see the docblock for the full
table (5307 Make, 5308 Class, 5309 Model, 5310 Mileage, 5318 Year, 6212 Fuel,
plus the Yes/No feature flags 5320–6209).

## What to work on next (priority order)

### 1. Filter UI

The home page shows all listings. Most-asked next step is make/model/year/price
filters. Keep it mobile-first: a single bottom-sheet filter modal triggered by
a button, not a dense sidebar. shadcn's `sheet` + `select` + `slider` are the
right primitives — add them with `npx shadcn@latest add sheet select slider`
and restyle to the editorial palette (`bg-bone`, `text-ink`, `text-brand`).

### 2. Use thumbnails in the feed

`buildThumbnailUrl` in `qatarliving.ts` exists but `app/page.tsx` currently
renders the full-size image. Switch the home feed to thumbnails (smaller
mobile payload) and keep originals in the detail view. Confirm a few
constructed URLs actually 200 before flipping everything over.

### 3. Per-source health surface

`SyncRun` rows record status/counts/errors but nothing reads them yet. A
small `/health` or `/admin` page that lists the last N runs per source —
green/red, durations, error message — would make silent breakage visible
without checking logs.

### 4. Re-rank stability on QL

QL's synthesized `sourceUpdatedAt` (`batchStart - position`) is overwritten
on every sync, so "newest" ordering shifts under your feet between syncs.
Acceptable today; revisit if it starts feeling jumpy.

## Design and code conventions

- **One Next.js codebase.** Do not split into a separate backend repo.
- **Server Components by default.** Only use `"use client"` when necessary
  (interactive filters, etc.).
- **Tailwind v4, CSS-based config.** All theme tokens live in
  `app/globals.css` under `@theme` (project palette) and `@theme inline`
  (shadcn vars). There is no `tailwind.config.ts` — do not recreate one.
  PostCSS uses `@tailwindcss/postcss`.
- **Project palette tokens:** `ink`, `bone`, `sand`, `paper`, `brand`,
  `brand-soft`, `olive`, `ink-muted`, `ink-muted-2`. Note the rename: what
  used to be `accent`/`muted` is now `brand`/`ink-muted` because the
  shadcn-owned `accent` and `muted` tokens collide. Use `text-brand` /
  `bg-brand` / `text-ink-muted` etc. in editorial UI.
- **Fonts:** `font-display` (Fraunces), `font-body` (Geist), `font-mono`
  (Geist Mono), wired through CSS variables in `app/layout.tsx`.
- **shadcn/ui is installed** (neutral base color, base-nova style).
  Components live in `components/ui/` and use the shadcn token namespace
  (`bg-background`, `text-foreground`, `bg-primary`, `bg-muted`, `bg-accent`
  …). Add components with `npx shadcn@latest add <name>`. shadcn components
  will look neutral/generic out of the box — restyle them to match the
  editorial palette where they appear in user-facing pages. `lib/utils.ts`
  exports `cn` alongside the project's `formatQAR` / `formatKM` /
  `formatRelative` helpers; keep both.
- **No emojis in UI.** Lucide icons for everything.
- **Mobile-first.** Test at 380px viewport. Tap targets >= 44px. No hover-only
  affordances.
- **Avoid generic AI-slop design** — see the editorial bone-and-ink palette,
  serif display font, mono labels with wide tracking. Keep that vibe even
  when reaching for shadcn primitives.
- **Always preserve `firstSeenAt`** when updating listings. Never overwrite it.
- **Always preserve `rawData`** with the full API payload — it is the debug
  trail when the source changes its schema.

## Code locations cheat sheet

| Want to change                       | File                                              |
| ------------------------------------ | ------------------------------------------------- |
| Database schema (Listing, SyncRun)   | `prisma/schema.prisma`                            |
| How a QL listing is parsed           | `lib/sources/qatarliving.ts` (normalizeQLListing) |
| How a QS listing is parsed           | `lib/sources/qatarsale.ts` (normalizeQSListing)   |
| Sync orchestration + pruning         | `scraper/index.ts`                                |
| Mobile feed                          | `app/page.tsx`                                    |
| Mobile detail                        | `app/listing/[id]/page.tsx`                       |
| Colors / theme tokens                | `app/globals.css` (`@theme` + `@theme inline`)    |
| Fonts                                | `app/layout.tsx`                                  |
| shadcn config                        | `components.json` + `components/ui/`              |
| `cn` + formatters                    | `lib/utils.ts`                                    |
| Cron schedule                        | `.github/workflows/scrape.yml` (every 30 min)     |

## What NOT to do

- Do not add Playwright or any headless browser. The JSON API works.
- Do not add a separate Express/Fastify backend. Next.js is enough.
- Do not introduce authentication unless the user explicitly asks. It is a
  personal app for one or two people.
- Do not optimize prematurely (Redis caching, CDN tricks, etc). The DB has
  maybe 10,000 rows at most.
- Do not recreate `tailwind.config.ts`. The project is on Tailwind v4 — all
  config goes in `app/globals.css` via `@theme`.
- Do not rename the project palette back to `accent` / `muted`. Those names
  belong to shadcn now; the project's editorial tokens are `brand` /
  `ink-muted`.
