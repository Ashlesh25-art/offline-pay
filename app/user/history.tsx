import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_BASE_URL, getOfflineTransactions } from "../../lib/api";
import TransactionDetailModal from "../../components/TransactionDetailModal";

type Transaction = {
  id: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  description: string;
  timestamp: string;
  status?: string;
  balance?: number;
  payerName?: string;
  merchantId?: string;
};

export default function UserHistoryScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // ── Load local offline transactions (always available) ──────────────────
      const offlineTxns = await getOfflineTransactions();
      const localTxns: Transaction[] = offlineTxns.map((t) => ({
        id: t.voucherId,
        type: "debit" as const,
        category: "payment",
        amount: t.amount,
        description: `Paid to ${t.merchantId}`,
        merchantId: t.merchantId,
        timestamp: t.timestamp,
        status: t.status === "synced" ? "synced" : "pending",
      }));

      // ── Load from backend (may return empty if backend bug not fixed yet) ───
      let backendTxns: Transaction[] = [];
      try {
        const response = await fetch(`${API_BASE_URL}/api/transactions/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          backendTxns = data.transactions || [];
        }
      } catch {
        // Offline — backend not reachable, use local only
      }

      // ── Merge: backend first, then add local ones not already in backend ────
      const backendIds = new Set(backendTxns.map((t) => t.id));
      const merged = [
        ...backendTxns,
        ...localTxns.filter((t) => !backendIds.has(t.id)),
      ];

      // Sort newest first
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setTransactions(merged);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailModalVisible(true);
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedTransaction(null);
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Pressable
      style={({ pressed }) => [
        styles.transactionCard,
        pressed && styles.transactionCardPressed
      ]}
      onPress={() => handleTransactionPress(item)}
    >
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.iconCircle,
            item.type === "credit" ? styles.creditIcon : styles.debitIcon,
          ]}
        >
          <Text style={styles.iconText}>
            {item.type === "credit" ? "+" : "-"}
          </Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDesc}>{item.description}</Text>
          <Text style={styles.transactionDate}>{formatDate(item.timestamp)}</Text>
          {item.status && (
            <Text style={[styles.status, item.status === "synced" ? styles.statusSynced : styles.statusPending]}>
              {item.status}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            item.type === "credit" ? styles.creditAmount : styles.debitAmount,
          ]}
        >
          {item.type === "credit" ? "+" : "-"}₹{item.amount}
        </Text>
        <Text style={styles.tapHint}>Tap for details</Text>
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#4f46e5", "#7c3aed", "#a855f7"]} style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── GRADIENT HEADER WITH BACK BUTTON ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <View style={styles.backBtnInner}>
            <Text style={styles.backArrow}>←</Text>
          </View>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Transaction History</Text>
          {transactions.length > 0 && (
            <Text style={styles.headerSub}>{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>Your transaction history will appear here</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push("/user/pay")}>
              <Text style={styles.emptyBtnText}>Make your first payment</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          ListHeaderComponent={
            <Text style={styles.listHeader}>
              Tap any transaction for details
            </Text>
          }
        />
      )}

      <TransactionDetailModal
        visible={detailModalVisible}
        onClose={closeDetailModal}
        transaction={selectedTransaction}
        userType="user"
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 58,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonPressed: { opacity: 0.7 },
  backBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { fontSize: 20, color: "#fff", fontWeight: "700" },
  headerCenter: { flex: 1 },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  headerSpacer: { width: 40 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  listHeader: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    width: "100%",
  },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  transactionCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  transactionRight: {
    alignItems: "flex-end",
  },
  transactionCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  creditIcon: {
    backgroundColor: "#dcfce7",
  },
  debitIcon: {
    backgroundColor: "#fee2e2",
  },
  iconText: {
    fontSize: 20,
    fontWeight: "700",
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: "#6b7280",
  },
  status: {
    fontSize: 11,
    marginTop: 4,
    textTransform: "uppercase",
  },
  statusSynced: {
    color: "#16a34a",
  },
  statusPending: {
    color: "#f59e0b",
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  tapHint: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 2,
  },
  creditAmount: {
    color: "#16a34a",
  },
  debitAmount: {
    color: "#dc2626",
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
