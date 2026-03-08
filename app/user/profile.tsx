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

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await AsyncStorage.getItem("@user_data");
      if (userData) {
        const user = JSON.parse(userData);
        setName(user.name || "");
        setOriginalName(user.name || "");
        setPhone(user.phone || "");
        setUserId(user.userId || "");
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

      const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update local storage
        const userData = await AsyncStorage.getItem("@user_data");
        if (userData) {
          const user = JSON.parse(userData);
          user.name = name.trim();
          await AsyncStorage.setItem("@user_data", JSON.stringify(user));
        }

        setOriginalName(name.trim());
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
    setIsEditing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove([
              "@auth_token",
              "@user_data",
              "@user_keypair",
              "@user_id",
            ]);
            router.replace("/");
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </LinearGradient>
    );
  }

  const firstLetter = name ? name.charAt(0).toUpperCase() : "U";

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
        <Text style={styles.title}>My Profile</Text>
        <Pressable
          onPress={() => router.push("/user/settings")}
          style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
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
            <Text style={styles.avatarName}>{name || "User"}</Text>
            <Text style={styles.avatarId}>ID: {userId || "—"}</Text>
          </LinearGradient>
        </View>

        {/* ── FIELDS CARD ── */}
        <View style={styles.fieldsCard}>
          {/* Name Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>FULL NAME</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                autoFocus
              />
            ) : (
              <View style={styles.valueRow}>
                <Text style={styles.value}>{name || "Not set"}</Text>
                <Pressable style={styles.editPill} onPress={() => setIsEditing(true)}>
                  <Text style={styles.editPillText}>✏️ Edit</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.fieldDivider} />

          {/* Phone Field */}
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
          <Text style={styles.securityTitle}>🔐 Security</Text>
          <View style={styles.securityRow}>
            <Text style={styles.securityLabel}>Crypto Keys</Text>
            <View style={styles.securityBadge}><Text style={styles.securityBadgeText}>✓ Generated</Text></View>
          </View>
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
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { fontSize: 20, color: "#fff", fontWeight: "700" },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: { fontSize: 20 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 20 },

  avatarCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarCardInner: { alignItems: "center", paddingVertical: 32 },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { fontSize: 38, fontWeight: "800", color: "#4f46e5" },
  avatarName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 4 },
  avatarId: { fontSize: 12, color: "rgba(255,255,255,0.7)" },

  fieldsCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  fieldContainer: {
    paddingVertical: 6,
  },
  fieldDivider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },
  label: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 6,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  valueSmall: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editPill: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editPillText: { color: "#4f46e5", fontSize: 13, fontWeight: "600" },
  hint: {
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 4,
  },
  input: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingVertical: 4,
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  saveButton: {
    backgroundColor: "#2563eb",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center" as const,
  },
  securityCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  securityRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  securityLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  securityBadge: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  securityBadgeText: {
    fontSize: 12,
    color: "#4f46e5",
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 30,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    alignItems: "center" as const,
  },
  logoutPressed: {
    opacity: 0.75,
  },
  logoutText: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "700",
  },
});
