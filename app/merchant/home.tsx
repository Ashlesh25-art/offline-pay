import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function MerchantHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [merchantData, setMerchantData] = useState<any>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // Safe logout — runs inside React lifecycle, not inside Alert callback
  useEffect(() => {
    if (!loggingOut) return;
    AsyncStorage.multiRemove(["@auth_token", "@merchant_data", "@merchant_id", "@offline_vouchers"])
      .then(() => router.replace("/merchant-login"));
  }, [loggingOut]);

  const loadMerchantData = useCallback(async () => {
    try {
      const merchantDataStr = await AsyncStorage.getItem("@merchant_data");
      const currentMerchantId = await AsyncStorage.getItem("@merchant_id");
      if (merchantDataStr && currentMerchantId) {
        setMerchantData(JSON.parse(merchantDataStr));
        setMerchantId(currentMerchantId);
      }
      const existing = await AsyncStorage.getItem("@offline_vouchers");
      if (existing) {
        const vouchers = JSON.parse(existing);
        const pending = vouchers.filter((v: any) => v.status === "offline").length;
        const total = vouchers.reduce((s: number, v: any) => s + v.amount, 0);
        setPendingCount(pending);
        setTotalEarned(total);
      }
    } catch (error) {
      console.log("Error loading merchant data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time this screen comes into focus so pending count stays fresh
  useFocusEffect(useCallback(() => { loadMerchantData(); }, [loadMerchantData]));

  const handleLogout = () => setLoggingOut(true);

  if (loading) {
    return (
      <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </LinearGradient>
    );
  }

  if (!merchantId) {
    return (
      <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorText}>Session expired. Please login again.</Text>
        <Pressable style={styles.outlineBtn} onPress={() => router.replace("/merchant-login")}>
          <Text style={styles.outlineBtnText}>Go to Login</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const businessName = merchantData?.businessName || merchantData?.name || "Your Business";
  const merchantPayload = JSON.stringify({ merchantId, name: businessName });
  const shortId = merchantId.length > 20 ? `...${merchantId.slice(-16)}` : merchantId;

  return (
    <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.gradient}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.businessName} numberOfLines={1}>{businessName}</Text>
          </View>
          <Pressable style={styles.profileBtn} onPress={() => router.push("/merchant/profile")}>
            <Text style={styles.profileBtnEmoji}>👤</Text>
          </Pressable>
        </View>

        {/* Stats Strip */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{totalEarned}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, pendingCount > 0 && { color: "#fbbf24" }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending Sync</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{merchantData?.isVerified ? "✓" : "—"}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        {/* QR Card */}
        <View style={styles.qrCard}>
          <Text style={styles.qrLabel}>📱 Your Payment QR Code</Text>
          <Text style={styles.qrSub}>Show this to customers to receive payments</Text>
          <View style={styles.qrBox}>
            <QRCode value={merchantPayload} size={200} backgroundColor="#ffffff" color="#15803d" />
          </View>
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>MERCHANT ID</Text>
            <Text style={styles.idValue} numberOfLines={1}>{shortId}</Text>
          </View>
        </View>

        {/* Pending sync alert */}
        {pendingCount > 0 && (
          <Pressable style={styles.syncAlert} onPress={() => router.push("/merchant/history")}>
            <Text style={styles.syncAlertText}>
              ⚠️  {pendingCount} voucher{pendingCount !== 1 ? "s" : ""} waiting to sync → Tap to go to History
            </Text>
          </Pressable>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, styles.receiveCard, pressed && styles.cardPressed]}
            onPress={() => router.push("/merchant/receive")}
          >
            <Text style={styles.actionEmoji}>💰</Text>
            <Text style={styles.actionTitle}>{"Receive\nPayment"}</Text>
            <Text style={styles.actionSub}>Scan customer QR voucher</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, styles.historyCard, pressed && styles.cardPressed]}
            onPress={() => router.push("/merchant/history")}
          >
            <Text style={styles.actionEmoji}>📋</Text>
            <Text style={styles.actionTitle}>{"Transaction\nHistory"}</Text>
            <Text style={styles.actionSub}>View sales & sync to server</Text>
          </Pressable>
        </View>

        {/* Profile & Logout */}
        <View style={styles.bottomBtns}>
          <Pressable
            style={[styles.outlineBtn, styles.profileBtnFull]}
            onPress={() => router.push("/merchant/profile")}
          >
            <Text style={styles.outlineBtnText}>👤  My Profile</Text>
          </Pressable>
          <Pressable
            style={[styles.outlineBtn, styles.logoutBtnFull]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutBtnText}>🚪  Log Out</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  loadingText: { marginTop: 12, fontSize: 15, color: "#fff" },
  errorText: { fontSize: 15, color: "#fff", marginBottom: 20, textAlign: "center" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerLeft: { flex: 1, marginRight: 12 },
  welcomeText: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 2 },
  businessName: { fontSize: 22, fontWeight: "800", color: "#fff" },
  profileBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  profileBtnEmoji: { fontSize: 20 },

  statsRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 16, paddingVertical: 16, marginBottom: 18 },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "500" },

  qrCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 22,
    alignItems: "center", marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  qrLabel: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 4 },
  qrSub: { fontSize: 12, color: "#6b7280", marginBottom: 16, textAlign: "center" },
  qrBox: {
    padding: 14, borderRadius: 14, backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, marginBottom: 16,
  },
  idRow: { backgroundColor: "#f0fdf4", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, width: "100%", alignItems: "center" },
  idLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  idValue: { fontSize: 13, fontWeight: "700", color: "#15803d" },

  syncAlert: { backgroundColor: "#fef3c7", borderRadius: 12, padding: 14, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: "#f59e0b" },
  syncAlertText: { fontSize: 13, color: "#92400e", fontWeight: "600", lineHeight: 20 },

  sectionHeading: { fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.9)", marginBottom: 12 },
  actionsGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  actionCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 20,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  receiveCard: { borderTopWidth: 4, borderTopColor: "#16a34a" },
  historyCard: { borderTopWidth: 4, borderTopColor: "#2563eb" },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  actionEmoji: { fontSize: 34, marginBottom: 10 },
  actionTitle: { fontSize: 14, fontWeight: "700", color: "#1f2937", textAlign: "center", marginBottom: 6, lineHeight: 20 },
  actionSub: { fontSize: 11, color: "#6b7280", textAlign: "center" },

  bottomBtns: { flexDirection: "row", gap: 10 },
  outlineBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  profileBtnFull: {},
  logoutBtnFull: { borderColor: "rgba(254,202,202,0.5)", backgroundColor: "rgba(254,202,202,0.15)" },
  outlineBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  logoutBtnText: { color: "#fca5a5", fontSize: 14, fontWeight: "700" },
});
