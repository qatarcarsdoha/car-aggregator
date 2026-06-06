# Motor Diary — Qatar Car Listings Aggregator

A mobile-first Next.js app that aggregates recently added cars from Qatar Living
(and, soon, Qatar Sale) into a single quiet feed. Built for personal use.

## What is built

| Layer | Status | Notes |
|---|---|---|
| Project scaffold (Next.js 15 + TypeScript + Tailwind) | done | App Router |
| Prisma schema (Postgres) | done | `Listing` + `SyncRun` models |
| Qatar Living source adapter | done | Types, fetcher, normalizer |
| Qatar Sale source adapter | todo | Placeholder, needs API discovery |
| Scraper entrypoint (`npm run sync`) | done | Upserts by `(source, sourceAdId)` |
| GitHub Actions cron (every 30 min) | done | Set `DATABASE_URL` secret |
| Mobile home page (listings feed) | done | Editorial style, image-first |
| Mobile detail page | done | Gallery, specs, WhatsApp/call CTA |
| Search/filter UI | todo | See TODO section |
| Notification system | todo | See TODO section |

## The Data Source

### Qatar Living

Internal/backoffice API. Confirmed working as of build date.

- **Endpoint**: `GET https://bo-prod.qatarliving.com/vehicles`
- **Params**:
  - `cur_page` — page (1-indexed)
  - `per_page` — items per page (20 is the observed default)
  - `sort_by` — `price_asc` confirmed. **TODO**: verify the correct value for
    "recently added" (try `date_desc`, `newest`, `created_desc` — or watch the
    Network tab when changing the sort dropdown on the website to "Latest").
- **Auth**: None required (unauthenticated, verified via terminal `curl`)
- **CDN**: `https://qlv-media-prod.qatarliving.com/ad-images-output/{uri}`
- **Listing deep links**: `https://www.qatarliving.com/en{urlAlias}`

### Qatar Sale

Not yet investigated. See `lib/sources/qatarsale.ts` for the discovery
checklist. Once the endpoint is known, mirror the structure of
`lib/sources/qatarliving.ts`.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Database (Neon — free tier)

1. Create a Neon project at https://neon.tech
2. Copy the connection string
3. Create `.env.local`:

   ```bash
   DATABASE_URL="postgresql://user:password@ep-xxxx.region.neon.tech/dbname?sslmode=require"
   CRON_SECRET="generate-with: openssl rand -base64 32"
   ```

4. Push schema:

   ```bash
   npx prisma db push
   npx prisma generate
   ```

### 3. First sync

```bash
npm run sync:qatarliving
```

You should see something like `[qatarliving] Fetched 60 listings`, then upserts.

### 4. Run the app

```bash
npm run dev
```

Open http://localhost:3000 on your phone (same Wi-Fi) using your computer\'s
local IP, e.g. `http://192.168.1.100:3000`.

## Deployment

### App to Vercel (optional, for hosting the front-end)

1. Push this repo to GitHub
2. Import into Vercel
3. Set `DATABASE_URL` in Vercel project env vars
4. Deploy — the app reads from the same Neon DB that GitHub Actions writes to.

### Scheduled sync — GitHub Actions

The workflow at `.github/workflows/scrape.yml` runs `npm run sync` every 30
minutes against your Neon DB. It works whether or not the front-end is
deployed anywhere — GitHub's runners do the fetching.

One-time setup:

1. Push this repo to GitHub (private is fine)
2. In the repo: **Settings → Secrets and variables → Actions → New repository
   secret**
   - Name: `DATABASE_URL`
   - Value: your Neon connection string (same one in `.env`)
3. Go to the **Actions** tab → "Sync Car Listings" → **Run workflow** to
   verify the first run succeeds
4. From then on it auto-runs every 30 min

## Architecture

