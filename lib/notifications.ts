import { Platform } from 'react-native';
import Constants from 'expo-constants';

// expo-notifications remote push is removed from Expo Go in SDK 53+.
// We skip all notification setup when running inside Expo Go so there are
// no warnings during development. Everything works normally in the real APK.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// Lazy import — only load expo-notifications when NOT in Expo Go.
// A top-level import triggers the SDK 53 Expo Go warning even if the code is never called.
function getNotifications() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof import('expo-notifications');
}

// ─── Configure how notifications appear when app is in foreground ────────────
if (!IS_EXPO_GO) {
  getNotifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Request permission (call once at app startup) ───────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  // Skip in Expo Go — push notifications are not supported there in SDK 53+
  if (IS_EXPO_GO) return false;

  const N = getNotifications();
  const { status: existingStatus } = await N.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await N.requestPermissionsAsync();
  if (status !== 'granted') return false;

  // Android 8+ requires a notification channel
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('offline-pay', {
      name: 'Offline Pay Alerts',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16a34a',
      sound: 'default',
    });
  }
  return true;
}

// ─── Send a local notification ───────────────────────────────────────────────
export async function sendNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  // Expo Go does not support notifications in SDK 53+ — skip silently
  if (IS_EXPO_GO) return;
  try {
    await getNotifications().scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'offline-pay' }),
      },
      trigger: null, // fire immediately
    });
  } catch {
    // Silently ignore if permissions not granted
  }
}

// ─── Pre-built notification helpers ──────────────────────────────────────────

/** User: payment confirmed by merchant after sync */
export async function notifyPaymentConfirmed(amount: number, merchantName?: string): Promise<void> {
  const merchant = merchantName ? ` to ${merchantName}` : '';
  await sendNotification(
    '✅ Payment Confirmed',
    `Your ₹${amount} payment${merchant} has been confirmed by the merchant.`
  );
}

/** User: voucher backed up to server (pending merchant scan) */
export async function notifyVoucherSynced(amount: number): Promise<void> {
  await sendNotification(
    '💾 Payment Backed Up',
    `₹${amount} voucher is backed up. Show the QR to the merchant to complete payment.`
  );
}

/** Merchant: new payment received offline */
export async function notifyMerchantReceivedPayment(amount: number, payerName?: string): Promise<void> {
  const payer = payerName ? ` from ${payerName}` : '';
  await sendNotification(
    '💰 Payment Received',
    `You received ₹${amount}${payer}. Sync when online to confirm.`
  );
}

/** Merchant: sync completed successfully */
export async function notifyMerchantSyncDone(count: number): Promise<void> {
  await sendNotification(
    '✅ Sync Complete',
    `${count} payment${count > 1 ? 's' : ''} successfully synced to the server.`
  );
}
