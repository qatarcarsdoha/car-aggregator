# Push notifications

A "N new cars" summary push fires after any sync that adds listings. It's a
personal app, so there are no user accounts — every device that has opened the
app and granted permission gets every notification.

## How it works

```
scraper (GitHub Actions, every ~15 min)
  └─ each source returns its new-listing count
  └─ main() aggregates → notifyNewListings()           lib/notify.ts
        └─ reads all tokens from DeviceToken table
        └─ POST https://exp.host/--/api/v2/push/send   (one summary per device)
        └─ deletes tokens Expo reports as DeviceNotRegistered

mobile app (on launch)                                  mobile/src/lib/notifications.ts
  └─ asks permission → gets Expo push token
  └─ POST /api/register-token  (x-api-key)              app/api/register-token/route.ts
        └─ upsert into DeviceToken                      prisma/schema.prisma
```

- **Only fires when there are new listings.** Zero-new syncs send nothing, so the
  15-minute cadence doesn't spam. Body looks like `Qatar Living 8 · Mzad Qatar 4`.
- **Never breaks a sync.** `notifyNewListings` swallows all errors — a push
  failure is logged and the sync still succeeds.
- **Self-healing token list.** Dead tokens (app uninstalled) are pruned on the
  next send.

## One-time setup you must do

### 1. FCM credentials (required for the Android APK)

Android delivers push through Firebase Cloud Messaging — this is true even for a
sideloaded APK that never touches the Play Store. Without it, tokens mint fine
but **no notification is delivered**.

1. Create a free Firebase project at <https://console.firebase.google.com>.
2. Add an Android app with package name **`com.qatarcars.app`** (matches
   `mobile/app.json`). Download the generated `google-services.json`.
3. In Firebase → Project Settings → Service accounts → generate a new private
   key (this is the **FCM V1** service-account JSON).
4. Upload it to EAS so standalone builds can send via FCM:
   ```
   cd mobile
   eas credentials            # Android → Push Notifications (FCM V1) → upload the JSON
   ```
   (Place `google-services.json` in `mobile/` and reference it in `app.json`
   under `android.googleServicesFile` if EAS asks for it.)

### 2. Server env

- `MOBILE_API_KEY` — already set; `/api/register-token` is gated by it.
- `EXPO_ACCESS_TOKEN` — **optional.** Only needed if you turn on "enhanced
  security for push" in your Expo account. Leave unset otherwise. If you set it,
  add it as a GitHub Actions secret too (the workflow already forwards it).
- The `DeviceToken` table is created automatically — the sync workflow runs
  `npx prisma db push` before every run.

### 3. Build the APK

```
cd mobile
eas build -p android --profile preview   # or your APK profile
```

Push tokens are **not** minted in Expo Go on SDK 53+ — you must test on a real
build (dev build or the APK) installed on a physical device.

## Verifying

- **Endpoint:** `POST /api/register-token` with header `x-api-key: <key>` and
  body `{"token":"ExponentPushToken[...]","platform":"android"}` → `{"ok":true}`.
- **Sender:** after a real device registers, a sync that adds listings logs
  `[notify] Sent "N new cars" (...) to M device(s).`
- **Manual test push:** <https://expo.dev/notifications> — paste a device's token
  and send, to confirm FCM delivery independent of the sync.

## Note on the two local databases

`.env` (used by the scraper / CLI) and `.env.local` (used by `next dev`) point at
**different** Neon databases in this checkout. When testing locally, push the
schema to whichever one the tool under test uses. In production there's a single
`DATABASE_URL`, so this split doesn't exist there.
