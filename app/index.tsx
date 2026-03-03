import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function RoleSelectScreen() {
  return (
    <LinearGradient 
      colors={['#667eea', '#764ba2', '#5b73e8']} 
      style={styles.container}
    >
      {/* Payment Theme Header */}
      <View style={styles.headerSection}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>💳</Text>
          <Text style={styles.title}>Offline Pay</Text>
        </View>
        <Text style={styles.subtitle}>Secure • Fast • Offline Payments</Text>
        <View style={styles.featureRow}>
          <Text style={styles.feature}>🔒 Encrypted</Text>
          <Text style={styles.feature}>⚡ Instant</Text>
          <Text style={styles.feature}>📱 Mobile</Text>
        </View>
      </View>

      {/* Action Cards */}
      <View style={styles.cardsSection}>
        <Pressable 
          style={[styles.card, styles.userCard]}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.cardIcon}>👤</Text>
          <Text style={styles.cardTitle}>Customer Login</Text>
          <Text style={styles.cardSubtitle}>Pay merchants & manage wallet</Text>
        </Pressable>

        <Pressable 
          style={[styles.card, styles.merchantCard]}
          onPress={() => router.push('/merchant-login')}
        >
          <Text style={styles.cardIcon}>🏪</Text>
          <Text style={styles.cardTitle}>Merchant Login</Text>
          <Text style={styles.cardSubtitle}>Accept payments & view sales</Text>
        </Pressable>

        <Pressable 
          style={styles.signupRow}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.signupText}>New user? Create account</Text>
          <Text style={styles.signupArrow}>→</Text>
        </Pressable>

        <Pressable 
          style={styles.testButton}
          onPress={() => router.push('/test-connection')}
        >
          <Text style={styles.testText}>🔧 Connection Test</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  headerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 15
  },
  logoIcon: {
    fontSize: 60,
    marginBottom: 10
  },
  title: { 
    fontSize: 42, 
    fontWeight: "800", 
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1
  },
  subtitle: { 
    fontSize: 16, 
    color: "#e8f4fd", 
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9
  },
  featureRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 15
  },
  feature: {
    fontSize: 13,
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    overflow: 'hidden'
  },
  cardsSection: {
    flex: 1.2,
    justifyContent: 'flex-start',
    width: '100%',
    gap: 15
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  userCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50'
  },
  merchantCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800'
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center'
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 8
  },
  signupText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '500'
  },
  signupArrow: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold'
  },
  testButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 10
  },
  testText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600'
  }
});
