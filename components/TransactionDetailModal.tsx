import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Transaction Details</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          <View style={{ height: 50 }} />
        </ScrollView>
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
});