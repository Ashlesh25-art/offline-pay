import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL, saveLocalBalance, getLocalBalance, syncOfflineTransactions } from "../../lib/api";
import { ensureUserKeypairAndId } from "../../lib/cryptoKeys";
import { registerPublicKeyIfNeeded } from "../../lib/registerKey";

const MAX_ADD_AMOUNT = 1000;

type Transaction = {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  timestamp: string;
  status?: string;
};

export default function UserWalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [userName, setUserName] = useState("User");
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureUserKeypairAndId();
      await registerPublicKeyIfNeeded();
      const userData = await AsyncStorage.getItem("@user_data");
      if (userData) {
        const u = JSON.parse(userData);
        setUserName(u.name || "User");
      }
    })();
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      setLoadingBalance(true);
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) { setBalance(0); setLoadingBalance(false); return; }

      const response = await fetch(`${API_BASE_URL}/api/balance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
        setIsOffline(false);
        // Cache the latest balance locally for offline use
        await saveLocalBalance(data.balance);
        // Opportunistically sync any queued offline transactions
        await syncOfflineTransactions(token).catch(() => {});
      } else {
        // Backend returned error — fall back to cached balance
        const cached = await getLocalBalance();
        setBalance(cached ?? 0);
        setIsOffline(cached !== null);
      }
    } catch {
      // No network — show last known balance from local cache
      const cached = await getLocalBalance();
      setBalance(cached ?? 0);
      setIsOffline(true);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  const loadRecentTxns = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/api/transactions/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentTxns((data.transactions || []).slice(0, 4));
      }
    } catch {
      // silent
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadBalance(), loadRecentTxns()]);
    setRefreshing(false);
  }, [loadBalance, loadRecentTxns]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const handleAddBalance = async () => {
    const amt = Number(addAmount);
    if (isNaN(amt) || amt <= 0) { setError("Please enter a valid amount"); return; }
    if (amt > MAX_ADD_AMOUNT) { setError(`Maximum amount is ₹${MAX_ADD_AMOUNT}`); return; }
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) { Alert.alert("Error", "Please login first"); return; }
      const response = await fetch(`${API_BASE_URL}/api/balance/add`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await response.json();
      if (response.ok) {
        setBalance(data.balance);
        setIsOffline(false);
        // Update local cache with new balance
        await saveLocalBalance(data.balance);
        setAddAmount("");
        setError(null);
        setShowAddModal(false);
        await loadRecentTxns();
        Alert.alert("Success ✅", `₹${amt} added!\nNew balance: ₹${data.balance}`, [{ text: "OK" }]);
      } else {
        setError(data.error || "Failed to add balance");
      }
    } catch {
      setError("No internet connection. Please try again when online.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstLetter = userName.charAt(0).toUpperCase();

  return (
    <LinearGradient colors={["#4f46e5", "#7c3aed", "#a855f7"]} style={styles.root}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(); }}
            tintColor="#fff"
          />
        }
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{userName} 👋</Text>
          </View>
          <Pressable style={styles.avatarBtn} onPress={() => router.push("/user/profile")}>
            <LinearGradient colors={["#fff", "#e0e7ff"]} style={styles.avatarGrad}>
              <Text style={styles.avatarText}>{firstLetter}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── BALANCE CARD ── */}
        <View style={styles.balanceCard}>
          <LinearGradient colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.08)"]} style={styles.balanceCardInner}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            {loadingBalance ? (
              <ActivityIndicator color="#fff" size="large" style={{ marginVertical: 12 }} />
            ) : (
              <Text style={styles.balanceAmount}>₹{balance ?? 0}</Text>
            )}
            <View style={styles.balanceRow}>
              <View style={[styles.balancePill, isOffline && styles.balancePillOffline]}>
                <Text style={styles.balancePillText}>
                  {isOffline ? "📵 Offline Cache" : "🔒 Offline Wallet"}
                </Text>
              </View>
              <Pressable
                style={styles.addBtn}
                onPress={() => { setAddAmount(""); setError(null); setShowAddModal(true); }}
              >
                <Text style={styles.addBtnText}>+ Add Money</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        {/* ── QUICK ACTIONS ── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => router.push("/user/pay")}
          >
            <LinearGradient colors={["#6366f1", "#8b5cf6"]} style={styles.actionGrad}>
              <Text style={styles.actionIcon}>💳</Text>
              <Text style={styles.actionLabel}>Pay</Text>
              <Text style={styles.actionSub}>Scan & Pay Merchant</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => router.push("/user/history")}
          >
            <LinearGradient colors={["#0ea5e9", "#0284c7"]} style={styles.actionGrad}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>History</Text>
              <Text style={styles.actionSub}>All Transactions</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => { setAddAmount(""); setError(null); setShowAddModal(true); }}
          >
            <LinearGradient colors={["#10b981", "#059669"]} style={styles.actionGrad}>
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={styles.actionLabel}>Add Money</Text>
              <Text style={styles.actionSub}>Top Up Wallet</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            onPress={() => router.push("/user/profile")}
          >
            <LinearGradient colors={["#f59e0b", "#d97706"]} style={styles.actionGrad}>
              <Text style={styles.actionIcon}>👤</Text>
              <Text style={styles.actionLabel}>Profile</Text>
              <Text style={styles.actionSub}>Account & Settings</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── RECENT TRANSACTIONS ── */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push("/user/history")}>
            <Text style={styles.seeAll}>See All →</Text>
          </Pressable>
        </View>

        <View style={styles.recentCard}>
          {recentTxns.length === 0 ? (
            <View style={styles.emptyTxn}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySub}>Tap Pay to make your first payment</Text>
              <Pressable style={styles.emptyPayBtn} onPress={() => router.push("/user/pay")}>
                <Text style={styles.emptyPayBtnText}>Make a Payment</Text>
              </Pressable>
            </View>
          ) : (
            recentTxns.map((item, index) => (
              <Pressable
                key={item.id}
                style={[styles.txnRow, index < recentTxns.length - 1 && styles.txnRowBorder]}
                onPress={() => router.push("/user/history")}
              >
                <View style={[styles.txnIcon, item.type === "credit" ? styles.txnIconCredit : styles.txnIconDebit]}>
                  <Text style={styles.txnIconText}>{item.type === "credit" ? "↓" : "↑"}</Text>
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.txnDate}>{formatDate(item.timestamp)}</Text>
                  {item.status && (
                    <Text style={[styles.txnStatus, item.status === "synced" ? styles.txnStatusSynced : styles.txnStatusPending]}>
                      {item.status === "synced" ? "✓ Synced" : "⏳ Pending sync"}
                    </Text>
                  )}
                </View>
                <Text style={[styles.txnAmount, item.type === "credit" ? styles.txnAmountCredit : styles.txnAmountDebit]}>
                  {item.type === "credit" ? "+" : "-"}₹{item.amount}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* ── INFO CARD ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ About Offline Payments</Text>
          <Text style={styles.infoText}>• Vouchers work without internet after generation</Text>
          <Text style={styles.infoText}>• Cryptographically signed with ECDSA for security</Text>
          <Text style={styles.infoText}>• Maximum single top-up: ₹{MAX_ADD_AMOUNT}</Text>
          <Text style={styles.infoText}>• Settlements sync automatically when back online</Text>
        </View>

        <View style={{ height: 36 }} />
      </ScrollView>

      {/* ── ADD MONEY MODAL ── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Money to Wallet</Text>
            <Text style={styles.modalSub}>Maximum ₹{MAX_ADD_AMOUNT} per transaction</Text>

            <View style={styles.amountRow}>
              <Text style={styles.rupeeSym}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Enter amount"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                value={addAmount}
                onChangeText={setAddAmount}
                autoFocus
              />
            </View>

            <View style={styles.chipRow}>
              {[100, 200, 500, 1000].map((v) => (
                <Pressable
                  key={v}
                  style={[styles.chip, addAmount === String(v) && styles.chipActive]}
                  onPress={() => setAddAmount(String(v))}
                >
                  <Text style={[styles.chipText, addAmount === String(v) && styles.chipTextActive]}>₹{v}</Text>
                </Pressable>
              ))}
            </View>

            {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

            <View style={styles.modalBtns}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => { setShowAddModal(false); setAddAmount(""); setError(null); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, loading && styles.btnDisabled]}
                onPress={handleAddBalance}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Add Money</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 58,
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  greeting: { fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  userName: { fontSize: 22, color: "#fff", fontWeight: "800", marginTop: 2 },
  avatarBtn: { borderRadius: 26, overflow: "hidden" },
  avatarGrad: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#4f46e5" },

  balanceCard: {
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  balanceCardInner: { padding: 26 },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600", letterSpacing: 0.5 },
  balanceAmount: { fontSize: 46, fontWeight: "900", color: "#fff", marginTop: 4, marginBottom: 16 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balancePill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balancePillOffline: {
    backgroundColor: "rgba(251,191,36,0.35)",
  },
  balancePillText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  addBtn: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { fontSize: 13, color: "#4f46e5", fontWeight: "700" },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginTop: 26,
    marginBottom: 12,
    marginHorizontal: 22,
  },

  actionGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 14, gap: 10 },
  actionCard: { width: "47%", borderRadius: 18, overflow: "hidden" },
  actionCardPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  actionGrad: { padding: 20, alignItems: "flex-start", minHeight: 115, justifyContent: "space-between" },
  actionIcon: { fontSize: 28 },
  actionLabel: { fontSize: 16, fontWeight: "800", color: "#fff", marginTop: 8 },
  actionSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "500" },

  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 22,
    marginTop: 4,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600" },

  recentCard: {
    marginHorizontal: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    overflow: "hidden",
  },
  emptyTxn: { alignItems: "center", padding: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 4 },
  emptySub: { fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 16 },
  emptyPayBtn: { backgroundColor: "#4f46e5", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  emptyPayBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  txnRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 },
  txnRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  txnIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginRight: 14 },
  txnIconCredit: { backgroundColor: "#dcfce7" },
  txnIconDebit: { backgroundColor: "#fee2e2" },
  txnIconText: { fontSize: 18, fontWeight: "700" },
  txnInfo: { flex: 1 },
  txnDesc: { fontSize: 14, fontWeight: "600", color: "#1f2937", marginBottom: 2 },
  txnDate: { fontSize: 12, color: "#9ca3af" },
  txnStatus: { fontSize: 11, marginTop: 2, fontWeight: "600" },
  txnStatusSynced: { color: "#16a34a" },
  txnStatusPending: { color: "#f59e0b" },
  txnAmount: { fontSize: 15, fontWeight: "800" },
  txnAmountCredit: { color: "#16a34a" },
  txnAmountDebit: { color: "#dc2626" },

  infoCard: {
    marginHorizontal: 18,
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  infoTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 10 },
  infoText: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 4, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 4 },
  modalSub: { fontSize: 13, color: "#9ca3af", textAlign: "center", marginBottom: 22 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#4f46e5",
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  rupeeSym: { fontSize: 26, fontWeight: "800", color: "#4f46e5", marginRight: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: "700", color: "#111827", paddingVertical: 14 },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  chipActive: { backgroundColor: "#ede9fe", borderColor: "#4f46e5" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  chipTextActive: { color: "#4f46e5" },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12, fontWeight: "500" },
  modalBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#4f46e5" },
  confirmBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
});
