import React, { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE_URL } from '../lib/api';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Error', 'Please enter phone and password');
      return;
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Login Failed', response.status === 401 ? 'Invalid phone number or password.' : data.error || 'Please try again');
        return;
      }
      if (!data.success || !data.token || !data.user) {
        Alert.alert('Error', 'Invalid response from server');
        return;
      }
      await AsyncStorage.setItem('@auth_token', data.token);
      await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
      await AsyncStorage.setItem('@user_id', data.user.userId);
      router.replace('/user/wallet');
    } catch {
      Alert.alert('Connection Error', 'Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#4f46e5', '#7c3aed', '#a855f7']} style={styles.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>👤</Text>
            </View>
            <Text style={styles.title}>User Login</Text>
            <Text style={styles.subtitle}>Sign in to your wallet</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📱</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#aaa"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                maxLength={10}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.mainBtn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.mainBtnGrad}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.mainBtnText}>Login →</Text>}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.push('/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </View>

          {/* Footer */}
          <Pressable style={styles.footerLink} onPress={() => router.push('/register')}>
            <Text style={styles.footerLinkText}>Don't have an account? <Text style={styles.footerLinkBold}>Register</Text></Text>
          </Pressable>

          <Pressable style={styles.switchBtn} onPress={() => router.push('/merchant-login')}>
            <View style={styles.switchBtnInner}>
              <Text style={styles.switchBtnText}>🏪 Login as Merchant →</Text>
            </View>
          </Pressable>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 20 },

  header: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  iconEmoji: { fontSize: 36 },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  label: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f9fafb', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e5e7eb',
    paddingHorizontal: 14, marginBottom: 16,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 14, fontWeight: '500' },

  mainBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 6, marginBottom: 16 },
  mainBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },

  forgotText: { textAlign: 'center', color: '#7c3aed', fontSize: 14, fontWeight: '600' },

  footerLink: { alignItems: 'center', marginBottom: 14 },
  footerLinkText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500' },
  footerLinkBold: { color: '#fff', fontWeight: '800' },

  switchBtn: { borderRadius: 16, overflow: 'hidden' },
  switchBtnInner: {
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  switchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
