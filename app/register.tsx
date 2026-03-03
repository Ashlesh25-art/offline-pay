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
import { router } from 'expo-router';
import { API_BASE_URL } from '../lib/api';

export default function RegisterScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!phone || !password || !name) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    // Validate phone number: exactly 10 digits, Indian format (starts with 6-9)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    console.log('Registering user with API:', API_BASE_URL);
    
    try {
      console.log('Sending request to:', `${API_BASE_URL}/api/auth/register`);
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        if (response.status === 400 && data.error?.includes('already exists')) {
          Alert.alert('Phone Already Registered', 'This phone number is already registered. Please login with your credentials.', [
            { text: 'OK', onPress: () => router.replace('/login') }
          ]);
        } else {
          Alert.alert('Registration Failed', data.error || 'Please try again');
        }
        setLoading(false);
        return;
      }

      // Registration successful - redirect to login
      setLoading(false);
      Alert.alert('Success', `Account created for ${name}! Please login with your credentials.`, [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    } catch (error) {
      console.error('Register error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      Alert.alert('Connection Error', `Cannot connect to server at ${API_BASE_URL}. Make sure:\n1. Backend is running\n2. Phone and PC on same WiFi\n3. IP address is correct`);
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
              <Text style={styles.iconEmoji}>📝</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the offline payment system</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🙍</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
              />
            </View>

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
                maxLength={10}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Min 6 characters"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.mainBtn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.mainBtnGrad}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.mainBtnText}>Create Account →</Text>}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <Pressable style={styles.footerLink} onPress={() => router.replace('/login')}>
            <Text style={styles.footerLinkText}>Already have an account? <Text style={styles.footerLinkBold}>Login</Text></Text>
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

  mainBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  mainBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },

  footerLink: { alignItems: 'center', marginBottom: 14 },
  footerLinkText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500' },
  footerLinkBold: { color: '#fff', fontWeight: '800' },
});