```
.
├── app/
│   ├── layout.tsx              Root layout with Fraunces + Geist fonts
│   ├── page.tsx                Home: mobile feed (server component, reads DB)
│   ├── globals.css             Tailwind + custom utilities (grain texture)
│   ├── components/             SortControl, Pagination, sort-options
│   └── listing/[id]/page.tsx   Detail page with gallery & contact CTAs
│
├── lib/
│   ├── db.ts                   Prisma client singleton
│   ├── utils.ts                cn(), formatQAR(), formatKM(), formatRelative(), stripHtml()
│   └── sources/
│       ├── qatarliving.ts      Fetcher + normalizer + TypeScript types
│       └── qatarsale.ts        Fetcher + detail enrichment + normalizer
│
├── scraper/
│   └── index.ts                Standalone Node entry (used by GH Actions)
│
├── prisma/
│   └── schema.prisma           Listing + SyncRun models
│
├── .github/workflows/
│   └── scrape.yml              Every-30-min GitHub Actions cron
│
└── ...config files
```

### Design choices

- **Single repo, single Next.js app.** No monorepo. The "scraper" is just plain
  TS scripts in the same codebase, sharing Prisma + types with the web app.
  They have different runtimes (Vercel vs GitHub Actions) but one codebase.
- **No headless browser.** The API returns clean JSON, so plain `fetch` is
  enough. No Playwright, no Chromium, no cold-start pain.
- **Upsert by `(source, sourceAdId)`.** `firstSeenAt` is preserved across
  updates so the home feed can order by "newest to us" rather than newness on
  the source.
- **`unoptimized={true}` images.** Hotlinking the QL CDN directly avoids
  Vercel image-optimization bandwidth charges. If they ever block hotlinking,
  flip to optimized + add a small proxy route.
- **Editorial mobile UI.** Fraunces (display) + Geist (body) + Geist Mono;
  warm bone-and-ink palette with a single accent red. The cards are
  image-first with restrained typography — closer to a Kinfolk feed than a
  classifieds listing.

## TODO (Roadmap)

### Tier 1 — Get to "actually useful"
- [ ] Verify the correct `sort_by` value for recency (see Qatar Living notes above)
- [ ] Add Qatar Sale source adapter (`lib/sources/qatarsale.ts`)
- [ ] Test thumbnail URL pattern (`buildThumbnailUrl`) and use it in list view
      to save bandwidth on mobile

### Tier 2 — Polish
- [ ] Filter UI: make, model, year range, price range, max mileage
- [ ] Search by free text
- [ ] "Saved" listings (localStorage)
- [ ] Mark stale listings inactive (have not been seen in N syncs)
- [ ] Show "New today" badge based on `firstSeenAt`

### Tier 3 — Nice-to-haves
- [ ] Telegram bot: push new listings matching saved filters
- [ ] WhatsApp deep links with prefilled message
- [ ] Compare view (2-up specs)
- [ ] Price history (track price changes via `rawData` deltas)
- [ ] PWA manifest for "Add to Home Screen"

## Operational Notes

- **Be polite to the source API.** It is an internal endpoint without auth,
  but they could lock it down anytime. The default sync pulls 3 pages (~60
  listings) every 30 min; that is gentle. Do not crank `maxPages` higher than
  needed.
- **The API contract is undocumented and can break.** All API-shape knowledge
  is centralized in `lib/sources/qatarliving.ts` types + `normalizeQLListing`.
  When something breaks, that is the one file to fix. The DB stores `rawData`
  for every listing so you can inspect the actual payload that was received.
- **Personal use only.** This app fetches and displays third-party listings
  with deep links back to the original. Do not make it public, do not run ads
  on it, do not index it for SEO (the `X-Robots-Tag: noindex` on the source
  API is a hint about how they feel).

## Useful commands

```bash
npm run dev                 # Start dev server
npm run sync                # Sync all sources
npm run sync:qatarliving    # Sync just Qatar Living
npm run db:push             # Push Prisma schema to DB
npm run db:studio           # Open Prisma Studio (DB GUI)
npm run build               # Build for production
```

## Quick sanity check

After running `npm run sync:qatarliving` and `npm run db:studio`, you should
see ~60 rows in the `Listing` table with full image URLs, prices, makes, etc.
Then `npm run dev` and your phone should render the feed.
