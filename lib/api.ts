import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ Production backend URL — do NOT use localhost or 192.168.x.x here
export const API_BASE_URL = "https://offline-pay-backend-sau2.onrender.com";
export const BASE_URL = API_BASE_URL;

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  WALLET_BALANCE: "@walletBalance",         // cached numeric balance
  OFFLINE_TRANSACTIONS: "@offlineTransactions", // user's outgoing payment queue
  USED_VOUCHER_IDS: "@usedVoucherIds",      // merchant double-spend guard
};

// ─── Network check ────────────────────────────────────────────────────────────
/**
 * Returns true when the device can reach the backend.
 * Uses a 3-second timeout so the UI never hangs waiting for a response.
 */
export async function checkOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${API_BASE_URL}/api/health`, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return resp.ok;
  } catch {
    return false;
  }
}

// ─── Local balance cache ──────────────────────────────────────────────────────
/** Persist the latest known wallet balance so it is readable when offline. */
export async function saveLocalBalance(balance: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.WALLET_BALANCE, String(balance));
}

/** Read the last cached wallet balance. Returns null if never saved. */
export async function getLocalBalance(): Promise<number | null> {
  const val = await AsyncStorage.getItem(STORAGE_KEYS.WALLET_BALANCE);
  return val !== null ? Number(val) : null;
}

/** Deduct an amount from the locally cached balance. Safe to call offline. */
export async function deductLocalBalance(amount: number): Promise<number> {
  const current = (await getLocalBalance()) ?? 0;
  const next = Math.max(0, current - amount);
  await saveLocalBalance(next);
  return next;
}

// ─── Offline transaction queue ────────────────────────────────────────────────
export type OfflineTransaction = {
  voucherId: string;
  userId: string;
  merchantId: string;
  amount: number;
  timestamp: string;
  signature: string;
  publicKeyHex: string;
  status: "pending" | "synced";
};

/** Add a new payment to the offline queue (idempotent — ignores duplicates). */
export async function queueOfflineTransaction(txn: OfflineTransaction): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS);
  const list: OfflineTransaction[] = raw ? JSON.parse(raw) : [];
  // Prevent duplicates
  if (!list.find((t) => t.voucherId === txn.voucherId)) {
    list.push(txn);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS, JSON.stringify(list));
  }
}

/** Read all queued offline transactions. */
export async function getOfflineTransactions(): Promise<OfflineTransaction[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Sync all "pending" offline transactions to the backend.
 * Each voucher is sent individually; successfully synced ones are marked "synced".
 * The backend should verify the ECDSA signature before crediting the merchant.
 *
 * @returns number of newly synced transactions
 */
export async function syncOfflineTransactions(token: string): Promise<number> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS);
  if (!raw) return 0;

  const list: OfflineTransaction[] = JSON.parse(raw);
  const pending = list.filter((t) => t.status === "pending");
  if (pending.length === 0) return 0;

  let syncedCount = 0;
  for (const txn of pending) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/vouchers/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(txn),
      });
      if (response.ok) {
        txn.status = "synced";
        syncedCount++;
      }
    } catch {
      // Network still unavailable — keep as pending, retry next time
    }
  }

  if (syncedCount > 0) {
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS, JSON.stringify(list));
  }
  return syncedCount;
}
