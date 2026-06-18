/**
 * Expo push notification registration.
 *
 * On launch the app:
 *   1. (Android) creates a "new-listings" notification channel,
 *   2. asks for notification permission,
 *   3. fetches this device's Expo push token,
 *   4. POSTs it to /api/register-token so the scraper can push "N new cars"
 *      after a sync that added listings.
 *
 * NATIVE-MODULE SAFETY
 *   expo-notifications needs native code (e.g. ExpoPushTokenManager). A dev
 *   build / APK created BEFORE this module was added won't contain it, and any
 *   call would crash with "Cannot find native module". So we feature-detect the
 *   native module up front and no-op if it's missing — the app runs fine and
 *   notifications start working automatically once you rebuild the dev client
 *   (`eas build --profile development -p android`) and reinstall. Push also never
 *   works in Expo Go on SDK 53+.
 *
 * All steps fail soft — no module, no permission, no token, or a network error
 * just means no notifications; the app keeps working.
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import { API_BASE_URL, API_KEY } from "./config";

// Present only when the app was built with the expo-notifications native module.
// `requireOptionalNativeModule` returns null instead of throwing when it's absent.
const pushModuleAvailable = !!requireOptionalNativeModule("ExpoPushTokenManager");

async function postToken(token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/register-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
  if (!res.ok) {
    throw new Error(`register-token returned ${res.status} ${res.statusText}`);
  }
}

/**
 * Register for push and send the token to the server. Safe to call on every
 * launch — the server upserts by token, so re-registering is idempotent. No-ops
 * (without crashing) when the native push module isn't in this build.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  if (!pushModuleAvailable) {
    console.warn(
      "[notifications] Native push module not in this build — skipping. " +
        "Rebuild the dev client to enable notifications."
    );
    return;
  }

  try {
    // Imported lazily so the native bindings are only touched once we know the
    // module exists (avoids load-time crashes on older builds).
    const Notifications = await import("expo-notifications");

    // Show an alert + play a sound when a notification arrives in the foreground.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Android needs a channel before notifications will display.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("new-listings", {
        name: "New listings",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      });
    }

    // Push only works on physical devices, not simulators.
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    // projectId is required to mint an Expo push token in a standalone build.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn("[notifications] No EAS projectId — cannot get push token.");
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await postToken(token);
  } catch (err) {
    console.warn("[notifications] registration failed:", err);
  }
}
