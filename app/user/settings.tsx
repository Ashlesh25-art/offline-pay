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
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../lib/api";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_ITEMS = [
  {
    q: "How does offline payment work?",
    a: "When you pay offline, the app generates a cryptographically signed voucher (like a digital cheque). The merchant scans your QR code and stores the voucher locally. Once either of you comes online, the voucher is synced to the server and your balance is deducted — even if you were never connected at the same time.",
  },
  {
    q: "Is my balance safe when I'm offline?",
    a: "Yes. Your balance is cached locally and protected. Each voucher is signed with your unique private key stored on your device — it cannot be forged or reused by anyone else.",
  },
  {
    q: "What if the merchant hasn't scanned my voucher yet?",
    a: "Your voucher remains valid until it is scanned. You can see it in the Vouchers tab. Once the merchant scans it (online or offline), the payment is confirmed. Tap 'Sync Now' in History to push pending payments when you're online.",
  },
  {
    q: "Why is my balance not updated after payment?",
    a: "Balance is deducted when your offline transactions sync to the server. Open the app while online, go to History, and tap 'Sync Now'. Your balance will update immediately.",
  },
  {
    q: "How do I add balance to my wallet?",
    a: "Go to Wallet → tap the '+' button → enter an amount (max ₹1000 per top-up) → confirm. Balance is added instantly when online.",
  },
  {
    q: "Can I use the same voucher twice?",
    a: "No. Every voucher has a unique ID. The server rejects any attempt to reuse a voucher once it has been processed.",
  },
  {
    q: "What happens if I uninstall the app?",
    a: "Your account and balance are stored safely on the server. Your crypto keys are local — if lost, pending offline vouchers cannot be re-signed. Always sync before uninstalling.",
  },
];

