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

export default function MerchantRegisterScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!phone || !password || !businessName) {
      Alert.alert('Error', 'Please fill required fields');
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
    console.log('Registering merchant with API:', API_BASE_URL);
    
    try {
      console.log('Sending request to:', `${API_BASE_URL}/api/auth/merchant/register`);
      console.log('Data:', { phone, businessName, address: address || 'none' });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/merchant/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, businessName, address }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        if (response.status === 400 && data.error?.includes('already exists')) {
          Alert.alert('Phone Already Registered', 'This phone number is already registered. Would you like to login instead?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Login', onPress: () => router.replace('/merchant-login') }
          ]);
        } else {
          Alert.alert('Registration Failed', data.error || 'Please try again');
        }
        setLoading(false);
        return;
      }

      // Save merchant data for profile display
      const merchantData = {
        ...data.merchant,
        name: data.merchant.businessName,
        shopName: data.merchant.businessName,
        address: address || ''
      };
      await AsyncStorage.setItem('@merchant_data', JSON.stringify(merchantData));

      // Registration successful - show success message and redirect to login
      Alert.alert(
        'Registration Successful! 🎉', 
        `Your merchant account has been created successfully.\n\nBusiness: ${businessName}\nPhone: ${phone}\n\nPlease login to continue.`,
        [
          { 
            text: 'Go to Login', 
            onPress: () => router.replace('/merchant-login') 
          }
        ]
      );
    } catch (error) {
      console.error('Merchant register error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', errorMessage);
      Alert.alert('Connection Error', `Cannot connect to server at ${API_BASE_URL}.\n\nMake sure:\n1. Render backend is running\n2. Check service is not sleeping at:\n${API_BASE_URL}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#16a34a', '#15803d', '#166534']} style={styles.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🏪</Text>
            </View>
            <Text style={styles.title}>Register Merchant</Text>
            <Text style={styles.subtitle}>Create your merchant account</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.label}>Business Name *</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🏬</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your business name"
                placeholderTextColor="#aaa"
                value={businessName}
                onChangeText={setBusinessName}
              />
            </View>

            <Text style={styles.label}>Phone Number *</Text>
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

            <Text style={styles.label}>Business Address (optional)</Text>
            <View style={[styles.inputWrapper, styles.multilineWrapper]}>
              <Text style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 14 }]}>📍</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Enter business address"
                placeholderTextColor="#aaa"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
              />
            </View>

            <Text style={styles.label}>Password *</Text>
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
              <LinearGradient colors={['#16a34a', '#15803d']} style={styles.mainBtnGrad}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.mainBtnText}>Register Merchant →</Text>}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <Pressable style={styles.footerLink} onPress={() => router.replace('/merchant-login')}>
            <Text style={styles.footerLinkText}>Already registered? <Text style={styles.footerLinkBold}>Login</Text></Text>
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
  scroll: { paddingHorizontal: 24, paddingTop: 70, paddingBottom: 20 },

  header: { alignItems: 'center', marginBottom: 28 },
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
  multilineWrapper: { alignItems: 'flex-start' },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 14, fontWeight: '500' },
  multilineInput: { minHeight: 56, textAlignVertical: 'top' },

  mainBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  mainBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  mainBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },

  footerLink: { alignItems: 'center', marginBottom: 14 },
  footerLinkText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '500' },
  footerLinkBold: { color: '#fff', fontWeight: '800' },
});
