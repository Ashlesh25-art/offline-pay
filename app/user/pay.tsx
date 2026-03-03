import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getUserId, signPayloadHex, ensureUserKeypairAndId, getPublicKeyHex } from "../../lib/cryptoKeys";
import { API_BASE_URL } from "../../lib/api";

type MerchantInfo = {
  merchantId: string;
  name?: string;
} | null;

type Voucher = {
  voucherId: string;
  merchantId: string;
  amount: number;
  createdAt: string;
  issuedTo: string;
  signature: string;
  messageHashHex?: string;
  publicKeyHex?: string;
};

export default function UserPayScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [merchant, setMerchant] = useState<MerchantInfo>(null);
  const [amount, setAmount] = useState("");
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize user keypair on screen load
  useEffect(() => {
    (async () => {
      await ensureUserKeypairAndId();
    })();
  }, []);

  // Load current balance from backend
  const loadBalance = useCallback(async () => {
    try {
      setLoadingBalance(true);
      const token = await AsyncStorage.getItem('@auth_token');
      
      if (!token) {
        setBalance(0);
        setLoadingBalance(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/balance`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      } else {
        console.error('Failed to load balance');
        setBalance(0);
      }
    } catch (e) {
      console.log("Error reading balance", e);
      setBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);
    handleMerchantScanned(data);
  };

  const handleMerchantScanned = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      setMerchant({
        merchantId: parsed.merchantId,
        name: parsed.name,
      });
      setError(null);
    } catch (e) {
      console.log("Invalid merchant QR", e);
      setMerchant(null);
      setError("Could not read merchant QR");
    }
  };

  const handleGenerateVoucher = async () => {
    if (!merchant) {
      setError("Scan a merchant first");
      return;
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (balance === null) {
      setError("Balance not loaded yet");
      return;
    }

    if (amt > balance) {
      setError("Insufficient offline balance");
      return;
    }

    try {
      // Get user ID and public key for offline verification
      const userId = await getUserId();
      const publicKeyHex = await getPublicKeyHex();
      
      if (!userId || !publicKeyHex) {
        setError("User ID not found. Please restart the app.");
        return;
      }

      const payload = {
        voucherId: `V_${Date.now()}`,
        merchantId: merchant.merchantId,
        amount: amt,
        createdAt: new Date().toISOString(),
        issuedTo: userId
      };

      // Sign with ECDSA
      const { signatureHex, messageHashHex } = await signPayloadHex(payload);

      // Create final voucher with public key for offline verification
      const newVoucher: Voucher = {
        ...payload,
        signature: signatureHex,
        messageHashHex, // optional: helps debugging
        publicKeyHex, // included so merchant can verify offline
      };

      // Deduct balance from backend
      const token = await AsyncStorage.getItem('@auth_token');
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/balance/deduct`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: amt,
              merchantId: merchant.merchantId,
              voucherId: payload.voucherId
            })
          });

          if (response.ok) {
            const data = await response.json();
            setBalance(data.balance);
            console.log(`✅ Payment successful! New balance: ₹${data.balance}`);
          } else {
            const errorData = await response.json();
            console.error('Failed to deduct balance:', errorData);
            setError(errorData.error || 'Payment failed');
            return;
          }
        } catch (apiError) {
          console.error('API error:', apiError);
          setError('Failed to process payment. Please try again.');
          return;
        }
      }

      setVoucher(newVoucher);
      setError(null);
    } catch (e) {
      console.log("Error signing voucher / updating balance:", e);
      console.error("Full error:", JSON.stringify(e, null, 2));
      setError(`Could not generate signed voucher: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Modern Header with Back Button */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>💳 Pay Merchant</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          {loadingBalance ? (
            <ActivityIndicator color="#667eea" size="small" style={{marginTop: 8}} />
          ) : (
            <Text style={styles.balanceAmount}>₹{balance ?? 0}</Text>
          )}
        </View>

        {/* STEP 1: SCAN MERCHANT */}
        {!merchant && !voucher && (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepTitle}>Scan Merchant QR Code</Text>
            </View>

            {!permission ? (
              <Text style={styles.permissionText}>Requesting camera permission...</Text>
            ) : !permission.granted ? (
              <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>📷 Camera access needed</Text>
                <Pressable style={styles.primaryButton} onPress={requestPermission}>
                  <Text style={styles.primaryButtonText}>Grant Permission</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cameraWrapper}>
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                  >
                    <View style={styles.overlay}>
                      <View style={styles.scanFrame} />
                    </View>
                  </CameraView>
                </View>
                <Text style={styles.scanInstructions}>
                  🎯 Point camera at merchant's QR code
                </Text>
              </View>
            )}
          </View>
        )}

        {/* STEP 2: ENTER AMOUNT */}
        {merchant && !voucher && (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepTitle}>Enter Payment Amount</Text>
            </View>
            
            <View style={styles.merchantInfo}>
              <Text style={styles.merchantLabel}>🏪 Merchant</Text>
              <Text style={styles.merchantName}>{merchant.name || 'Business'}</Text>
              <Text style={styles.merchantId}>ID: {merchant.merchantId}</Text>
            </View>

            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <Pressable
              style={[
                styles.primaryButton,
                amount ? styles.primaryButtonActive : styles.primaryButtonDisabled,
              ]}
              disabled={!amount}
              onPress={handleGenerateVoucher}
            >
              <Text style={styles.primaryButtonText}>💳 Generate Payment Voucher</Text>
            </Pressable>

            <Text style={styles.infoText}>
              ℹ️ Your balance will be deducted after voucher generation
            </Text>
          </View>
        )}

        {/* STEP 3: SHOW VOUCHER QR */}
        {voucher && (
          <View style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepTitle}>Payment Voucher Generated</Text>
            </View>
            
            <View style={styles.successBadge}>
              <Text style={styles.successText}>✅ Payment voucher created successfully!</Text>
            </View>

            <View style={styles.qrContainer}>
              <QRCode 
                value={JSON.stringify(voucher)} 
                size={200}
                backgroundColor="#ffffff"
                color="#2d3748"
              />
            </View>

            <View style={styles.voucherDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Amount:</Text>
                <Text style={styles.detailValue}>₹{voucher.amount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Voucher ID:</Text>
                <Text style={styles.detailValueSmall}>{voucher.voucherId.slice(-8)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <Text style={styles.statusOffline}>🔴 Offline</Text>
              </View>
            </View>

            <Text style={styles.instructionText}>
              📱 Show this QR code to the merchant for verification
            </Text>
            
            <Pressable
              style={styles.doneButton}
              onPress={() => {
                setVoucher(null);
                setMerchant(null);
                setAmount("");
                setIsScanning(true);
                loadBalance();
              }}
            >
              <Text style={styles.doneButtonText}>✓ Complete Payment</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 40,
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 25,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2d3748',
    marginTop: 4,
  },
  stepCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 25,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d3748',
    flex: 1,
  },
  merchantInfo: {
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  merchantLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 2,
  },
  merchantId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    paddingVertical: 16,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonActive: {
    backgroundColor: '#667eea',
  },
  primaryButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorContainer: {
    backgroundColor: '#fed7d7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#c53030',
    textAlign: 'center',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cameraWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  cameraContainer: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  permissionContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  successBadge: {
    backgroundColor: '#c6f6d5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  successText: {
    fontSize: 14,
    color: '#22543d',
    textAlign: 'center',
    fontWeight: '600',
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  voucherDetails: {
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '700',
  },
  detailValueSmall: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  statusOffline: {
    fontSize: 12,
    color: '#e53e3e',
    fontWeight: '600',
    backgroundColor: '#fed7d7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  instructionText: {
    fontSize: 14,
    color: '#667eea',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 20,
  },
  doneButton: {
    backgroundColor: '#48bb78',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonPrimary: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center" as const,
    width: "80%",
  },
  buttonText: { color: "#fff", fontWeight: "600" as const, fontSize: 15 },
  errorText: { marginTop: 6, color: "#ef4444", fontSize: 12 },
  qrWrapper: {
    marginVertical: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  cameraContainer: {
    width: "100%",
    height: 400,
    position: "relative" as const,
    borderRadius: 12,
    overflow: "hidden" as const,
    marginTop: 12,
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
});