export default function UserSettingsScreen() {
  const router = useRouter();

  // ─── Profile state ────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // ─── Password state ───────────────────────────────────────────────
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // ─── FAQ state ────────────────────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("@user_data");
      if (raw) {
        const u = JSON.parse(raw);
        setName(u.name || "");
        setDraftName(u.name || "");
        setPhone(u.phone || "");
        setUserId(u.userId || "");
      }
      setLoading(false);
    })();
  }, []);

  // ─── Save name ────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!draftName.trim()) { Alert.alert("Error", "Name cannot be empty"); return; }
    try {
      setSavingProfile(true);
      const token = await AsyncStorage.getItem("@auth_token");
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: draftName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setName(draftName.trim());
        setEditingName(false);
        const raw = await AsyncStorage.getItem("@user_data");
        if (raw) {
          const u = JSON.parse(raw);
          u.name = draftName.trim();
          await AsyncStorage.setItem("@user_data", JSON.stringify(u));
        }
        Alert.alert("✅ Saved", "Name updated successfully.");
      } else {
        Alert.alert("Error", data.error || "Failed to update name");
      }
    } catch {
      Alert.alert("Error", "Could not connect. Try again later.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ─── Change password ──────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }
    if (oldPassword === newPassword) {
      Alert.alert("Error", "New password must be different from current password");
      return;
    }
    try {
      setSavingPassword(true);
      const token = await AsyncStorage.getItem("@auth_token");
      const res = await fetch(`${API_BASE_URL}/api/user/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
        setShowPasswordSection(false);
        Alert.alert("✅ Password Changed", "Your password has been updated successfully.");
      } else {
        Alert.alert("Error", data.error || "Failed to change password");
      }
    } catch {
      Alert.alert("Error", "Could not connect. Try again later.");
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq(openFaq === index ? null : index);
  };

  if (loading) {
    return (
      <LinearGradient colors={["#4f46e5", "#7c3aed"]} style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  const firstLetter = name ? name.charAt(0).toUpperCase() : "U";

  return (
    <LinearGradient colors={["#4f46e5", "#7c3aed", "#a855f7"]} style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── AVATAR ── */}
        <View style={styles.avatarCard}>
          <LinearGradient colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.07)"]} style={styles.avatarInner}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{firstLetter}</Text>
            </View>
            <Text style={styles.avatarName}>{name || "User"}</Text>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>👤 Customer Account</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ══ SECTION: PROFILE ══════════════════════════════════════ */}
        <SectionHeader label="ACCOUNT DETAILS" icon="👤" />
        <View style={styles.card}>

          {/* Name */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              {editingName ? (
                <TextInput
                  style={styles.fieldInput}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Enter your name"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
              ) : (
                <Text style={styles.fieldValue}>{name || "—"}</Text>
              )}
            </View>
            {!editingName && (
              <Pressable style={styles.editPill} onPress={() => { setDraftName(name); setEditingName(true); }}>
                <Text style={styles.editPillText}>✏️ Edit</Text>
              </Pressable>
            )}
          </View>

          {editingName && (
            <View style={styles.inlineButtons}>
              <Pressable style={styles.cancelBtn} onPress={() => { setEditingName(false); setDraftName(name); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, savingProfile && styles.btnDisabled]}
                onPress={handleSaveName}
                disabled={savingProfile}
              >
                {savingProfile
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          )}

          <View style={styles.divider} />

          {/* Phone */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
              <Text style={styles.fieldValue}>{phone || "—"}</Text>
            </View>
            <View style={styles.lockBadge}><Text style={styles.lockText}>🔒 Fixed</Text></View>
          </View>

          <View style={styles.divider} />

          {/* User ID */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Text style={styles.fieldLabel}>USER ID</Text>
              <Text style={[styles.fieldValue, styles.monoText]}>{userId || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ══ SECTION: SECURITY ════════════════════════════════════= */}
        <SectionHeader label="SECURITY" icon="🔐" />
        <View style={styles.card}>

          {/* Change password toggle */}
          <Pressable
            style={styles.actionRow}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowPasswordSection((p) => !p);
              setOldPassword(""); setNewPassword(""); setConfirmPassword("");
            }}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: "#ede9fe" }]}>
                <Text>🔑</Text>
              </View>
              <View>
                <Text style={styles.actionTitle}>Change Password</Text>
                <Text style={styles.actionSub}>Update your login password</Text>
              </View>
            </View>
            <Text style={styles.chevron}>{showPasswordSection ? "▲" : "▼"}</Text>
          </Pressable>

          {showPasswordSection && (
            <View style={styles.passwordForm}>
              <View style={styles.divider} />
              <PasswordInput
                label="Current Password"
                value={oldPassword}
                onChange={setOldPassword}
                show={showOld}
                onToggle={() => setShowOld((v) => !v)}
                placeholder="Enter current password"
              />
              <PasswordInput
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                placeholder="Min. 6 characters"
              />
              <PasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                show={showConfirm}
                onToggle={() => setShowConfirm((v) => !v)}
                placeholder="Re-enter new password"
              />
              <Pressable
                style={[styles.passwordSaveBtn, savingPassword && styles.btnDisabled]}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.passwordSaveBtnText}>Update Password</Text>}
              </Pressable>
            </View>
          )}

          <View style={styles.divider} />

          {/* Crypto info rows */}
          <InfoRow icon="🛡️" label="Signature Scheme" value="ECDSA secp256k1" />
          <View style={styles.divider} />
          <InfoRow icon="📱" label="Keys Stored" value="On-device only" />
          <View style={styles.divider} />
          <InfoRow icon="✅" label="Vouchers" value="Cryptographically signed" />
        </View>

        {/* ══ SECTION: HELP & SUPPORT ══════════════════════════════== */}
        <SectionHeader label="HELP & SUPPORT" icon="💬" />
        <View style={styles.card}>
          {FAQ_ITEMS.map((item, i) => (
            <View key={i}>
              {i > 0 && <View style={styles.divider} />}
              <Pressable style={styles.faqQuestion} onPress={() => toggleFaq(i)}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.chevron}>{openFaq === i ? "▲" : "▼"}</Text>
              </Pressable>
              {openFaq === i && (
                <Text style={styles.faqA}>{item.a}</Text>
              )}
            </View>
          ))}
        </View>

        {/* ══ CONTACT CARD ═════════════════════════════════════════= */}
        <SectionHeader label="CONTACT SUPPORT" icon="📧" />
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <View style={[styles.contactIcon, { backgroundColor: "#ede9fe" }]}>
              <Text style={{ fontSize: 20 }}>👨‍💻</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>S Ashlesh</Text>
              <Text style={styles.contactRole}>Developer & Support</Text>
            </View>
          </View>
          <Pressable
            style={styles.emailBtn}
            onPress={() => Linking.openURL("mailto:ashleshskumar12@gmail.com?subject=Offline%20Pay%20Support")}
          >
            <Text style={styles.emailBtnIcon}>✉️</Text>
            <Text style={styles.emailBtnText}>ashleshskumar12@gmail.com</Text>
          </Pressable>
          <Text style={styles.supportNote}>
            Typically responds within 24 hours. Please include your User ID for faster assistance.
          </Text>
        </View>

        {/* ══ APP INFO ═════════════════════════════════════════════= */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Offline Pay · v1.0.0</Text>
          <Text style={styles.appInfoText}>Secure · Fast · Works Offline</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoBadge}><Text style={styles.infoBadgeText}>{value}</Text></View>
    </View>
  );
}

function PasswordInput({
  label, value, onChange, show, onToggle, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder: string;
}) {
  return (
    <View style={styles.pwField}>
      <Text style={styles.pwLabel}>{label}</Text>
      <View style={styles.pwRow}>
        <TextInput
          style={styles.pwInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={onToggle} style={styles.eyeBtn}>
          <Text style={styles.eyeText}>{show ? "🙈" : "👁️"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 58,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  backArrow: { fontSize: 20, color: "#fff", fontWeight: "700" },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: "#fff", textAlign: "center" },
  scroll: { paddingHorizontal: 18, paddingBottom: 20 },

  // Avatar
  avatarCard: {
    borderRadius: 24, overflow: "hidden", marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  avatarInner: { alignItems: "center", paddingVertical: 28 },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarLetter: { fontSize: 34, fontWeight: "800", color: "#4f46e5" },
  avatarName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8 },
  avatarBadge: {
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14,
    paddingVertical: 5, borderRadius: 20,
  },
  avatarBadgeText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Section header
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 8, marginTop: 4, paddingHorizontal: 4,
  },
  sectionIcon: { fontSize: 14, marginRight: 6 },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.2, textTransform: "uppercase",
  },

  // Card
  card: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 20, padding: 18, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },

  // Field row
  fieldRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
  },
  fieldLeft: { flex: 1, marginRight: 10 },
  fieldLabel: {
    fontSize: 10, color: "#9ca3af", fontWeight: "700",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5,
  },
  fieldValue: { fontSize: 16, fontWeight: "600", color: "#111827" },
  fieldInput: {
    fontSize: 16, fontWeight: "600", color: "#1f2937",
    borderBottomWidth: 2, borderBottomColor: "#4f46e5", paddingVertical: 2,
  },
  monoText: { fontSize: 11, color: "#6b7280", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  editPill: {
    backgroundColor: "#ede9fe", paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 10, marginTop: 4,
  },
  editPillText: { color: "#4f46e5", fontSize: 13, fontWeight: "600" },
  lockBadge: {
    backgroundColor: "#f9fafb", paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8, marginTop: 4,
    borderWidth: 1, borderColor: "#e5e7eb",
  },
  lockText: { fontSize: 11, color: "#9ca3af", fontWeight: "600" },

  // Inline save/cancel
  inlineButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: "#f3f4f6", alignItems: "center",
    borderWidth: 1, borderColor: "#e5e7eb",
  },
  cancelBtnText: { color: "#374151", fontSize: 14, fontWeight: "600" },
  saveBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    backgroundColor: "#4f46e5", alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },

  // Action row (e.g. change password toggle)
  actionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  actionLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  actionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  actionSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  chevron: { fontSize: 13, color: "#9ca3af", fontWeight: "700" },

  // Password form
  passwordForm: { paddingTop: 4 },
  pwField: { marginBottom: 14 },
  pwLabel: {
    fontSize: 10, color: "#9ca3af", fontWeight: "700",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6,
  },
  pwRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#e5e7eb",
    borderRadius: 10, backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
  },
  pwInput: {
    flex: 1, fontSize: 15, color: "#1f2937",
    paddingVertical: 11, fontWeight: "500",
  },
  eyeBtn: { padding: 4 },
  eyeText: { fontSize: 16 },
  passwordSaveBtn: {
    backgroundColor: "#4f46e5", paddingVertical: 13,
    borderRadius: 12, alignItems: "center", marginTop: 4,
  },
  passwordSaveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center" },
  infoIcon: { fontSize: 16, marginRight: 10, width: 24, textAlign: "center" },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#374151" },
  infoBadge: {
    backgroundColor: "#f0fdf4", paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  infoBadgeText: { color: "#15803d", fontSize: 12, fontWeight: "700" },

  // FAQ
  faqQuestion: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 4,
    gap: 8,
  },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1f2937", lineHeight: 20 },
  faqA: {
    fontSize: 13.5, color: "#4b5563", lineHeight: 21,
    marginTop: 8, marginBottom: 4,
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: "#4f46e5",
  },

  // Contact card
  contactCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 20, padding: 18, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  contactRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  contactIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 17, fontWeight: "800", color: "#111827" },
  contactRole: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  emailBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#4f46e5", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, gap: 8, marginBottom: 12,
  },
  emailBtnIcon: { fontSize: 16 },
  emailBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", flex: 1 },
  supportNote: {
    fontSize: 12, color: "#9ca3af", lineHeight: 18, textAlign: "center",
  },

  // App info
  appInfo: { alignItems: "center", marginTop: 8, marginBottom: 4 },
  appInfoText: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 },
});
