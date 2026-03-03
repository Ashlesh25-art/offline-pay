import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../lib/api";

export default function MerchantProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [originalShopName, setOriginalShopName] = useState("");
  const [originalAddress, setOriginalAddress] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Navigate outside nested stack reliably via useEffect
  useEffect(() => {
    if (!loggingOut) return;
    AsyncStorage.multiRemove([
      "@auth_token",
      "@merchant_data",
      "@merchant_id",
      "@offline_vouchers",
    ]).then(() => {
      router.replace("/merchant-login");
    });
  }, [loggingOut]);

  const loadProfile = async () => {
    try {
      const merchantData = await AsyncStorage.getItem("@merchant_data");
      if (merchantData) {
        const merchant = JSON.parse(merchantData);
        setName(merchant.name || merchant.businessName || "");
        setOriginalName(merchant.name || merchant.businessName || "");
        setShopName(merchant.shopName || merchant.businessName || merchant.name || "");
        setOriginalShopName(merchant.shopName || merchant.businessName || merchant.name || "");
        setAddress(merchant.address || "");
        setOriginalAddress(merchant.address || "");
        setPhone(merchant.phone || "");
        setMerchantId(merchant.merchantId || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("@auth_token");

      const response = await fetch(`${API_BASE_URL}/api/merchant/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: name.trim(),
          shopName: shopName.trim() || name.trim(),
          address: address.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update local storage
        const merchantData = await AsyncStorage.getItem("@merchant_data");
        if (merchantData) {
          const merchant = JSON.parse(merchantData);
          merchant.name = name.trim();
          merchant.shopName = shopName.trim() || name.trim();
          merchant.address = address.trim();
          await AsyncStorage.setItem("@merchant_data", JSON.stringify(merchant));
        }

        setOriginalName(name.trim());
        setOriginalShopName(shopName.trim());
        setOriginalAddress(address.trim());
        setIsEditing(false);
        Alert.alert("Success", "Profile updated successfully!");
      } else {
        Alert.alert("Error", data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(originalName);
    setShopName(originalShopName);
    setAddress(originalAddress);
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => setLoggingOut(true),
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </LinearGradient>
    );
  }

  const firstLetter = shopName ? shopName.charAt(0).toUpperCase() : "M";

  return (
    <LinearGradient colors={["#16a34a", "#15803d", "#166534"]} style={styles.container}>
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
        <Text style={styles.title}>Merchant Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── AVATAR CARD ── */}
        <View style={styles.avatarCard}>
          <LinearGradient colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.08)"]} style={styles.avatarCardInner}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{firstLetter}</Text>
            </View>
            <Text style={styles.avatarName}>{shopName || "Merchant"}</Text>
            <Text style={styles.avatarId}>ID: {merchantId || "—"}</Text>
            <View style={styles.merchantBadge}>
              <Text style={styles.merchantBadgeText}>🏪 Merchant Account</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── FIELDS CARD ── */}
        <View style={styles.fieldsCard}>
          {/* Shop Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>SHOP NAME</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={shopName}
                onChangeText={setShopName}
                placeholder="Enter shop name"
                autoFocus
              />
            ) : (
              <View style={styles.valueRow}>
                <Text style={styles.value}>{shopName || "Not set"}</Text>
                <Pressable style={styles.editPill} onPress={() => setIsEditing(true)}>
                  <Text style={styles.editPillText}>✏️ Edit</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.fieldDivider} />

          {/* Owner Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>OWNER NAME</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
              />
            ) : (
              <Text style={styles.value}>{name || "Not set"}</Text>
            )}
          </View>

          <View style={styles.fieldDivider} />

          {/* Address */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>BUSINESS ADDRESS</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter business address"
                multiline
                numberOfLines={2}
              />
            ) : (
              <Text style={styles.value}>{address || "Not set"}</Text>
            )}
          </View>

          <View style={styles.fieldDivider} />

          {/* Phone */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <Text style={styles.value}>{phone}</Text>
            <Text style={styles.hint}>Cannot be changed</Text>
          </View>

          {/* Edit Buttons */}
          {isEditing && (
            <View style={styles.editButtons}>
              <Pressable style={[styles.actionBtn, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── SECURITY CARD ── */}
        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>🔐 Account Security</Text>
          <View style={styles.securityRow}>
            <Text style={styles.securityLabel}>Wallet Type</Text>
            <View style={styles.securityBadge}><Text style={styles.securityBadgeText}>Offline</Text></View>
          </View>
          <View style={styles.securityRow}>
            <Text style={styles.securityLabel}>Signature</Text>
            <View style={styles.securityBadge}><Text style={styles.securityBadgeText}>ECDSA secp256k1</Text></View>
          </View>
        </View>

        {/* ── LOGOUT ── */}
        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "500" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 58,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  backButton: { marginRight: 12 },
  backButtonPressed: { opacity: 0.7 },
  backBtnInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  backArrow: { fontSize: 20, color: "#fff", fontWeight: "700" },
  headerSpacer: { width: 40 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center" },

  scrollContent: { paddingHorizontal: 18, paddingBottom: 20 },

  avatarCard: {
    borderRadius: 24, overflow: "hidden", marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  avatarCardInner: { alignItems: "center", paddingVertical: 32 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  avatarText: { fontSize: 38, fontWeight: "800", color: "#16a34a" },
  avatarName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 },
  avatarId: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 12 },
  merchantBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  merchantBadgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  fieldsCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20, padding: 20, marginBottom: 16,
  },
  fieldContainer: { paddingVertical: 6 },
  fieldDivider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },
  label: {
    fontSize: 11, color: "#9ca3af", marginBottom: 6,
    textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.8,
  },
  value: { fontSize: 17, fontWeight: "600", color: "#111827" },
  valueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editPill: { backgroundColor: "#dcfce7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  editPillText: { color: "#16a34a", fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  input: {
    fontSize: 18, fontWeight: "600", color: "#1f2937",
    borderBottomWidth: 2, borderBottomColor: "#16a34a", paddingVertical: 4,
  },
  multilineInput: { minHeight: 60, textAlignVertical: "top" },
  editButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  cancelButton: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#d1d5db" },
  saveButton: { backgroundColor: "#16a34a" },
  buttonDisabled: { opacity: 0.6 },
  cancelButtonText: { color: "#374151", fontSize: 16, fontWeight: "600" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  securityCard: {
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  securityTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 12 },
  securityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  securityLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  securityBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  securityBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  logoutButton: {
    marginTop: 4, paddingVertical: 16, borderRadius: 12,
    backgroundColor: "#fee2e2", alignItems: "center",
  },
  logoutPressed: { opacity: 0.8 },
  logoutText: { color: "#dc2626", fontSize: 16, fontWeight: "700" },
});
