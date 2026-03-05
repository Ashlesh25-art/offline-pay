import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

type TransactionDetailProps = {
  visible: boolean;
  onClose: () => void;
  transaction: any;
  userType: 'user' | 'merchant';
};

export default function TransactionDetailModal({ 
  visible, 
  onClose, 
  transaction, 
  userType 
}: TransactionDetailProps) {
  // Hooks MUST be at the top — before any early return (Rules of Hooks)
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  if (!transaction) return null;

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'synced':
        return {
          color: '#059669',
          bg: '#d1fae5',
          icon: '✅',
          text: 'Synced to Server',
          description: 'Transaction completed and money transferred'
        };
      case 'offline':
        return {
          color: '#d97706', 
          bg: '#fef3c7',
          icon: '📱',
          text: 'Stored Offline',
          description: 'Awaiting sync to server'
        };
      default:
        return {
          color: '#6b7280',
          bg: '#f3f4f6', 
          icon: '❓',
          text: 'Unknown Status',
          description: 'Status unclear'
        };
    }
  };

  const statusInfo = getStatusInfo(transaction.status || 'unknown');

  // ─── Build receipt HTML for PDF ──────────────────────────────────────────
  const buildReceiptHTML = () => {
    const amountSign = transaction.type === 'credit' ? '+' : '-';
    const amountColor = transaction.type === 'credit' ? '#059669' : '#dc2626';
    const label = userType === 'user'
      ? (transaction.type === 'credit' ? 'Received' : 'Sent')
      : 'Payment Received';
    const statusIcon = transaction.status === 'synced' ? '✅' : '⏳';
    const statusTxt = transaction.status === 'synced' ? 'Synced to Server' : 'Stored Offline';
    const rows = [
      ['Description', transaction.description || '—'],
      ['Date & Time', formatDate(transaction.timestamp)],
      ['Transaction ID', transaction.id || '—'],
      transaction.payerName ? [userType === 'merchant' ? 'Payer' : 'Recipient', transaction.payerName] : null,
      transaction.merchantId ? ['Merchant ID', transaction.merchantId] : null,
    ].filter(Boolean) as [string, string][];

    const rowsHTML = rows.map(([label, value]) =>
      `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f9fafb; color: #1f2937; }
  .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  .header { text-align: center; background: linear-gradient(135deg, #16a34a, #14532d); color: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .header h1 { margin: 0 0 4px 0; font-size: 22px; }
  .header p { margin: 0; opacity: 0.85; font-size: 13px; }
  .amount-label { font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 6px; }
  .amount { font-size: 40px; font-weight: 700; text-align: center; color: ${amountColor}; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; background: ${transaction.status === 'synced' ? '#d1fae5' : '#fef3c7'}; color: ${transaction.status === 'synced' ? '#065f46' : '#92400e'}; font-weight: 600; font-size: 14px; }
  .status-center { text-align: center; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  td.lbl { color: #6b7280; width: 40%; }
  td.val { color: #1f2937; font-weight: 500; text-align: right; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Offline Pay</h1>
    <p>Transaction Receipt</p>
  </div>
  <div class="card">
    <div class="amount-label">${label}</div>
    <div class="amount">${amountSign}&#8377;${transaction.amount}</div>
    <div class="status-center"><span class="status-badge">${statusIcon} ${statusTxt}</span></div>
  </div>
  <div class="card">
    <table>${rowsHTML}</table>
  </div>
  <div class="footer">Generated by Offline Pay &bull; ${new Date().toLocaleString('en-IN')}</div>
</body>
</html>`;
  };

  // ─── Download PDF ─────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    try {
      setPdfLoading(true);
      const html = buildReceiptHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `receipt_${transaction.id || Date.now()}.pdf`;
      const dest = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Receipt PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Saved', `PDF saved to: ${dest}`);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not generate PDF: ' + (e?.message || String(e)));
    } finally {
      setPdfLoading(false);
    }
  };

  // ─── Share as text ────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      setShareLoading(true);
      const amountSign = transaction.type === 'credit' ? '+' : '-';
      const label = userType === 'user'
        ? (transaction.type === 'credit' ? 'Received' : 'Sent')
        : 'Payment Received';
      const statusTxt = transaction.status === 'synced' ? '✅ Synced' : '⏳ Offline';
      const lines = [
        '💳 *Offline Pay — Transaction Receipt*',
        '',
        `*${label}:* ${amountSign}₹${transaction.amount}`,
        `*Status:* ${statusTxt}`,
        `*Description:* ${transaction.description || '—'}`,
        `*Date:* ${formatDate(transaction.timestamp)}`,
        `*Transaction ID:* ${transaction.id || '—'}`,
        transaction.payerName ? `*${userType === 'merchant' ? 'Payer' : 'Recipient'}:* ${transaction.payerName}` : null,
        transaction.merchantId ? `*Merchant ID:* ${transaction.merchantId}` : null,
        '',
        '_Sent via Offline Pay_',
      ].filter((l) => l !== null).join('\n');

      await Share.share({
        message: lines,
        title: 'Transaction Receipt',
      });
    } catch {
      // User cancelled share — ignore
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Transaction Details</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>
              {userType === 'user' 
                ? (transaction.type === 'credit' ? 'Received' : 'Sent')
                : 'Payment Received'
              }
            </Text>
            <Text style={[
              styles.amount,
              transaction.type === 'credit' ? styles.creditAmount : styles.debitAmount
            ]}>
              {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount}
            </Text>
          </View>

          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusLabel}>Transaction Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.text}
                </Text>
              </View>
            </View>
            <Text style={styles.statusDescription}>{statusInfo.description}</Text>
          </View>

          {/* Transaction Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Transaction Information</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{transaction.description}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>{formatDate(transaction.timestamp)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValue}>{transaction.id}</Text>
            </View>

            {transaction.payerName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {userType === 'merchant' ? 'Payer' : 'Recipient'}
                </Text>
                <Text style={styles.detailValue}>{transaction.payerName}</Text>
              </View>
            )}

            {transaction.merchantId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Merchant ID</Text>
                <Text style={styles.detailValue}>{transaction.merchantId}</Text>
              </View>
            )}
          </View>

          {/* Voucher QR Code */}
          {transaction.voucherData && (
            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>
                {transaction.voucherData.used ? '✅ Payment Voucher' : '🎫 Voucher QR Code'}
              </Text>
              {!transaction.voucherData.used && (
                <Text style={styles.qrSubtitle}>
                  Show this to the merchant if they haven't scanned it yet
                </Text>
              )}
              <View style={styles.qrCenter}>
                <View style={styles.qrBox}>
                  <QRCode
                    value={JSON.stringify({
                      voucherId: transaction.voucherData.voucherId,
                      merchantId: transaction.voucherData.merchantId,
                      amount: transaction.voucherData.amount,
                      createdAt: transaction.voucherData.createdAt,
                      issuedTo: transaction.voucherData.issuedTo,
                      signature: transaction.voucherData.signature,
                      publicKeyHex: transaction.voucherData.publicKeyHex,
                    })}
                    size={160}
                    backgroundColor="#ffffff"
                    color="#1a1a2e"
                  />
                </View>
                <View style={[styles.voucherStatusBadge, transaction.voucherData.used ? styles.badgeUsed : styles.badgePending]}>
                  <Text style={[styles.voucherStatusText, transaction.voucherData.used ? styles.textUsed : styles.textPending]}>
                    {transaction.voucherData.used
                      ? '✅ Merchant received this payment'
                      : '⏳ Waiting for merchant to scan'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Payment Flow */}
          <View style={styles.flowCard}>
            <Text style={styles.cardTitle}>Payment Flow</Text>
            <View style={styles.flowSteps}>
              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowIconText}>1</Text>
                </View>
                <View style={styles.flowContent}>
                  <Text style={styles.flowTitle}>Payment Created</Text>
                  <Text style={styles.flowDesc}>
                    {userType === 'user' 
                      ? 'You generated a payment voucher'
                      : 'Customer created payment voucher'
                    }
                  </Text>
                </View>
                <Text style={styles.flowStatus}>✅</Text>
              </View>

              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowIconText}>2</Text>
                </View>
                <View style={styles.flowContent}>
                  <Text style={styles.flowTitle}>Voucher Scanned</Text>
                  <Text style={styles.flowDesc}>
                    {userType === 'user'
                      ? 'Merchant scanned your voucher'
                      : 'You scanned the voucher'
                    }
                  </Text>
                </View>
                <Text style={styles.flowStatus}>✅</Text>
              </View>

              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowIconText}>3</Text>
                </View>
                <View style={styles.flowContent}>  
                  <Text style={styles.flowTitle}>Server Sync</Text>
                  <Text style={styles.flowDesc}>
                    Transaction synced to backend server
                  </Text>
                </View>
                <Text style={styles.flowStatus}>
                  {transaction.status === 'synced' ? '✅' : '⏳'}
                </Text>
              </View>

              <View style={styles.flowStep}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowIconText}>4</Text>
                </View>  
                <View style={styles.flowContent}>
                  <Text style={styles.flowTitle}>Money Transfer</Text>
                  <Text style={styles.flowDesc}>
                    {userType === 'user'
                      ? 'Your balance was deducted' 
                      : 'Amount added to your account'
                    }
                  </Text>
                </View>
                <Text style={styles.flowStatus}>
                  {transaction.status === 'synced' ? '✅' : '⏳'}
                </Text>
              </View>
            </View>
          </View>

          {/* Extra space for scrolling */}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ─── Action Buttons — pinned to bottom ─── */}
        <View style={styles.actionBar}>
          <Pressable
            style={[styles.actionBtn, styles.downloadBtn, pdfLoading && styles.btnDisabled]}
            onPress={handleDownloadPDF}
            disabled={pdfLoading || shareLoading}
          >
            {pdfLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.actionBtnText}>📥 Download PDF</Text>
            }
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.shareBtn, shareLoading && styles.btnDisabled]}
            onPress={handleShare}
            disabled={pdfLoading || shareLoading}
          >
            {shareLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.actionBtnText}>📤 Share</Text>
            }
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
  },
  creditAmount: {
    color: '#059669',
  },
  debitAmount: {
    color: '#dc2626',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  flowCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  flowSteps: {
    marginTop: 8,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  flowIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  flowContent: {
    flex: 1,
  },
  flowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  flowDesc: {
    fontSize: 12,
    color: '#6b7280',
  },
  flowStatus: {
    fontSize: 18,
    marginLeft: 12,
  },
  // ── Voucher QR styles ──
  qrSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
  },
  qrCenter: {
    alignItems: 'center',
    gap: 12,
  },
  qrBox: {
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  voucherStatusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  badgeUsed: { backgroundColor: '#d1fae5' },
  badgePending: { backgroundColor: '#fef3c7' },
  voucherStatusText: { fontSize: 13, fontWeight: '600' },
  textUsed: { color: '#065f46' },
  textPending: { color: '#92400e' },
  // ── Action bar ──
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadBtn: {
    backgroundColor: '#2563eb',
  },
  shareBtn: {
    backgroundColor: '#16a34a',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});