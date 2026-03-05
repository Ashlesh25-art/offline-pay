import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_BASE_URL } from "../../lib/api";
import TransactionDetailModal from "../../components/TransactionDetailModal";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  payerName?: string;
  timestamp: string;
  status?: string;
  merchantId?: string;
  syncError?: string | null;
};

export default function MerchantHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalReceived, setTotalReceived] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending" | "synced">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    let backendTransactions: Transaction[] = [];
    let backendTotal = 0;
    let offlineVouchers: any[] = [];
    let offlineTransactions: Transaction[] = [];

    // STEP 1: Load offline vouchers from AsyncStorage
    try {
      const existing = await AsyncStorage.getItem("@offline_vouchers");
      if (existing) {
        offlineVouchers = JSON.parse(existing);
        offlineTransactions = offlineVouchers.map((v: any) => ({
          id: v.voucherId,
          type: "credit",
          amount: v.amount,
          description: "Payment received",
          payerName: v.issuedTo ? `User ...${v.issuedTo.slice(-6)}` : "Customer",
          timestamp: v.createdAt,
          status: v.status,
          syncError: v.syncError || null,
        }));
        const pending = offlineVouchers.filter((v: any) => v.status === "offline").length;
        const synced = offlineVouchers.filter((v: any) => v.status === "synced").length;
        setOfflineCount(pending);
        setSyncedCount(synced);
      } else {
        setOfflineCount(0);
        setSyncedCount(0);
      }
    } catch (e) {
      console.log("Error reading offline vouchers:", e);
      setOfflineCount(0);
      setSyncedCount(0);
    }

    // STEP 2: Load synced transactions from backend
    try {
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) {
        router.replace("/merchant-login");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/transactions/merchant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        backendTransactions = (data.transactions || []).map((t: any) => ({
          ...t,
          status: t.status || "synced",
        }));
        backendTotal = data.totalReceived || 0;
      }
    } catch (error) {
      console.error("Backend load error:", error);
    }

    // STEP 3: Merge — backend records are authoritative; local-only offline on top
    const backendIds = new Set(backendTransactions.map((t) => t.id));
    const localOnly = offlineTransactions.filter((t) => !backendIds.has(t.id));
    const allTransactions = [...backendTransactions, ...localOnly].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const totalLocal = offlineVouchers.reduce((s: number, v: any) => s + v.amount, 0);
    setTransactions(allTransactions);
    setTotalReceived(Math.max(backendTotal, totalLocal));
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const syncOfflineVouchers = async () => {
    if (syncing) return;
    if (offlineCount === 0) {
      Alert.alert("Nothing to Sync", "All received vouchers are already synced to the server.");
      return;
    }
    try {
      setSyncing(true);
      const existing = await AsyncStorage.getItem("@offline_vouchers");
      if (!existing) {
        Alert.alert("No Vouchers", "No offline vouchers found.");
        return;
      }
      const vouchers = JSON.parse(existing);
      const offlineVouchersToSync = vouchers.filter((v: any) => v.status === "offline");
      if (offlineVouchersToSync.length === 0) {
        Alert.alert("Already Synced", "All vouchers are already synced.");
        return;
      }
      const currentMerchantId = await AsyncStorage.getItem("@merchant_id");
      if (!currentMerchantId) {
        Alert.alert("Error", "Merchant ID not found. Please login again.");
        router.replace("/merchant-login");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/vouchers/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: currentMerchantId, vouchers: offlineVouchersToSync }),
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`Sync failed: ${response.status} - ${responseText}`);
      const result = JSON.parse(responseText);
      // Build a map of rejection reasons
      const rejectionMap: Record<string, string> = {};
      for (const r of (result.rejected || [])) {
        rejectionMap[r.voucherId] = r.reason || "Rejected by server";
      }
      // Mark synced vouchers; attach rejection reason to others
      const updated = vouchers.map((v: any) =>
        result.syncedIds.includes(v.voucherId)
          ? { ...v, status: "synced", syncedAt: new Date().toISOString(), syncError: null }
          : rejectionMap[v.voucherId]
          ? { ...v, syncError: rejectionMap[v.voucherId] }
          : v
      );
      await AsyncStorage.setItem("@offline_vouchers", JSON.stringify(updated));
      Alert.alert(
        "Sync Complete",
        `${result.syncedIds.length} voucher${result.syncedIds.length !== 1 ? "s" : ""} synced to backend${"\n"}` +
          (result.rejected?.length ? `${result.rejected.length} rejected (duplicate or invalid).` : "All accepted!")
      );
      loadTransactions();
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("Sync Failed", `Could not sync: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => { setSelectedTransaction(item); setDetailModalVisible(true); }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>+</Text>
          </View>
          <View style={styles.txInfo}>
            <Text style={styles.description}>{item.description}</Text>
            {item.payerName && <Text style={styles.payerName}>From: {item.payerName}</Text>}
            <Text style={styles.date}>{formatDate(item.timestamp)}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.amount}>+&#8377;{item.amount}</Text>
          <Text style={styles.tapHint}>Tap for details</Text>
        </View>
      </View>
      {item.status && (
        <View style={[styles.statusBadge, item.status === "synced" ? styles.statusSynced : styles.statusOffline]}>
          <Text style={[styles.statusText, item.status === "synced" ? styles.statusTextSynced : styles.statusTextOffline]}>
            {item.status === "synced" ? "✅ Synced to server" : "⏳ Pending sync"}
          </Text>
        </View>
      )}
      {/* Show WHY this voucher is not syncing */}
      {item.status !== "synced" && item.syncError && (
        <View style={styles.syncErrorBox}>
          <Text style={styles.syncErrorTitle}>⚠️ Last sync attempt failed:</Text>
          <Text style={styles.syncErrorMsg}>{item.syncError}</Text>
        </View>
      )}
      {item.status !== "synced" && !item.syncError && (
        <Text style={styles.syncPendingHint}>
          Not yet synced — tap "Sync" button above or wait for internet
        </Text>
      )}
    </Pressable>
  );

  if (loading) {
    return (
      <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={["#16a34a", "#15803d"]} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>&#8592; Back</Text>
        </Pressable>
        <Text style={styles.title}>Transaction History</Text>
        <Text style={styles.subtitle}>Payments received from customers</Text>
      </LinearGradient>

      {/* Stats Row — Pending Sync card is tappable */}
      <View style={styles.statsRow}>
        <Pressable style={styles.statCard} onPress={() => setFilter("all")}>
          <Text style={styles.statValue}>&#8377;{totalReceived}</Text>
          <Text style={styles.statLabel}>Total Received</Text>
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === "pending" && styles.statCardActive]}
          onPress={() => setFilter(filter === "pending" ? "all" : "pending")}
        >
          <Text style={[styles.statValue, { color: offlineCount > 0 ? "#f59e0b" : "#16a34a" }]}>{offlineCount}</Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
          {offlineCount > 0 && <Text style={styles.statTap}>tap to view</Text>}
        </Pressable>
        <Pressable
          style={[styles.statCard, filter === "synced" && styles.statCardActive]}
          onPress={() => setFilter(filter === "synced" ? "all" : "synced")}
        >
          <Text style={[styles.statValue, { color: "#16a34a" }]}>{syncedCount}</Text>
          <Text style={styles.statLabel}>Synced</Text>
        </Pressable>
      </View>

      {/* Sync Button — always visible */}
      <View style={styles.syncContainer}>
        <Pressable
          style={StyleSheet.flatten([
            styles.syncButton,
            syncing ? styles.syncButtonDisabled : null,
            !syncing && offlineCount === 0 ? styles.syncButtonAllSynced : null,
          ])}
          onPress={syncOfflineVouchers}
          disabled={syncing}
        >
          {syncing ? (
            <View style={styles.syncRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={[styles.syncButtonText, { marginLeft: 8 }]}>Syncing to backend...</Text>
            </View>
          ) : offlineCount > 0 ? (
            <Text style={styles.syncButtonText}>
              Sync {offlineCount} Offline Voucher{offlineCount !== 1 ? "s" : ""} to Backend
            </Text>
          ) : (
            <Text style={styles.syncButtonText}>All Synced — Tap to re-check</Text>
          )}
        </Pressable>
      </View>

      {/* Filter label */}
      {filter !== "all" && (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>
            {filter === "pending"
              ? `Showing ${transactions.filter(t => t.status !== "synced").length} pending voucher(s)`
              : `Showing ${transactions.filter(t => t.status === "synced").length} synced voucher(s)`}
          </Text>
          <Pressable onPress={() => setFilter("all")}>
            <Text style={styles.filterClear}>Show all ✕</Text>
          </Pressable>
        </View>
      )}

      {/* Transaction List */}
      {(() => {
        const filtered = filter === "pending"
          ? transactions.filter(t => t.status !== "synced")
          : filter === "synced"
          ? transactions.filter(t => t.status === "synced")
          : transactions;
        return filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>&#128176;</Text>
          <Text style={styles.emptyTitle}>No Payments Yet</Text>
          <Text style={styles.emptySubtitle}>
            Received vouchers will appear here after customers pay.
          </Text>
          <View style={styles.emptySteps}>
            <Text style={styles.emptyStep}>1. Show your QR code to the customer</Text>
            <Text style={styles.emptyStep}>2. Customer scans and creates a voucher</Text>
            <Text style={styles.emptyStep}>3. Go to Receive Payment and scan their QR</Text>
            <Text style={styles.emptyStep}>4. Tap Sync above to save to the server</Text>
          </View>
        </View>
        ) : (
          <FlatList
            data={filtered}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} · Pull to refresh
              </Text>
            }
          />
        );
      })()}

      <TransactionDetailModal
        visible={detailModalVisible}
        onClose={() => { setDetailModalVisible(false); setSelectedTransaction(null); }}
        transaction={selectedTransaction}
        userType="merchant"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16, color: "#ffffff", fontWeight: "500" },
  header: { paddingBottom: 24, paddingHorizontal: 20 },
  backButton: { marginBottom: 12 },
  backText: { color: "rgba(255,255,255,0.85)", fontSize: 16, fontWeight: "500" },
  title: { fontSize: 26, fontWeight: "800", color: "#ffffff", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.75)" },
  statsRow: { flexDirection: "row", margin: 16, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardActive: {
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  statTap: { fontSize: 10, color: "#2563eb", fontWeight: "600", marginTop: 2 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1f2937", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "#6b7280", fontWeight: "500", textAlign: "center" },
  syncContainer: { paddingHorizontal: 16, marginBottom: 12 },
  syncRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  syncButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  syncButtonAllSynced: { backgroundColor: "#16a34a", shadowColor: "#16a34a" },
  syncButtonDisabled: { backgroundColor: "#9ca3af", shadowColor: "#9ca3af" },
  syncButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  listContainer: { padding: 16, paddingTop: 4 },
  listHeader: { fontSize: 13, color: "#6b7280", marginBottom: 12, fontWeight: "500" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  cardRight: { alignItems: "flex-end" },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconText: { fontSize: 22, fontWeight: "800", color: "#16a34a" },
  txInfo: { flex: 1 },
  description: { fontSize: 15, fontWeight: "600", color: "#1f2937", marginBottom: 2 },
  payerName: { fontSize: 13, color: "#6b7280", marginBottom: 2 },
  date: { fontSize: 12, color: "#9ca3af" },
  amount: { fontSize: 18, fontWeight: "800", color: "#16a34a", marginBottom: 2 },
  tapHint: { fontSize: 11, color: "#9ca3af" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, marginTop: 10, alignSelf: "flex-start" },
  statusOffline: { backgroundColor: "#fef3c7" },
  statusSynced: { backgroundColor: "#dcfce7" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusTextOffline: { color: "#b45309" },
  statusTextSynced: { color: "#15803d" },
  syncErrorBox: {
    marginTop: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#dc2626",
  },
  syncErrorTitle: { fontSize: 11, fontWeight: "700", color: "#dc2626", marginBottom: 3 },
  syncErrorMsg: { fontSize: 12, color: "#7f1d1d", lineHeight: 17 },
  syncPendingHint: { fontSize: 11, color: "#92400e", marginTop: 8, fontStyle: "italic" },
  filterBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  filterBannerText: { fontSize: 12, color: "#1e40af", fontWeight: "600" },
  filterClear: { fontSize: 12, color: "#2563eb", fontWeight: "700" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 36 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#374151", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptySteps: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    width: "100%",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStep: { fontSize: 13, color: "#374151", fontWeight: "500" },
});
