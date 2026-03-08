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
  ScrollView,
  Share,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  API_BASE_URL,
  getOfflineTransactions,
  syncOfflineTransactions,
  getGeneratedVouchers,
  GeneratedVoucher,
  isVoucherExpired,
} from "../../lib/api";
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
  voucherData?: GeneratedVoucher;
};

export default function UserHistoryScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"transactions" | "vouchers">("transactions");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [vouchers, setVouchers] = useState<GeneratedVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null);
  const [pdfLoadingVoucher, setPdfLoadingVoucher] = useState<string | null>(null);
  const [shareLoadingVoucher, setShareLoadingVoucher] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      // ── Sync pending transactions first ────────────────────────────────────
      try { await syncOfflineTransactions(token); } catch { /* offline, skip */ }

      // ── Count remaining pending after sync ──────────────────────────────
      const allTxns = await getOfflineTransactions();      // Only "pending" ones need syncing (failed = server rejected, synced = done)      setPendingCount(allTxns.filter((t) => t.status === "pending").length);

      // ── Load all generated vouchers ────────────────────────────────────────
      const allVouchers = await getGeneratedVouchers();
      allVouchers.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setVouchers(allVouchers);
      const voucherMap = new Map(allVouchers.map((v) => [v.voucherId, v]));

      // ── Load local offline transactions (pending only) ──────────────────────────
      // "synced" transactions are already returned by the backend — including them
      // here too would create duplicates. "failed" ones are shown separately below.
      const offlineTxns = await getOfflineTransactions();
      const localTxns: Transaction[] = offlineTxns
        .filter((t) => t.status === "pending") // synced & failed excluded
        .map((t) => ({
        id: t.voucherId,
        type: "debit" as const,
        category: "payment",
        amount: t.amount,
        description: `Paid to ${t.merchantId}`,
        merchantId: t.merchantId,
        timestamp: t.timestamp,
        status: t.status === "synced" ? "synced" : "pending",
        voucherData: voucherMap.get(t.voucherId),
      }));

      // ── Load from backend ──────────────────────────────────────────────────
      let backendTxns: Transaction[] = [];
      try {
        const response = await fetch(`${API_BASE_URL}/api/transactions/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          backendTxns = (data.transactions || []).map((t: Transaction) => ({
            ...t,
            voucherData: voucherMap.get(t.id),
          }));
        }
      } catch {
        /* offline */
      }

      // ── Merge & sort ───────────────────────────────────────────────────────
      const backendIds = new Set(backendTxns.map((t) => t.id));
      const merged = [
        ...backendTxns,
        ...localTxns.filter((t) => !backendIds.has(t.id)),
      ];
      merged.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
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

  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) return;
      const synced = await syncOfflineTransactions(token);
      if (synced > 0) {
        setSyncResult(`✅ ${synced} transaction${synced > 1 ? "s" : ""} synced!`);
      } else {
        // Check if we actually reached the server or were just offline
        const isOnline = await fetch(`${API_BASE_URL}/api/health`, { method: "HEAD" })
          .then((r) => r.ok).catch(() => false);
        if (isOnline) {
          setSyncResult("⚠️ Payments could not be verified — try again later");
        } else {
          setSyncResult("📵 Still offline — try again when connected");
        }
      }
      await loadTransactions();
    } catch {
      setSyncResult("📵 Could not sync — check your connection");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 4000);
    }
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

  // ── Voucher Download PDF ─────────────────────────────────────────────────
  const handleVoucherDownload = async (v: GeneratedVoucher) => {
    try {
      setPdfLoadingVoucher(v.voucherId);
      const statusText = v.used ? '✅ Payment Confirmed' : '⏳ Pending merchant scan';
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:24px;background:#f9fafb;color:#1f2937}
  .card{background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
  .header{text-align:center;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border-radius:12px;padding:24px;margin-bottom:20px}
  .header h1{margin:0 0 4px 0;font-size:22px}.header p{margin:0;opacity:.85;font-size:13px}
  .amount{font-size:40px;font-weight:700;text-align:center;color:#dc2626}
  .label{font-size:13px;color:#9ca3af;text-align:center;margin-bottom:6px}
  table{width:100%;border-collapse:collapse}
  td{padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
  td.lbl{color:#6b7280;width:40%}td.val{color:#1f2937;font-weight:500;text-align:right}
  .badge{display:inline-block;padding:6px 16px;border-radius:20px;background:${v.used?'#d1fae5':'#fef3c7'};color:${v.used?'#065f46':'#92400e'};font-weight:600;font-size:14px}
  .center{text-align:center;margin-top:12px}
  .footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:24px}
</style></head><body>
  <div class="header"><h1>Offline Pay</h1><p>Payment Voucher Receipt</p></div>
  <div class="card">
    <div class="label">Amount Paid</div>
    <div class="amount">-&#8377;${v.amount}</div>
    <div class="center"><span class="badge">${statusText}</span></div>
  </div>
  <div class="card"><table>
    <tr><td class="lbl">Voucher ID</td><td class="val">${v.voucherId}</td></tr>
    <tr><td class="lbl">Merchant</td><td class="val">${v.merchantName || v.merchantId}</td></tr>
    <tr><td class="lbl">Status</td><td class="val">${statusText}</td></tr>
    <tr><td class="lbl">Created</td><td class="val">${new Date(v.createdAt).toLocaleString('en-IN')}</td></tr>
  </table></div>
  <div class="footer">Generated by Offline Pay &bull; ${new Date().toLocaleString('en-IN')}</div>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save or Share Voucher PDF', UTI: 'com.adobe.pdf' });
    } catch (e: any) {
      Alert.alert('Error', 'Could not generate PDF: ' + (e?.message || String(e)));
    } finally {
      setPdfLoadingVoucher(null);
    }
  };

  // ── Voucher Share as text ─────────────────────────────────────────────────
  const handleVoucherShare = async (v: GeneratedVoucher) => {
    try {
      setShareLoadingVoucher(v.voucherId);
      const statusText = v.used ? '✅ Confirmed' : '⏳ Pending';
      const lines = [
        '💳 *Offline Pay — Payment Voucher*',
        '',
        `*Amount:* -₹${v.amount}`,
        `*Merchant:* ${v.merchantName || v.merchantId}`,
        `*Status:* ${statusText}`,
        `*Voucher ID:* ${v.voucherId}`,
        `*Created:* ${new Date(v.createdAt).toLocaleString('en-IN')}`,
        '',
        '_Sent via Offline Pay_',
      ].join('\n');
      await Share.share({ message: lines, title: 'Payment Voucher' });
    } catch {
      // User cancelled
    } finally {
      setShareLoadingVoucher(null);
    }
  };

  // QR value contains only the fields the merchant needs for verification
  const getVoucherQRValue = (v: GeneratedVoucher) =>
    JSON.stringify({
      voucherId: v.voucherId,
      merchantId: v.merchantId,
      amount: v.amount,
      createdAt: v.createdAt,
      issuedTo: v.issuedTo,
      signature: v.signature,
      publicKeyHex: v.publicKeyHex,
    });

  // ── Transaction row ──────────────────────────────────────────────────────
  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isRefund = (item as any).category === 'voucher_refund';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.transactionCard,
          pressed && styles.transactionCardPressed,
        ]}
        onPress={() => handleTransactionPress(item)}
      >
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.iconCircle,
              isRefund ? styles.refundIcon
              : item.type === "credit" ? styles.creditIcon : styles.debitIcon,
            ]}
          >
            <Text style={styles.iconText}>
              {isRefund ? "↩" : item.type === "credit" ? "+" : "-"}
            </Text>
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDesc}>{item.description}</Text>
            <Text style={styles.transactionDate}>{formatDate(item.timestamp)}</Text>
            {isRefund && (
              <View style={styles.refundBadge}>
                <Text style={styles.refundBadgeText}>💸 Voucher Expired — Amount Refunded</Text>
              </View>
            )}
            {!isRefund && item.status && (
              <Text
                style={[
                  styles.status,
                  item.status === "synced" && item.voucherData?.used ? styles.statusSynced
                  : item.status === "synced" ? styles.statusBacked
                  : styles.statusPending,
                ]}
              >
                {item.status === "synced" && item.voucherData?.used
                  ? "✅ Payment Confirmed"
                  : item.status === "synced"
                  ? "💾 Backed up — show QR to merchant"
                  : "⏳ Offline — show QR to merchant"}
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
  };

  // ── Voucher card (expandable with QR) ───────────────────────────────────
  const renderVoucher = (v: GeneratedVoucher) => {
    const isExpanded = expandedVoucher === v.voucherId;
    return (
      <View key={v.voucherId} style={styles.voucherCard}>
        <Pressable
          style={styles.voucherHeader}
          onPress={() => setExpandedVoucher(isExpanded ? null : v.voucherId)}
        >
          <View style={styles.voucherHeaderLeft}>
            <View style={[styles.voucherStatusDot, v.used ? styles.dotUsed : styles.dotPending]} />
            <View>
              <Text style={styles.voucherAmount}>₹{v.amount}</Text>
              <Text style={styles.voucherMerchant}>
                {v.merchantName || v.merchantId}
              </Text>
              <Text style={styles.voucherDate}>{formatDate(v.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.voucherHeaderRight}>
            <View style={[
              styles.voucherBadge,
              (v as any).expired ? styles.badgeExpired
              : v.used ? styles.badgeUsed
              : styles.badgePending
            ]}>
              <Text style={[
                styles.voucherBadgeText,
                (v as any).expired ? styles.badgeTextExpired
                : v.used ? styles.badgeTextUsed
                : styles.badgeTextPending
              ]}>
                {(v as any).expired ? "↩ Refunded" : v.used ? "✅ Used" : "⏳ Pending"}
              </Text>
            </View>
            <Text style={styles.expandArrow}>{isExpanded ? "▲" : "▼"}</Text>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.voucherExpanded}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={getVoucherQRValue(v)}
                size={180}
                backgroundColor="#ffffff"
                color="#1a1a2e"
              />
            </View>
            {!v.used && (
              <Text style={styles.qrHint}>
                📲 Show this QR code to the merchant to complete payment
              </Text>
            )}

            {/* Download + Share buttons */}
            <View style={styles.voucherActionRow}>
              <Pressable
                style={[styles.voucherActionBtn, styles.voucherDownloadBtn, pdfLoadingVoucher === v.voucherId && styles.voucherBtnDisabled]}
                onPress={() => handleVoucherDownload(v)}
                disabled={pdfLoadingVoucher === v.voucherId || shareLoadingVoucher === v.voucherId}
              >
                {pdfLoadingVoucher === v.voucherId
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.voucherActionBtnText}>📥 Download PDF</Text>
                }
              </Pressable>
              <Pressable
                style={[styles.voucherActionBtn, styles.voucherShareBtn, shareLoadingVoucher === v.voucherId && styles.voucherBtnDisabled]}
                onPress={() => handleVoucherShare(v)}
                disabled={pdfLoadingVoucher === v.voucherId || shareLoadingVoucher === v.voucherId}
              >
                {shareLoadingVoucher === v.voucherId
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.voucherActionBtnText}>📤 Share</Text>
                }
              </Pressable>
            </View>

            <View style={styles.voucherDetailGrid}>
              <View style={styles.voucherDetailRow}>
                <Text style={styles.voucherDetailLabel}>Voucher ID</Text>
                <Text style={styles.voucherDetailValue} numberOfLines={1}>
                  {v.voucherId.replace("V_", "#")}
                </Text>
              </View>
              <View style={styles.voucherDetailRow}>
                <Text style={styles.voucherDetailLabel}>Merchant</Text>
                <Text style={styles.voucherDetailValue}>
                  {v.merchantName || v.merchantId}
                </Text>
              </View>
              <View style={styles.voucherDetailRow}>
                <Text style={styles.voucherDetailLabel}>Amount</Text>
                <Text style={[styles.voucherDetailValue, styles.voucherAmountBig]}>
                  ₹{v.amount}
                </Text>
              </View>
              <View style={styles.voucherDetailRow}>
                <Text style={styles.voucherDetailLabel}>Status</Text>
                <Text style={[styles.voucherDetailValue,
                  (v as any).expired ? styles.textExpired
                  : v.used ? styles.textUsed : styles.textPending
                ]}>
                  {(v as any).expired
                    ? "↩ Expired — amount refunded to wallet"
                    : v.used ? "✅ Merchant received payment"
                    : "⏳ Not yet scanned by merchant"}
                </Text>
              </View>
              <View style={styles.voucherDetailRow}>
                <Text style={styles.voucherDetailLabel}>Created</Text>
                <Text style={styles.voucherDetailValue}>{formatDate(v.createdAt)}</Text>
              </View>
              {(v as any).expiresAt && (
                <View style={styles.voucherDetailRow}>
                  <Text style={styles.voucherDetailLabel}>
                    {(v as any).expired ? "Expired on" : "Expires"}
                  </Text>
                  <Text style={[styles.voucherDetailValue,
                    (v as any).expired ? styles.textExpired : { color: '#d97706' }
                  ]}>
                    {formatDate((v as any).expiresAt)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#4f46e5", "#7c3aed", "#a855f7"]} style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ── */}
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
          <Text style={styles.title}>
            {activeTab === "transactions" ? "Transaction History" : "My Vouchers"}
          </Text>
          <Text style={styles.headerSub}>
            {activeTab === "transactions"
              ? `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}`
              : `${vouchers.length} voucher${vouchers.length !== 1 ? "s" : ""}`}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── TAB SWITCHER ── */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, activeTab === "transactions" && styles.tabActive]}
          onPress={() => setActiveTab("transactions")}
        >
          <Text style={[styles.tabText, activeTab === "transactions" && styles.tabTextActive]}>
            📋 Transactions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "vouchers" && styles.tabActive]}
          onPress={() => setActiveTab("vouchers")}
        >
          <Text style={[styles.tabText, activeTab === "vouchers" && styles.tabTextActive]}>
            🎫 Vouchers
            {vouchers.filter((v) => !v.used).length > 0 && (
              <Text style={styles.tabBadge}>
                {" "}{vouchers.filter((v) => !v.used).length}
              </Text>
            )}
          </Text>
        </Pressable>
      </View>

      {/* ── PENDING SYNC BANNER ── */}
      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <View style={styles.syncBannerLeft}>
            <Text style={styles.syncBannerIcon}>⏳</Text>
            <Text style={styles.syncBannerText}>
              {pendingCount} payment{pendingCount > 1 ? "s" : ""} pending sync
            </Text>
          </View>
          <Pressable
            style={[styles.syncNowBtn, syncing && styles.syncNowBtnDisabled]}
            onPress={handleSyncNow}
            disabled={syncing}
          >
            {syncing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.syncNowBtnText}>Sync Now</Text>
            }
          </Pressable>
        </View>
      )}
      {syncResult && (
        <View style={[styles.syncBanner, syncResult.startsWith("✅") ? styles.syncBannerSuccess : styles.syncBannerError]}>
          <Text style={styles.syncBannerText}>{syncResult}</Text>
        </View>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {activeTab === "transactions" && (
        <>
          {transactions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your transaction history will appear here
                </Text>
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
                <Text style={styles.listHeader}>Tap any transaction for details</Text>
              }
            />
          )}
        </>
      )}

      {/* ── VOUCHERS TAB ── */}
      {activeTab === "vouchers" && (
        <ScrollView
          contentContainerStyle={styles.voucherListContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
        >
          {vouchers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyTitle}>No Vouchers Yet</Text>
              <Text style={styles.emptySubtitle}>
                Vouchers you generate while paying will appear here with their QR codes
              </Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push("/user/pay")}>
                <Text style={styles.emptyBtnText}>Pay a merchant</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {vouchers.filter((v) => !v.used).length > 0 && (
                <Text style={styles.sectionLabel}>⏳ Pending — tap to show QR to merchant</Text>
              )}
              {vouchers.filter((v) => !v.used).map(renderVoucher)}

              {vouchers.filter((v) => v.used).length > 0 && (
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                  ✅ Completed payments
                </Text>
              )}
              {vouchers.filter((v) => v.used).map(renderVoucher)}
            </>
          )}
        </ScrollView>
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
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 58,
    paddingBottom: 12,
    paddingHorizontal: 18,
  },
  backButton: { marginRight: 12 },
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
  title: { fontSize: 22, fontWeight: "800", color: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "500",
  },
  // ── Tab switcher ──
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.75)" },
  tabTextActive: { color: "#4f46e5" },
  tabBadge: { fontSize: 12, fontWeight: "700", color: "#f59e0b" },
  sectionLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 2,
  },
  // ── Transactions ──
  listContainer: { paddingHorizontal: 16, paddingBottom: 30 },
  listHeader: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 12,
    marginTop: 4,
    fontWeight: "500",
  },
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
  transactionCardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  transactionLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  transactionRight: { alignItems: "flex-end" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  creditIcon: { backgroundColor: "#dcfce7" },
  debitIcon: { backgroundColor: "#fee2e2" },
  refundIcon: { backgroundColor: "#e0e7ff" },
  iconText: { fontSize: 20, fontWeight: "700" },
  transactionInfo: { flex: 1 },
  transactionDesc: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  transactionDate: { fontSize: 12, color: "#6b7280" },
  refundBadge: {
    marginTop: 4,
    backgroundColor: "#e0e7ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start" as const,
  },
  refundBadgeText: { fontSize: 11, color: "#3730a3", fontWeight: "700" },
  status: { fontSize: 11, marginTop: 4, textTransform: "uppercase" as const },
  statusSynced: { color: "#16a34a" },
  statusBacked: { color: "#2563eb" },
  statusPending: { color: "#f59e0b" },
  transactionAmount: { fontSize: 16, fontWeight: "700" },
  tapHint: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  creditAmount: { color: "#16a34a" },
  debitAmount: { color: "#dc2626" },
  // ── Vouchers list ──
  voucherListContainer: { paddingHorizontal: 16, paddingBottom: 30 },
  voucherCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  voucherHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  voucherHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  voucherHeaderRight: { alignItems: "flex-end", gap: 6 },
  voucherStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  dotUsed: { backgroundColor: "#10b981" },
  dotPending: { backgroundColor: "#f59e0b" },
  voucherAmount: { fontSize: 22, fontWeight: "800", color: "#1a1a2e" },
  voucherMerchant: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginTop: 2,
  },
  voucherDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  voucherBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeUsed: { backgroundColor: "#d1fae5" },
  badgePending: { backgroundColor: "#fef3c7" },
  badgeExpired: { backgroundColor: "#fce7f3" },
  voucherBadgeText: { fontSize: 12, fontWeight: "700" },
  badgeTextUsed: { color: "#065f46" },
  badgeTextPending: { color: "#92400e" },
  badgeTextExpired: { color: "#9d174d" },
  expandArrow: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  // ── Voucher expanded ──
  voucherExpanded: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  qrHint: {
    fontSize: 13,
    color: "#4f46e5",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  voucherDetailGrid: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  voucherDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  voucherDetailLabel: { fontSize: 12, color: "#6b7280", flex: 1 },
  voucherDetailValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "600",
    flex: 2,
    textAlign: "right",
  },
  voucherAmountBig: { fontSize: 16, color: "#4f46e5", fontWeight: "800" },
  textUsed: { color: "#065f46" },
  textPending: { color: "#92400e" },
  textExpired: { color: "#9d174d" },
  // ── Voucher action buttons ──
  voucherActionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  voucherActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherDownloadBtn: { backgroundColor: "#2563eb" },
  voucherShareBtn: { backgroundColor: "#16a34a" },
  voucherBtnDisabled: { opacity: 0.6 },
  voucherActionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  // ── Sync banner ──
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245,158,11,0.2)",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  syncBannerSuccess: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderLeftColor: "#10b981",
  },
  syncBannerError: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderLeftColor: "#ef4444",
  },
  syncBannerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  syncBannerIcon: { fontSize: 16, marginRight: 8 },
  syncBannerText: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  syncNowBtn: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 10,
    minWidth: 80,
    alignItems: "center",
  },
  syncNowBtnDisabled: { opacity: 0.6 },
  syncNowBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
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
  emptyIcon: { fontSize: 56, marginBottom: 14 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
  },
  emptySubtitle: { fontSize: 14, color: "#6b7280", textAlign: "center" },
});
