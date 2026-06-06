# Qatar Cars — mobile app

Expo (React Native) Android app for the car-aggregator. It is a thin client over
the Next.js REST API (`/api/*` on the deployed Vercel app) — it does **not** talk
to the database directly. Lives in `/mobile` inside the aggregator monorepo.

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # then edit it
```

Set in `.env`:

- `EXPO_PUBLIC_API_BASE_URL` — the deployed API origin (your Vercel URL). For
  local dev against `npm run dev` in the repo root, use your machine's LAN IP
  (e.g. `http://192.168.1.50:3000`), **not** `localhost` (that resolves to the
  phone itself).
- `EXPO_PUBLIC_API_KEY` — must equal `MOBILE_API_KEY` in the Next.js app's env.

## Run in development

```bash
npm start            # then press 'a' for Android, or scan the QR in Expo Go
```

## Build an APK (sideload)

Uses EAS. One-time:

```bash
npm i -g eas-cli
eas login
```

Then build and download the APK:

```bash
eas build -p android --profile preview
```

`eas.json` defines the `preview` profile as an internal-distribution APK. After
the build finishes, download the `.apk` from the EAS dashboard (or the printed
URL) and sideload it on the two phones.

Set the two `EXPO_PUBLIC_*` values as EAS env vars / secrets so cloud builds pick
them up:

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://your-app.vercel.app
eas env:create --name EXPO_PUBLIC_API_KEY --value <same as MOBILE_API_KEY>
```

JS-only changes can later ship over the air with `eas update` (no rebuild).

## Structure

- `src/app/_layout.tsx` — React Query provider + Stack navigator.
- `src/app/index.tsx` — feed: infinite scroll, search, sort + make/model chips.
- `src/app/listing/[id].tsx` — detail: image gallery, specs, Call/WhatsApp.
- `src/lib/api.ts` — typed API client (sends `x-api-key`).
- `src/lib/config.ts` — reads the `EXPO_PUBLIC_*` env vars.
- `src/lib/format.ts` — QAR/KM formatters + sort options (mirrors the web app).
